(() => {
  const form = document.getElementById('condolenceForm');
  if (!form) return;
  const canvas = document.getElementById('signaturePad');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('formStatus');
  const button = form.querySelector('[type=submit]');
  let drawing = null, signed = false, busy = false, config, widget;
  let pending = null;
  const say = (text, error = false) => {
    status.textContent = text;
    status.className = `form-status ${error ? 'error' : 'success'}`;
  };
  function clear() {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    signed = false;
    document.getElementById('signatureStatus').textContent = 'Sign here';
  }
  clear();
  const point = e => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height];
  };
  canvas.addEventListener('pointerdown', e => {
    if (busy || drawing !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId); drawing = e.pointerId;
    const [x, y] = point(e);
    ctx.strokeStyle = '#341a18'; ctx.fillStyle = '#341a18'; ctx.lineWidth = 4;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y); signed = true;
    document.getElementById('signatureStatus').textContent = 'Signature added';
  });
  canvas.addEventListener('pointermove', e => {
    if (drawing !== e.pointerId) return;
    e.preventDefault(); ctx.lineTo(...point(e)); ctx.stroke();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => canvas.addEventListener(event, () => { drawing = null; }));
  document.getElementById('clearSignature').addEventListener('click', () => { if (!busy) clear(); });
  const ready = fetch('/api/condolences').then(async response => {
    if (!response.ok) throw new Error();
    config = await response.json();
    document.getElementById('previewNotice').hidden = !config.preview;
    if (!config.preview) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
      });
      widget = window.turnstile.render('#botCheck', { sitekey: config.siteKey, action: 'condolence', size: 'compact' });
    }
    button.disabled = false;
  }).catch(() => { config = null; say('The register is unavailable at the moment. Please try again later.', true); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    await ready;
    if (!config) return;
    const data = {
      name: form.elements.name.value.trim(), relationship: form.elements.relationship.value.trim(),
      email: form.elements.email.value.trim(), message: form.elements.message.value.trim(),
      consent: document.getElementById('consent').checked,
      signature: signed ? canvas.toDataURL('image/png') : null,
      website: form.elements.website.value
    };
    const fingerprint = JSON.stringify(data);
    if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, id: crypto.randomUUID(), saved: false };
    busy = true; button.disabled = true;
    const controls = [...form.querySelectorAll('input, textarea, button')];
    controls.forEach(control => { control.disabled = true; });
    say('Saving your message...');
    try {
      if (!pending.saved) {
        const token = config.preview ? '' : window.turnstile?.getResponse(widget);
        if (!config.preview && !token) throw new Error('Please complete the verification before submitting.');
        const response = await fetch('/api/condolences', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, id: pending.id, token }), signal: AbortSignal.timeout(60000)
        });
        if (!response.ok) throw new Error('We could not save your message. Please try again.');
        pending.saved = true;
      }
      if (!config.preview) {
        const emailData = new FormData();
        for (const key of ['name', 'relationship', 'email', 'message']) emailData.append(key, data[key]);
        emailData.append('reference', pending.id);
        emailData.append('signature', signed ? 'Saved privately with this reference.' : 'No handwritten signature.');
        const response = await fetch(form.action, { method: 'POST', body: emailData, headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('Your message and signature are saved, but email delivery failed. Tap Sign the Register to retry email delivery.');
      }
      say(config.preview ? 'Preview saved on this computer. No email was sent. Thank you for testing the register.' : 'Thank you. Your message and optional signature have been received.');
      form.reset(); clear(); pending = null;
    } catch (error) {
      say(pending?.saved ? 'Your entry is saved. Email delivery could not be confirmed. You may retry; this could send a duplicate email.' : (error.name === 'TimeoutError' ? 'The connection timed out. Please retry; your entry will not be saved twice.' : error.message), true);
    } finally {
      busy = false; controls.forEach(control => { control.disabled = false; });
      if (widget !== undefined) window.turnstile.reset(widget);
    }
  });
})();
