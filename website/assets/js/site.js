/* Backyard Ultra Bad Vilbel – Countdown, Navigation und Anmeldung */

const CONFIG = {
  // Web-App-URL aus Google Apps Script (endet auf /exec).
  // Solange sie leer ist, läuft die Anmeldung im Vorschau-Modus.
  API_URL: '',

  // Start: 22.05.2027, 8:00 Uhr deutscher Zeit (Sommerzeit, UTC+2)
  START: Date.UTC(2027, 4, 22, 6, 0, 0)
};

const $ = (sel, root = document) => root.querySelector(sel);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const euro = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

/* ---------- Kopfzeile und mobiles Menü ---------- */
(function navigation() {
  const header = $('#kopf');
  const toggle = $('.nav-toggle');
  const nav = $('#hauptnavigation');
  const label = $('.sr-only', toggle);

  const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Menü schließen' : 'Menü öffnen';
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
  });
})();

/* ---------- Logo: Punkt läuft beim Scrollen einmal die Runde ---------- */
(function logoRunde() {
  const done = $('#route-done');
  const dot = $('#route-dot');
  if (!done || !dot || !done.getTotalLength) return;
  const laenge = done.getTotalLength();
  let geplant = false;
  const zeichne = () => {
    geplant = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const anteil = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const p = done.getPointAtLength(anteil * laenge);
    dot.setAttribute('cx', p.x.toFixed(1));
    dot.setAttribute('cy', p.y.toFixed(1));
    done.style.strokeDashoffset = String(1000 - anteil * 1000);
  };
  const plane = () => { if (!geplant) { geplant = true; requestAnimationFrame(zeichne); } };
  window.addEventListener('scroll', plane, { passive: true });
  window.addEventListener('resize', plane);
  zeichne();
})();

/* ---------- Countdown ---------- */
(function countdown() {
  const el = {
    tage: $('[data-cd="tage"]'), std: $('[data-cd="std"]'), min: $('[data-cd="min"]'), sek: $('[data-cd="sek"]'),
    tageLabel: $('[data-cd-label="tage"]'), hinweis: $('[data-cd="hinweis"]')
  };
  if (!el.tage) return;
  const pad = (n) => String(n).padStart(2, '0');
  let timer;
  const tick = () => {
    const rest = Math.max(0, Math.floor((CONFIG.START - Date.now()) / 1000));
    const tage = Math.floor(rest / 86400);
    el.tage.textContent = String(tage);
    el.tageLabel.textContent = tage === 1 ? 'Tag' : 'Tage';
    el.std.textContent = pad(Math.floor((rest % 86400) / 3600));
    el.min.textContent = pad(Math.floor((rest % 3600) / 60));
    el.sek.textContent = pad(rest % 60);
    if (rest === 0) {
      el.hinweis.textContent = 'Das Rennen läuft!';
      clearInterval(timer);
    }
  };
  tick();
  timer = setInterval(tick, 1000);
})();

/* ---------- Anreise: Routenlink und Karte (Karte lädt erst nach Klick) ---------- */
(function anreise() {
  const karte = $('#karte');
  if (!karte) return;
  const adresse = (karte.dataset.address || 'Bad Vilbel').trim();
  const ziel = encodeURIComponent(adresse);
  const route = $('#route-link');
  if (route) route.href = 'https://www.google.com/maps/dir/?api=1&destination=' + ziel;

  $('#karte-laden').addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = 'https://maps.google.com/maps?q=' + ziel + '&z=15&output=embed';
    frame.title = 'Karte: Start und Ziel in ' + adresse;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.setAttribute('allowfullscreen', '');
    $('#karte-hinweis').remove();
    karte.appendChild(frame);
    frame.focus();
  });
})();

