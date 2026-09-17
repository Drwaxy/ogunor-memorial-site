async function includePartials() {
  const slots = document.querySelectorAll('[data-include]');
  await Promise.all(Array.from(slots).map(async (slot) => {
    const file = slot.getAttribute('data-include');
    try {
      const res = await fetch(file);
      slot.outerHTML = await res.text();
    } catch (err) {
      console.error('Failed to load partial', file, err);
    }
  }));

  const current = document.body.getAttribute('data-page');
  document.querySelectorAll('.nav-links a').forEach((link) => {
    if (link.getAttribute('data-page') === current) {
      link.setAttribute('aria-current', 'page');
    }
  });

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    const closeMenu = () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    links.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        toggle.focus();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', includePartials);
