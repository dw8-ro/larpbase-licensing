const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendLicenseKey(email, keys, product) {
  const singleKeys = Array.isArray(keys) ? keys : [keys];
  const isBundle = product === 'bundle';

  const subject = isBundle
    ? 'Your LarpBase Bundle — Phantom & Vinted License Keys'
    : {
        phantom: 'Your Larp Phantom — Single Key License Key',
        'phantom-dual': 'Your Larp Phantom — Dual Pack License Keys',
        vinted: 'Your Larp Vinted License Key',
      }[product] || 'Your LarpBase License Key';

  let keysHtml = '';
  if (isBundle) {
    keysHtml = `
      <p><strong>Larp Phantom Key:</strong></p>
      <div style="background:#f4f4f4;padding:12px;border-radius:8px;font-size:1.2rem;font-weight:700;letter-spacing:2px;text-align:center;font-family:monospace;margin:8px 0 16px">
        ${singleKeys[0]}
      </div>
      <p><strong>Larp Vinted Key:</strong></p>
      <div style="background:#f4f4f4;padding:12px;border-radius:8px;font-size:1.2rem;font-weight:700;letter-spacing:2px;text-align:center;font-family:monospace;margin:8px 0 16px">
        ${singleKeys[1]}
      </div>
    `;
  } else {
    keysHtml = singleKeys.map(k => `
      <div style="background:#f4f4f4;padding:16px;border-radius:8px;font-size:1.3rem;font-weight:700;letter-spacing:2px;text-align:center;font-family:monospace;margin:16px 0">
        ${k}
      </div>
    `).join('');
  }

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'LarpBase <onboarding@resend.dev>',
    to: email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Thanks for your purchase!</h2>
        ${isBundle ? '<p>Here are your two license keys:</p>' : '<p>Your license key is:</p>'}
        ${keysHtml}
        <p>To activate, go to <a href="https://larpbase.store/activation.html">larpbase.store/activation.html</a> and enter your key.</p>
        <p style="color:#888;font-size:0.85rem">Keep these keys private. Do not share them.</p>
      </div>
    `,
  });
}

module.exports = { sendLicenseKey };
