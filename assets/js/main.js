document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-toggle')
  const menu = document.getElementById('mobileMenu')
  const overlay = document.getElementById('mobileOverlay')
  const close = document.querySelector('.mobile-close')

  function openMenu() {
    if (menu) menu.classList.add('open')
    if (overlay) overlay.classList.add('show')
    document.body.style.overflow = 'hidden'
  }

  function closeMenu() {
    if (menu) menu.classList.remove('open')
    if (overlay) overlay.classList.remove('show')
    document.body.style.overflow = ''
  }

  if (toggle) toggle.addEventListener('click', openMenu)
  if (close) close.addEventListener('click', closeMenu)
  if (overlay) overlay.addEventListener('click', closeMenu)

  const current = window.location.pathname.split('/').pop() || 'index.html'
  document.querySelectorAll('.nav-links a:not(.nav-btn), .mobile-menu a:not(.btn)').forEach(a => {
    const href = a.getAttribute('href')
    if (href === current) {
      a.style.color = 'var(--text)'
      if (a.closest('.nav-links')) a.style.background = 'rgba(255,255,255,0.04)'
    }
  })

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible')
      })
    },
    { threshold: 0.1 }
  )
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el))

  // Custom PayPal buy flow
  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault()
      const product = btn.dataset.product
      const email = prompt('Enter your email to receive the license key:')
      if (!email || !email.includes('@')) return

      btn.disabled = true
      const origText = btn.innerHTML
      btn.innerHTML = 'Processing...'

      try {
        const res = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, product }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          btn.disabled = false
          btn.innerHTML = origText
        }
      } catch (err) {
        btn.disabled = false
        btn.innerHTML = origText
      }
    })
  })
})
