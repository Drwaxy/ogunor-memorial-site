// -------- Lightbox (Photo Gallery) --------
function initLightbox() {
  const items = document.querySelectorAll('.gallery-item');
  const lightbox = document.getElementById('lightbox');
  if (!items.length || !lightbox) return;

  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const closeBtn = document.getElementById('lightboxClose');
  let opener = null;

  function open(item) {
    opener = item;
    const img = item.querySelector('img');
    const caption = item.getAttribute('data-caption') || '';
    if (img) {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxImg.style.display = '';
    } else {
      lightboxImg.style.display = 'none';
    }
    lightboxCaption.textContent = caption;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (opener) opener.focus();
  }

  items.forEach((item) => {
    item.addEventListener('click', () => open(item));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(item); }
    });
  });

  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) close();
    if (e.key === 'Tab' && lightbox.classList.contains('open')) {
      e.preventDefault();
      closeBtn.focus();
    }
  });
}

// -------- Condolence form (Formspree) --------
function initCondolenceForm() {
  const form = document.getElementById('condolenceForm');
  if (!form) return;

  const status = document.getElementById('formStatus');
  const endpoint = form.getAttribute('action');
  const placeholderEndpoint = endpoint && endpoint.includes('YOUR_FORM_ID');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (placeholderEndpoint) {
      status.textContent = 'Form is not connected yet — see README for the 2-minute Formspree setup.';
      status.className = 'form-status error';
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    status.textContent = 'Sending...';
    status.className = 'form-status';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        status.textContent = 'Thank you — your message has been received.';
        status.className = 'form-status success';
        form.reset();
      } else {
        status.textContent = 'Something went wrong. Please try again.';
        status.className = 'form-status error';
      }
    } catch (err) {
      status.textContent = 'Network error. Please try again.';
      status.className = 'form-status error';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// -------- Countdown (Live Stream page) --------
function initCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;
  const target = new Date(el.getAttribute('data-target')).getTime();

  function tick() {
    const now = Date.now();
    const diff = target - now;
    const box = (value, label) => `<div class="countdown-box"><strong>${value}</strong><span>${label}</span></div>`;

    if (diff <= 0) {
      el.innerHTML = `<div class="countdown-box"><strong>Live</strong><span>Now</span></div>`;
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    el.innerHTML = box(days, 'Days') + box(hours, 'Hours') + box(mins, 'Mins') + box(secs, 'Secs');
  }
  tick();
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  // Wait a tick so partials (header/footer) are injected first.
  setTimeout(() => {
    initLightbox();
    initCondolenceForm();
    initCountdown();
  }, 0);
});
