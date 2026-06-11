document.addEventListener('DOMContentLoaded', () => {
  const formSection = document.querySelector('.activation-form-section')
  const form = document.getElementById('activationForm')
  const input = document.getElementById('licenseKey')
  const error = document.querySelector('.activation-error')
  const success = document.querySelector('.activation-success')
  const keyDisplay = document.getElementById('activated-key')
  const phantomLink = document.getElementById('pwa-link-phantom')
  const vintedLink = document.getElementById('pwa-link-vinted')

  if (form && input && error && formSection && success) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const key = input.value.trim()

      if (!key) {
        showError('Please enter a license key.')
        return
      }

      try {
        const res = await fetch('/api/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })

        const data = await res.json()

        if (data.success) {
          formSection.style.display = 'none'
          error.classList.remove('show')
          error.style.display = 'none'
          success.classList.add('show')
          success.style.display = 'block'

          if (keyDisplay) keyDisplay.textContent = key

          if (phantomLink) {
            phantomLink.style.display = data.product === 'phantom' || data.product === 'phantom-dual' || data.product === 'bundle' ? 'flex' : 'none'
          }
          if (vintedLink) {
            vintedLink.style.display = data.product === 'vinted' || data.product === 'bundle' ? 'flex' : 'none'
          }

          const productIcon = document.querySelector('.activation-success-icon')
          if (productIcon) {
            if (data.product === 'phantom' || data.product === 'phantom-dual') {
              productIcon.className = 'activation-success-icon purple'
              productIcon.textContent = '👻'
            } else if (data.product === 'bundle') {
              productIcon.className = 'activation-success-icon'
              productIcon.textContent = '🎉'
            } else {
              productIcon.className = 'activation-success-icon teal'
              productIcon.textContent = '👕'
            }
          }
        } else {
          showError(data.error || 'Invalid license key. Please check and try again.')
        }
      } catch (err) {
        showError('Server error. Make sure you are on the correct page or try again later.')
      }
    })

    input.addEventListener('input', () => {
      error.classList.remove('show')
      error.style.display = 'none'
    })
  }

  function showError(msg) {
    error.textContent = msg
    error.classList.add('show')
    error.style.display = 'block'
  }
})
