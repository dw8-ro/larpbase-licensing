document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-toggle')
  const menu = document.getElementById('mobileMenu')
  const overlay = document.getElementById('mobileOverlay')
  const close = document.querySelector('.mobile-close')

  function openMenu() {
    if (menu) menu.classList.add('open')
    if (overlay) overlay.classList.add('show')
    document.body.style.overflow = 'hidden'
    const page = document.querySelector('.page-content')
    if (page) page.classList.add('menu-open')
  }

  function closeMenu() {
    if (menu) menu.classList.remove('open')
    if (overlay) overlay.classList.remove('show')
    document.body.style.overflow = ''
    const page = document.querySelector('.page-content')
    if (page) page.classList.remove('menu-open')
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

  // Scroll-to-top button
  const scrollBtn = document.querySelector('.scroll-top')
  function onScroll() {
    if (!scrollBtn) return
    if (window.scrollY > 50) scrollBtn.classList.add('show')
    else scrollBtn.classList.remove('show')
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  if (scrollBtn) scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

  // P2P demo modal
  const p2pLink = document.querySelector('.p2p-demo-link')
  const p2pModal = document.getElementById('p2pModal')
  if (p2pLink && p2pModal) {
    const p2pVideo = document.getElementById('p2pDemoVideo')
    const openModal = (e) => {
      e.preventDefault()
      p2pModal.classList.add('open')
      p2pModal.setAttribute('aria-hidden', 'false')
      document.body.style.overflow = 'hidden'
      if (p2pVideo) {
        try {
          p2pVideo.currentTime = 0
          p2pVideo.play().catch(() => {
            // autoplay might be blocked; user can press play
          })
        } catch (err) {/* ignore playback errors */}
      }
    }
    const closeModal = () => {
      p2pModal.classList.remove('open')
      p2pModal.setAttribute('aria-hidden', 'true')
      document.body.style.overflow = ''
      if (p2pVideo) {
        try {
          p2pVideo.pause()
          p2pVideo.currentTime = 0
        } catch (err) {/* ignore */}
      }
    }
    p2pLink.addEventListener('click', openModal)
    p2pModal.querySelector('[data-close]')?.addEventListener('click', closeModal)
    p2pModal.querySelector('.modal-close')?.addEventListener('click', closeModal)
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && p2pModal.classList.contains('open')) closeModal()
    })
  }
})
