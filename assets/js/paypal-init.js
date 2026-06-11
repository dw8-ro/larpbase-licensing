async function getPaypalClientId() {
  const res = await fetch('/api/config')
  const data = await res.json()
  return data.paypalClientId
}

function showEmailForm(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px">
      <input type="email" class="paypal-email-input" placeholder="Your email for the license key"
             style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:.85rem;box-sizing:border-box">
      <button class="paypal-email-submit" style="width:100%;padding:10px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:.85rem;font-weight:600;cursor:pointer">Continue to PayPal</button>
      <button class="paypal-email-cancel" style="width:100%;padding:6px;border:none;background:none;color:var(--text-muted);font-size:.8rem;cursor:pointer">Cancel</button>
    </div>`
  container.querySelector('.paypal-email-submit').onclick = () => {
    const input = container.querySelector('.paypal-email-input')
    const email = input.value.trim()
    if (!email || !email.includes('@')) {
      input.style.borderColor = '#ef4444'
      return
    }
    container.dataset.email = email
    renderPayPalButton(container)
  }
  container.querySelector('.paypal-email-cancel').onclick = () => {
    renderInitialButtons(container)
  }
}

function renderInitialButtons(container) {
  container.innerHTML = ''
  const btn = document.createElement('button')
  btn.textContent = 'Buy with PayPal'
  btn.style.cssText = 'width:100%;padding:12px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:.9rem;font-weight:600;cursor:pointer'
  btn.onclick = () => showEmailForm(container)
  container.appendChild(btn)
}

function renderPayPalButton(container) {
  container.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-muted);font-size:.85rem">Loading PayPal...</div>'
  paypal.Buttons({
    style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'paypal' },
    createOrder(data, actions) {
      const price = container.dataset.price
      return actions.order.create({
        purchase_units: [{ amount: { value: price } }]
      })
    },
    onApprove(data, actions) {
      return actions.order.capture().then(async details => {
        const email = container.dataset.email
        container.innerHTML = '<div style="text-align:center;padding:10px;color:#fff;font-size:.85rem">Processing...</div>'
        try {
          const res = await fetch('/api/paypal-capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: details.id, email })
          })
          const result = await res.json()
          if (result.success) {
            container.innerHTML = `<div style="text-align:center;padding:10px;color:#22c55e;font-size:.85rem;font-weight:600">✓ Key sent to ${result.email}!</div>`
          } else {
            renderInitialButtons(container)
            const errDiv = document.createElement('div')
            errDiv.style.cssText = 'text-align:center;padding:8px;color:#ef4444;font-size:.8rem'
            errDiv.textContent = result.error || 'Error'
            container.parentNode.insertBefore(errDiv, container.nextSibling)
          }
        } catch {
          renderInitialButtons(container)
        }
      })
    },
    onError(err) {
      console.error(err)
      renderInitialButtons(container)
    }
  }).render(container)
}

async function initPayPalButtons() {
  const clientId = await getPaypalClientId()
  const script = document.createElement('script')
  script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=GBP`
  script.onload = () => {
    document.querySelectorAll('.paypal-btn-container').forEach(container => {
      renderInitialButtons(container)
    })
  }
  document.body.appendChild(script)
}

initPayPalButtons()