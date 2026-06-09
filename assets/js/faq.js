document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item')
      const open = item.classList.contains('open')
      item.closest('.faq-list').querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'))
      if (!open) item.classList.add('open')
    })
  })
})
