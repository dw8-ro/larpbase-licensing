const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendLicenseKey(email, key, product) {
  const productNames = {
    phantom: 'Larp Phantom — Single Key',
    'phantom-dual': 'Larp Phantom — Dual Pack',
    vinted: 'Larp Vinted',
  };

  const productName = productNames[product] || 'LarpBase';

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'LarpBase <onboarding@resend.dev>',
    to: email,
    subject: `Your ${productName} License Key`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Thanks for your purchase!</h2>
        <p>Your license key for <strong>${productName}</strong> is:</p>
        <div style="background:#f4f4f4;padding:16px;border-radius:8px;font-size:1.3rem;font-weight:700;letter-spacing:2px;text-align:center;font-family:monospace;margin:16px 0">
          ${key}
        </div>
        <p>To activate, go to <a href="https://larpbase.netlify.app/activation.html">larpbase.netlify.app/activation.html</a> and enter your key.</p>
        <p style="color:#888;font-size:0.85rem">Keep this key private. Do not share it.</p>
      </div>
    `,
  });
}

module.exports = { sendLicenseKey };
