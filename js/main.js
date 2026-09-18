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

// -------- Memorial background music --------
function initMemorialMusic() {
  if (window.__memorialMusic) return;

  const STORAGE = {
    preference: 'memorialMusicPreference',
    shouldPlay: 'memorialMusicShouldPlay',
    currentTime: 'memorialMusicCurrentTime',
  };
  const getSession = (key) => {
    try { return sessionStorage.getItem(key); } catch (error) { return null; }
  };
  const setSession = (key, value) => {
    try { sessionStorage.setItem(key, value); } catch (error) { /* Storage is optional. */ }
  };

  const audio = new Audio('/memorial-music.mp3');
  audio.loop = true;
  audio.volume = 0.25;
  audio.preload = 'metadata';
  audio.setAttribute('playsinline', '');
  window.__memorialMusic = audio;

  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'music-control';
  control.setAttribute('aria-pressed', 'false');
  control.innerHTML = `
    <span class="music-control__icon" aria-hidden="true">
      <span class="music-note">&#9835;</span>
      <span class="music-pause"><i></i><i></i></span>
    </span>
    <span class="music-control__label">Play music</span>
  `;
  document.body.appendChild(control);

  let overlay = null;
  let overlayOpener = null;
  let audioUnavailable = false;
  const savedTime = Number.parseFloat(getSession(STORAGE.currentTime) || '0');

  const updateControl = () => {
    const isPlaying = !audio.paused && !audio.ended;
    control.classList.toggle('is-playing', isPlaying);
    control.setAttribute('aria-pressed', String(isPlaying));
    control.setAttribute('aria-label', isPlaying ? 'Pause memorial music' : 'Play memorial music');
    control.querySelector('.music-control__label').textContent = isPlaying ? 'Pause music' : 'Play music';
  };

  const savePlaybackPosition = () => {
    if (Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
      setSession(STORAGE.currentTime, String(audio.currentTime));
    }
  };

  const restorePlaybackPosition = () => {
    if (!Number.isFinite(savedTime) || savedTime <= 0 || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(savedTime, Math.max(0, audio.duration - 0.25));
  };
  audio.addEventListener('loadedmetadata', restorePlaybackPosition, { once: true });

  const dismissOverlay = () => {
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    document.body.classList.remove('music-welcome-open');
    const removedOverlay = overlay;
    overlay = null;
    window.setTimeout(() => {
      removedOverlay.remove();
      if (document.contains(control)) control.focus({ preventScroll: true });
    }, 220);
  };

  const chooseSilence = () => {
    audio.pause();
    setSession(STORAGE.preference, 'silent');
    setSession(STORAGE.shouldPlay, 'false');
    dismissOverlay();
    updateControl();
  };

  const showWelcomeOverlay = () => {
    if (overlay || getSession(STORAGE.preference) === 'silent') return;
    overlayOpener = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'music-welcome';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'musicWelcomeTitle');
    overlay.setAttribute('aria-describedby', 'musicWelcomeDescription');
    overlay.innerHTML = `
      <div class="music-welcome__panel">
        <div class="music-welcome__ornament" aria-hidden="true">&#10022;</div>
        <p class="eyebrow">Welcome</p>
        <h2 id="musicWelcomeTitle">In Loving Memory of<br>Pa Hyacinth Nwafor Ogunor</h2>
        <p id="musicWelcomeDescription">Welcome to a celebration of a life well lived.</p>
        <div class="music-welcome__actions">
          <button type="button" class="btn btn-primary" data-music-choice="play">Enter Memorial with Music</button>
          <button type="button" class="music-welcome__quiet" data-music-choice="silent">Continue without Music</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('music-welcome-open');
    requestAnimationFrame(() => overlay && overlay.classList.add('is-visible'));

    const playButton = overlay.querySelector('[data-music-choice="play"]');
    const silentButton = overlay.querySelector('[data-music-choice="silent"]');
    playButton.addEventListener('click', async () => {
      setSession(STORAGE.preference, 'music');
      setSession(STORAGE.shouldPlay, 'true');
      try {
        await audio.play();
        dismissOverlay();
      } catch (error) {
        chooseSilence();
      }
      updateControl();
    });
    silentButton.addEventListener('click', chooseSilence);
    playButton.focus();

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        chooseSilence();
        if (overlayOpener instanceof HTMLElement) overlayOpener.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const first = playButton;
      const last = silentButton;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  };

  const attemptPlayback = async ({ showFallback = true } = {}) => {
    if (audioUnavailable) return false;
    try {
      await audio.play();
      setSession(STORAGE.preference, 'music');
      setSession(STORAGE.shouldPlay, 'true');
      updateControl();
      return true;
    } catch (error) {
      updateControl();
      if (error && error.name === 'NotAllowedError' && showFallback) showWelcomeOverlay();
      return false;
    }
  };

  control.addEventListener('click', async () => {
    if (audioUnavailable) return;
    if (audio.paused) {
      setSession(STORAGE.preference, 'music');
      setSession(STORAGE.shouldPlay, 'true');
      await attemptPlayback({ showFallback: false });
    } else {
      audio.pause();
      savePlaybackPosition();
      setSession(STORAGE.shouldPlay, 'false');
    }
    updateControl();
  });

  audio.addEventListener('play', updateControl);
  audio.addEventListener('pause', updateControl);
  audio.addEventListener('error', () => {
    audioUnavailable = true;
    dismissOverlay();
    control.disabled = true;
    control.setAttribute('aria-label', 'Memorial music is currently unavailable');
    control.querySelector('.music-control__label').textContent = 'Music unavailable';
  });
  window.addEventListener('pagehide', savePlaybackPosition);
  window.setInterval(savePlaybackPosition, 1000);

  updateControl();
  const preference = getSession(STORAGE.preference);
  const shouldPlay = getSession(STORAGE.shouldPlay);
  if (preference !== 'silent' && shouldPlay !== 'false') {
    attemptPlayback();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMemorialMusic();
  // Wait a tick so partials (header/footer) are injected first.
  setTimeout(() => {
    initLightbox();
    initCondolenceForm();
    initCountdown();
  }, 0);
});
