const express = require('express');
const path = require('path');
const axios = require('axios');
const { query, createTables } = require('./db');
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

app.use(express.static(path.join(__dirname, '.'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  },
}));

app.get('/thank-you', async (req, res) => {
  try {
    const { token, PayerID } = req.query;

    if (!token) {
      return res.status(400).send('Missing payment token');
    }

    const order = await verifyPayPalOrder(token);

    const payerEmail = order.payer?.email_address;
    const purchaseUnit = order.purchase_units?.[0];
    const amount = parseFloat(purchaseUnit?.amount?.value || '0');
    const txnId = purchaseUnit?.payments?.captures?.[0]?.id ||
                  purchaseUnit?.payments?.authorizations?.[0]?.id ||
                  token;

    const product = PRODUCT_MAP[amount.toFixed(2)];
    if (!product) {
      return res.status(400).send('Unknown product amount');
    }

    const existing = await query('SELECT key_raw, key FROM licenses WHERE paypal_txn = $1', [txnId]);
    if (existing.rows.length > 0) {
      return res.render('thank-you', {
        key: existing.rows[0].key_raw,
        product,
        email: payerEmail,
      });
    }

    const rawKey = generateKey();
    const hashedKey = hashKey(rawKey);

    await query(
      'INSERT INTO licenses (key_raw, key, plan, product, paypal_txn, customer_email, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [rawKey, hashedKey, 'Active Plan', product, txnId, payerEmail || '', 'active']
    );

    if (payerEmail) {
      try {
        await sendLicenseKey(payerEmail, rawKey, product);
      } catch (emailErr) {
        console.error('Email send failed:', emailErr.message);
      }
    }

    res.render('thank-you', {
      key: rawKey,
      product,
      email: payerEmail,
    });
  } catch (err) {
    console.error('Thank-you error:', err);
    res.status(500).send('Something went wrong. Contact support on Telegram.');
  }
});

app.post('/api/activate', async (req, res) => {
  try {
    const { key } = req.body;

    if (!key || !/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(key)) {
      return res.json({ success: false, error: 'Invalid key format' });
    }

    const hashedKey = hashKey(key.toUpperCase());
    const result = await query(
      'SELECT plan, status, key_raw FROM licenses WHERE key = $1',
      [hashedKey]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Invalid license key' });
    }

    const license = result.rows[0];

    if (license.status === 'activated' || license.status === 'used') {
      return res.json({ success: false, error: 'This key has already been activated' });
    }

    const product = await query('SELECT product FROM licenses WHERE key = $1', [hashedKey]);
    await query('UPDATE licenses SET status = $1 WHERE key = $2', ['activated', hashedKey]);

    res.json({
      success: true,
      product: product.rows[0]?.product || 'phantom',
      key: license.key_raw,
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