/* ---------- Rückblick: Slideshow ---------- */
(function slideshow() {
  const box = $('#slideshow');
  if (!box) return;
  const track = $('.slideshow__track', box);
  const slides = [...box.querySelectorAll('.slide')];
  const dots = [...box.querySelectorAll('.slideshow__dot')];
  let aktuell = 0;
  let timer = null;

  const gehe = (i) => {
    aktuell = (i + slides.length) % slides.length;
    track.scrollTo({ left: aktuell * track.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  const markiere = () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    aktuell = Math.min(slides.length - 1, Math.max(0, i));
    dots.forEach((d, k) => { if (k === aktuell) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
  };
  const stopp = () => { clearInterval(timer); timer = null; };
  const start = () => { if (!reducedMotion && !timer) timer = setInterval(() => gehe(aktuell + 1), 5000); };

  box.querySelectorAll('.slideshow__btn').forEach((b) => b.addEventListener('click', () => { stopp(); gehe(aktuell + Number(b.dataset.dir)); }));
  dots.forEach((d, k) => d.addEventListener('click', () => { stopp(); gehe(k); }));
  track.addEventListener('scroll', () => requestAnimationFrame(markiere), { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); stopp(); gehe(aktuell + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stopp(); gehe(aktuell - 1); }
  });
  ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => box.addEventListener(ev, stopp, { passive: true }));
  box.addEventListener('pointerleave', start);

  // Nur laufen lassen, solange die Slideshow sichtbar ist
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { if (e[0].isIntersecting) start(); else stopp(); }, { threshold: 0.4 }).observe(box);
  } else {
    start();
  }
})();

/* ---------- Video und Einblenden ---------- */
(function motion() {
  const video = $('#hero-video');
  if (video && reducedMotion) { video.removeAttribute('autoplay'); video.pause(); }

  const items = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
})();

