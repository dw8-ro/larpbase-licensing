const express = require('express');
const path = require('path');
const axios = require('axios');
const { query, vintedQuery, createTables } = require('./db');
const { generateKey, hashKey } = require('./keygen');
const { sendLicenseKey } = require('./email');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const PAYPAL_API = 'https://api-m.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

const PRODUCT_MAP = {
  '16.99': 'phantom',
  '23.99': 'phantom-dual',
  '7.99': 'vinted',
  '22.99': 'bundle',
};

async function getPayPalAccessToken() {
  const { data } = await axios.post(
    `${PAYPAL_API}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: PAYPAL_CLIENT_ID, password: PAYPAL_CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return data.access_token;
}

async function verifyPayPalOrder(orderId) {
  const token = await getPayPalAccessToken();
  const { data } = await axios.get(
    `${PAYPAL_API}/v2/checkout/orders/${orderId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

async function verifyWebhookSignature(req, event) {
  try {
    const token = await getPayPalAccessToken();
    const { data } = await axios.post(
      `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('Webhook verification error:', err.message);
    return false;
  }
}

async function processPayment(txnId, amount, payerEmail) {
  const product = PRODUCT_MAP[amount.toFixed(2)];
  if (!product) return null;

  if (product === 'vinted') {
    const exist = await vintedQuery('SELECT key FROM license_keys WHERE paypal_txn=$1', [txnId]);
    if (exist.rows.length > 0) return { keys: [exist.rows[0].key], product, email: payerEmail };
  } else {
    const exist = await query('SELECT key_raw FROM licenses WHERE paypal_txn=$1', [txnId]);
    if (exist.rows.length > 0) {
      const keys = exist.rows.map(r => r.key_raw);
      return { keys: product === 'bundle' ? keys : [keys[0]], product, email: payerEmail };
    }
  }

  let keys = [];
  if (product === 'vinted') {
    const k = generateKey(); const h = hashKey(k);
    await vintedQuery('INSERT INTO license_keys (key_hash,key,status,single_device,paypal_txn) VALUES($1,$2,$3,$4,$5)', [h,k,'active',true,txnId]);
    keys.push(k);
  } else if (product === 'bundle') {
    for (const sub of ['phantom','vinted']) {
      const k = generateKey(); const h = hashKey(k);
      if (sub === 'vinted') {
        await vintedQuery('INSERT INTO license_keys (key_hash,key,status,single_device,paypal_txn) VALUES($1,$2,$3,$4,$5)', [h,k,'active',true,txnId]);
      } else {
        await query('INSERT INTO licenses (key_raw,key,plan,product,paypal_txn,customer_email,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [k,h,'Active Plan','phantom',txnId,payerEmail||'','active']);
      }
      keys.push(k);
    }
  } else {
    const k = generateKey(); const h = hashKey(k);
    await query('INSERT INTO licenses (key_raw,key,plan,product,paypal_txn,customer_email,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [k,h,'Active Plan',product,txnId,payerEmail||'','active']);
    keys.push(k);
  }

  if (payerEmail && keys.length) {
    await sendLicenseKey(payerEmail, keys, product).catch(e => console.error('Email failed:', e.message));
  }
  return { keys, product, email: payerEmail };
}

app.use(express.static(path.join(__dirname, '.'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  },
}));

app.get('/thank-you', async (req, res) => {
  try {
    const { token, PayerID, order_id, paymentId } = req.query;
    const orderId = token || order_id || paymentId;

    console.log('Thank-you query:', JSON.stringify(req.query));

    if (!orderId) {
      return res.render('thank-you', {
        keys: [],
        product: 'unknown',
        email: req.query.email || null,
        noToken: true,
      });
    }

    const order = await verifyPayPalOrder(orderId);

    const payerEmail = order.payer?.email_address;
    const purchaseUnit = order.purchase_units?.[0];
    const amount = parseFloat(purchaseUnit?.amount?.value || '0');
    const txnId = purchaseUnit?.payments?.captures?.[0]?.id ||
                  purchaseUnit?.payments?.authorizations?.[0]?.id ||
                  orderId;

    const result = await processPayment(txnId, amount, payerEmail);

    if (!result) {
      return res.status(400).send('Unknown product');
    }

    res.render('thank-you', {
      keys: result.product === 'bundle' ? result.keys : [result.keys[0]],
      product: result.product,
      email: result.email,
      noToken: false,
    });
  } catch (err) {
    console.error('Thank-you error:', err);
    res.status(500).send('Something went wrong. Contact support on Telegram.');
  }
});

app.get('/dev/test-payment/:product', async (req, res) => {
  try {
    const product = req.params.product;
    const testEmail = req.query.email || 'dev-test@example.com';
    if (!['phantom', 'phantom-dual', 'vinted', 'bundle'].includes(product)) {
      return res.status(400).send('Invalid product. Use: phantom, phantom-dual, vinted, or bundle');
    }

    let keys = [];

    if (product === 'vinted') {
      const rawKey = generateKey();
      const hashedKey = hashKey(rawKey);
      await vintedQuery(
        'INSERT INTO license_keys (key_hash, key, status, single_device, paypal_txn) VALUES ($1, $2, $3, $4, $5)',
        [hashedKey, rawKey, 'active', true, 'DEV-TEST-' + Date.now()]
      );
      keys.push(rawKey);
    } else if (product === 'bundle') {
      for (const subProduct of ['phantom', 'vinted']) {
        const rawKey = generateKey();
        const hashedKey = hashKey(rawKey);
        if (subProduct === 'vinted') {
          await vintedQuery(
            'INSERT INTO license_keys (key_hash, key, status, single_device, paypal_txn) VALUES ($1, $2, $3, $4, $5)',
            [hashedKey, rawKey, 'active', true, 'DEV-TEST-' + Date.now()]
          );
        } else {
          await query(
            'INSERT INTO licenses (key_raw, key, plan, product, paypal_txn, customer_email, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [rawKey, hashedKey, 'Active Plan', 'phantom', 'DEV-TEST-' + Date.now(), testEmail, 'active']
          );
        }
        keys.push(rawKey);
      }
    } else {
      const rawKey = generateKey();
      const hashedKey = hashKey(rawKey);
      await query(
        'INSERT INTO licenses (key_raw, key, plan, product, paypal_txn, customer_email, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [rawKey, hashedKey, 'Active Plan', product, 'DEV-TEST-' + Date.now(), testEmail, 'active']
      );
      keys.push(rawKey);
    }

    try {
      await sendLicenseKey(testEmail, keys, product);
    } catch (e) {}

    let html = `<h2>Test Payment Simulated</h2>`;
    if (product === 'bundle') {
      html += `<p><strong>Phantom Key:</strong> <code style="font-size:1.3rem;letter-spacing:2px">${keys[0]}</code></p>`;
      html += `<p><strong>Vinted Key:</strong> <code style="font-size:1.3rem;letter-spacing:2px">${keys[1]}</code></p>`;
    } else {
      html += `<p><strong>Key:</strong> <code style="font-size:1.3rem;letter-spacing:2px">${keys[0]}</code></p>`;
    }
    html += `<p>An email was also sent (to ${testEmail} via Resend).</p>`;
    html += `<p><a href="/activation.html">Go to Activation Page →</a></p>`;
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

app.post('/api/paypal-webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('Webhook received:', event.event_type);

    if (process.env.PAYPAL_WEBHOOK_ID) {
      const verified = await verifyWebhookSignature(req, event);
      if (!verified) {
        console.error('Webhook verification failed');
        return res.sendStatus(200);
      }
    }

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource;
      const txnId = capture.id;
      const amount = parseFloat(capture.amount?.value || '0');
      const payerEmail = capture.payer?.email_address;
      if (txnId && amount > 0) {
        await processPayment(txnId, amount, payerEmail);
        console.log('Processed capture:', txnId);
      }
    } else if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const order = event.resource;
      const txnId = order.id;
      const amount = parseFloat(order.purchase_units?.[0]?.amount?.value || '0');
      const payerEmail = order.payer?.email_address;
      if (txnId && amount > 0) {
        await processPayment(txnId, amount, payerEmail);
        console.log('Processed order:', txnId);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200);
  }
});

app.post('/api/activate', async (req, res) => {
  try {
    const { key } = req.body;

    if (!key || !/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(key)) {
      return res.json({ success: false, error: 'Invalid key format' });
    }

    const hashedKey = hashKey(key.toUpperCase());

    let result = await query(
      'SELECT plan, status, key_raw, product FROM licenses WHERE key = $1',
      [hashedKey]
    );

    if (result.rows.length === 0) {
      result = await vintedQuery(
        'SELECT status, key FROM license_keys WHERE key_hash = $1',
        [hashedKey]
      );
    }

    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Invalid license key' });
    }

    const license = result.rows[0];

    if (license.status === 'activated' || license.status === 'used') {
      return res.json({ success: false, error: 'This key has already been activated' });
    }

    let productName;
    if (license.key_raw !== undefined) {
      productName = license.product;
      await query('UPDATE licenses SET status = $1 WHERE key = $2', ['activated', hashedKey]);
    } else {
      productName = 'vinted';
      await vintedQuery(
        'UPDATE license_keys SET status = $1, updated_at = NOW() WHERE key_hash = $2',
        ['activated', hashedKey]
      );
    }

    res.json({
      success: true,
      product: productName,
      key: license.key_raw || license.key,
    });
  } catch (err) {
    console.error('Activation error:', err);
    res.json({ success: false, error: 'Server error. Try again.' });
  }
});

async function start() {
  try {
    await createTables();
  } catch (err) {
    console.error('DB init error:', err.message);
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`✓ Server running on port ${port}`);
  });
}

start();
