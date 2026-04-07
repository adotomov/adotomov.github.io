/* ── Header: become opaque on scroll ─────────────── */
const header = document.getElementById('site-header');

window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ── Smooth anchor scroll (handles #hash links) ───── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ── Reveal sections on scroll ─────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ── Skill bars: animate when in view ──────────────── */
const skillObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('.skill-bar').forEach(bar => {
      bar.style.width = bar.dataset.level + '%';
    });
    skillObserver.unobserve(entry.target);
  });
}, { threshold: 0.3 });

const skillsSection = document.getElementById('skills');
if (skillsSection) skillObserver.observe(skillsSection);

/* ── About: stat counters ───────────────────────────── */
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('.stat-value').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      const suffix = el.dataset.suffix || '';
      const duration = 1200;
      const start = performance.now();
      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    statsObserver.unobserve(entry.target);
  });
}, { threshold: 0.5 });

const aboutSection = document.getElementById('about');
if (aboutSection) statsObserver.observe(aboutSection);

/* ── Contact captcha ────────────────────────────────── */
const contactData = (() => {
  const el = document.getElementById('__cd');
  if (!el) return null;
  try {
    // Hugo wraps the base64 string in JSON quotes → parse them off first
    const b64 = JSON.parse(el.textContent.trim());
    return JSON.parse(atob(b64));
  } catch { return null; }
})();

const modal       = document.getElementById('captcha-modal');
const btnShow     = document.getElementById('btn-show-details');
const btnClose    = document.getElementById('modal-close');
const btnSubmit   = document.getElementById('captcha-submit');
const inputEl     = document.getElementById('captcha-input');
const questionEl  = document.getElementById('captcha-question');
const errorEl     = document.getElementById('captcha-error');

let captchaAnswer = 0;

function generateCaptcha() {
  const a  = Math.floor(Math.random() * 12) + 1;
  const b  = Math.floor(Math.random() * 12) + 1;
  const ops = [
    { sym: '+', fn: (x, y) => x + y },
    { sym: '−', fn: (x, y) => x - y },
    { sym: '×', fn: (x, y) => x * y },
  ];
  const op = ops[Math.floor(Math.random() * ops.length)];
  captchaAnswer = op.fn(a, b);
  questionEl.textContent = `${a} ${op.sym} ${b} = ?`;
}

function openModal() {
  generateCaptcha();
  inputEl.value = '';
  errorEl.style.display = 'none';
  modal.classList.add('open');
  requestAnimationFrame(() => inputEl.focus());
}

function closeModal() {
  modal.classList.remove('open');
}

function revealContacts() {
  if (!contactData) return;
  const display = {
    email:    contactData.email,
    phone:    contactData.phone,
    github:   contactData.github ? `github.com/${contactData.github}` : null,
    linkedin: contactData.linkedin ? `linkedin.com/in/${contactData.linkedin}` : null,
  };
  document.querySelectorAll('.contact-value').forEach(el => {
    const val = display[el.dataset.field];
    if (!val) return;
    el.textContent = val;
    el.classList.remove('masked');
    el.classList.add('revealed');
  });
  if (btnShow) btnShow.style.display = 'none';
}

btnShow?.addEventListener('click', openModal);
document.getElementById('btn-download-pdf')?.addEventListener('click', downloadPDF);

function loadHtml2pdf() {
  return new Promise((resolve) => {
    if (window.html2pdf) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

async function downloadPDF() {
  await loadHtml2pdf();

  // Reveal all sections
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));

  // Set skill bars to final widths
  document.querySelectorAll('.skill-bar').forEach(bar => {
    bar.style.width = bar.dataset.level + '%';
  });

  // Set stat counters to final values
  document.querySelectorAll('.stat-value').forEach(el => {
    el.textContent = el.dataset.target + (el.dataset.suffix || '');
  });

  // Populate hero contact block from revealed contact values
  const heroPdfContact = document.querySelector('.hero-contact-pdf');
  if (heroPdfContact) {
    heroPdfContact.innerHTML = '';
    document.querySelectorAll('.contact-item').forEach(item => {
      const label = item.querySelector('.contact-label')?.textContent?.trim();
      const value = item.querySelector('.contact-value')?.textContent?.trim();
      if (!label || !value || value.includes('•')) return;
      const row = document.createElement('div');
      row.className = 'hero-contact-row';
      row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
      heroPdfContact.appendChild(row);
    });
  }

  // Pre-load avatar as data URL so html2canvas can render it
  const avatarImg = document.querySelector('.avatar-img');
  const originalSrc = avatarImg?.getAttribute('src');
  if (avatarImg && originalSrc) {
    try {
      const res = await fetch(originalSrc);
      const blob = await res.blob();
      const dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      avatarImg.src = dataUrl;
      // Wait for the browser to fully decode and paint the new src
      await avatarImg.decode().catch(() => {});
    } catch (_) {}
  }

  window.scrollTo(0, 0);
  document.body.classList.add('export-mode');

  // Let the browser paint the new layout before capturing
  await new Promise(r => setTimeout(r, 120));
  await document.fonts.ready;

  const target = document.querySelector('main');

  await window.html2pdf().set({
    margin: [10, 21, 10, 21],
    filename: 'cv.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  }).from(target).save();

  if (typeof gtag === 'function') {
    gtag('event', 'cv_download', {
      event_category: 'engagement',
      event_label: 'cv.pdf',
    });
  }

  document.body.classList.remove('export-mode');
  if (heroPdfContact) heroPdfContact.innerHTML = '';
  if (avatarImg && originalSrc) avatarImg.src = originalSrc;
}
btnClose?.addEventListener('click', closeModal);

modal?.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});

btnSubmit?.addEventListener('click', () => {
  const answer = parseInt(inputEl.value, 10);
  if (answer === captchaAnswer) {
    revealContacts();
    closeModal();
    if (btnShow) btnShow.style.display = 'none';
    document.getElementById('btn-download-pdf')?.classList.add('show');
  } else {
    errorEl.style.display = 'block';
    inputEl.value = '';
    inputEl.focus();
    generateCaptcha();
  }
});

inputEl?.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnSubmit.click();
});