/* ---------- Anmeldung ---------- */
(function anmeldung() {
  const form = $('#anmeldeformular');
  if (!form) return;

  const ansichten = {
    formular: $('#ansicht-formular'), zahlung: $('#ansicht-zahlung'),
    erfolg: $('#ansicht-erfolg'), zu: $('#ansicht-zu')
  };
  const statusBox = $('#status');
  const statusText = $('#status-text');
  const statusFee = $('#status-fee');
  const formFehler = $('#formular-fehler');
  const zahlFehler = $('#zahlung-fehler');
  const paypalLaden = $('#paypal-laden');
  const paypalZiel = $('#paypal-buttons');

  let stand = null;      // letzter Status vom Server
  let daten = null;      // geprüfte Formulardaten
  let buttons = null;    // aktive PayPal-Buttons
  let sdkPromise = null;
  let serverMeldung = '';

  const zeige = (name) => {
    Object.entries(ansichten).forEach(([key, el]) => { el.hidden = key !== name; });
  };

  const meldung = (el, text) => {
    el.textContent = text || '';
    el.hidden = !text;
  };

  async function api(payload) {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      // text/plain vermeidet die CORS-Vorabfrage, die Apps Script nicht beantwortet
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function zeigeStatus(s) {
    stand = s;
    statusBox.dataset.state = s.zustand;
    statusFee.hidden = true;

    if (s.zustand === 'offen' || s.zustand === 'vorschau') {
      if (s.zustand === 'vorschau') {
        statusText.textContent = 'Vorschau: Anmeldung noch nicht verbunden';
      } else {
        statusText.textContent = s.frei === 1 ? 'Noch 1 von ' + s.plaetze + ' Plätzen frei' : 'Noch ' + s.frei + ' von ' + s.plaetze + ' Plätzen frei';
        statusFee.textContent = 'Startgebühr ' + euro(s.gebuehr);
        statusFee.hidden = false;
      }
      if (!ansichten.zahlung.hidden || !ansichten.erfolg.hidden) return;
      zeige('formular');
      return;
    }

    const texte = {
      bald: ['Anmeldung öffnet in Kürze', 'Die Anmeldung öffnet in Kürze', 'Schau bald wieder vorbei. Die 100 Startplätze werden in der Reihenfolge der Anmeldungen vergeben.'],
      ausverkauft: ['Alle ' + (s.plaetze || 100) + ' Startplätze sind vergeben', 'Alle Startplätze sind vergeben', 'Die Anmeldung ist geschlossen, weil alle Plätze belegt sind. Danke für euer Interesse!'],
      geschlossen: ['Die Anmeldung ist geschlossen', 'Die Anmeldung ist geschlossen', 'Für den Lauf am 22. Mai 2027 werden keine Anmeldungen mehr angenommen.'],
      fehler: ['Anmeldung gerade nicht erreichbar', 'Die Anmeldung ist gerade nicht erreichbar', 'Bitte lade die Seite in ein paar Minuten neu.']
    };
    const t = texte[s.zustand] || texte.fehler;
    statusText.textContent = t[0];
    if (!ansichten.erfolg.hidden) return;
    $('#zu-titel').textContent = t[1];
    $('#zu-text').textContent = t[2];
    schliesseButtons();
    zeige('zu');
  }

  async function ladeStatus() {
    if (!CONFIG.API_URL) { zeigeStatus({ zustand: 'vorschau' }); return; }
    try {
      const res = await fetch(CONFIG.API_URL + '?action=status', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const s = await res.json();
      zeigeStatus(s && s.ok ? s : { zustand: 'fehler' });
    } catch (err) {
      zeigeStatus({ zustand: 'fehler' });
    }
  }

  /* --- Formularprüfung --- */
  const regeln = {
    vorname: (v) => (v.trim().length >= 1 ? '' : 'Bitte gib deinen Vornamen ein.'),
    nachname: (v) => (v.trim().length >= 1 ? '' : 'Bitte gib deinen Nachnamen ein.'),
    email: (v) => (/^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v.trim()) ? '' : 'Bitte gib eine gültige E-Mail-Adresse ein, z. B. name@beispiel.de.')
  };

  function feldFehler(input, text) {
    const feld = input.closest('.field');
    let hinweis = feld.querySelector('.field__error');
    if (!text) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      if (hinweis) hinweis.remove();
      return;
    }
    if (!hinweis) {
      hinweis = document.createElement('p');
      hinweis.className = 'field__error';
      hinweis.id = input.id + '-fehler';
      feld.appendChild(hinweis);
    }
    hinweis.textContent = text;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', hinweis.id);
  }

  Object.keys(regeln).forEach((name) => {
    const input = form.elements[name];
    input.addEventListener('blur', () => { if (input.value) feldFehler(input, regeln[name](input.value)); });
    input.addEventListener('input', () => { if (input.getAttribute('aria-invalid')) feldFehler(input, regeln[name](input.value)); });
  });
  ['bedingungen', 'datenschutz'].forEach((name) => {
    form.elements[name].addEventListener('change', (e) => { if (e.target.checked) e.target.removeAttribute('aria-invalid'); });
  });

  function pruefe() {
    let erstes = null;
    Object.keys(regeln).forEach((name) => {
      const input = form.elements[name];
      const text = regeln[name](input.value);
      feldFehler(input, text);
      if (text && !erstes) erstes = input;
    });
    let haken = true;
    ['bedingungen', 'datenschutz'].forEach((name) => {
      const box = form.elements[name];
      if (!box.checked) { box.setAttribute('aria-invalid', 'true'); haken = false; if (!erstes) erstes = box; }
    });
    meldung(formFehler, haken ? '' : 'Bitte bestätige die Teilnahmebedingungen und die Datenschutzerklärung.');
    if (erstes) { erstes.focus(); return false; }
    return true;
  }

  /* --- PayPal --- */
  function ladeSdk(clientId) {
    if (window.paypal) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(clientId) + '&currency=EUR&intent=capture&components=buttons&locale=de_DE';
      s.onload = resolve;
      s.onerror = () => { sdkPromise = null; reject(new Error('PayPal konnte nicht geladen werden')); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  function schliesseButtons() {
    if (buttons) { try { buttons.close(); } catch (err) { /* schon geschlossen */ } buttons = null; }
    paypalZiel.innerHTML = '';
  }

  const warte = (ms) => new Promise((r) => setTimeout(r, ms));

  // Einzug mit Wiederholung: Der Server arbeitet idempotent, ein zweiter Versuch bucht nicht doppelt.
  async function zieheEin(orderID) {
    let letzter;
    for (let versuch = 0; versuch < 4; versuch++) {
      try {
        const r = await api({ action: 'capture', orderID });
        if (r.code !== 'BESCHAEFTIGT') return r;
        letzter = r;
      } catch (err) {
        letzter = { ok: false, code: 'NETZ', message: '' };
      }
      await warte(1500 * (versuch + 1));
    }
    return letzter;
  }

  async function zeigeButtons() {
    meldung(zahlFehler, '');
    paypalLaden.hidden = false;
    try {
      await ladeSdk(stand.clientId);
    } catch (err) {
      paypalLaden.hidden = true;
      meldung(zahlFehler, 'PayPal konnte nicht geladen werden. Bitte prüfe deine Internetverbindung oder einen Werbeblocker und versuche es erneut.');
      return;
    }
    schliesseButtons();
    buttons = window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.PAYPAL,
      style: { layout: 'vertical', shape: 'pill', label: 'pay', height: 52 },
      createOrder: async () => {
        meldung(zahlFehler, '');
        serverMeldung = '';
        const r = await api(Object.assign({ action: 'create' }, daten));
        if (!r.ok) {
          serverMeldung = r.message || '';
          if (['ausverkauft', 'geschlossen', 'bald'].includes(r.code)) ladeStatus();
          throw new Error(r.code || 'create');
        }
        return r.orderID;
      },
      onApprove: async (data, actions) => {
        paypalLaden.hidden = false;
        const r = await zieheEin(data.orderID);
        paypalLaden.hidden = true;
        if (r && r.ok) {
          schliesseButtons();
          $('#e-platz').textContent = 'Nr. ' + r.platz;
          $('#e-email').textContent = daten.email;
          zeige('erfolg');
          $('#erfolg-titel').focus();
          ladeStatus();
          return;
        }
        if (r && r.code === 'ZAHLUNG_ABGELEHNT' && actions && actions.restart) return actions.restart();
        if (r && r.code === 'ausverkauft') {
          const text = 'Leider wurde der letzte Platz gerade vergeben. Dir wurde nichts abgebucht.';
          meldung(zahlFehler, text);
          await ladeStatus();
          if (!ansichten.zu.hidden) $('#zu-text').textContent = text;
          return;
        }
        meldung(zahlFehler, (r && r.message) || 'Die Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut. Falls bei PayPal eine Abbuchung erscheint, melde dich bei uns.');
      },
      onCancel: () => meldung(zahlFehler, ''),
      onError: () => {
        paypalLaden.hidden = true;
        meldung(zahlFehler, serverMeldung || 'Bei der Zahlung ist ein Fehler aufgetreten. Es wurde nichts abgebucht. Bitte versuche es erneut.');
      }
    });
    await buttons.render('#paypal-buttons');
    paypalLaden.hidden = true;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!pruefe()) return;
    daten = {
      vorname: form.elements.vorname.value.trim(),
      nachname: form.elements.nachname.value.trim(),
      email: form.elements.email.value.trim().toLowerCase(),
      website: form.elements.website.value,
      bedingungen: true,
      datenschutz: true
    };
    $('#z-name').textContent = daten.vorname + ' ' + daten.nachname;
    $('#z-email').textContent = daten.email;
    const vorschau = !stand || stand.zustand === 'vorschau';
    $('#z-betrag').textContent = vorschau ? 'wird in der Tabelle festgelegt' : euro(stand.gebuehr);
    $('#zahlung-vorschau').hidden = !vorschau;
    paypalLaden.hidden = vorschau;
    meldung(zahlFehler, '');
    zeige('zahlung');
    $('#zahlung-titel').focus();
    if (!vorschau) zeigeButtons();
  });

  $('#zurueck').addEventListener('click', () => {
    schliesseButtons();
    zeige('formular');
    form.elements.vorname.focus();
  });

  ladeStatus();
})();
