/**
 * BRIKSS Forms - Pagina de inicio
 * Navegacion de cards y menu movil sin inline scripts (compatible con CSP estricta).
 */

document.addEventListener('DOMContentLoaded', () => {
  // Navegacion de cards (click + Enter)
  document.querySelectorAll('.card[data-href]').forEach(card => {
    const href = card.dataset.href;
    if (!href) return;
    const go = () => { window.location.href = href; };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        go();
      }
    });
  });

  // Menu movil (toggle hamburguesa)
  const menuToggle = document.querySelector('.header__menu-toggle');
  const nav = document.querySelector('.header__nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }
});
