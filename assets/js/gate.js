/* Admin-Login: legt einen Blur-Filter über die Seite, bis das Passwort stimmt.
   Hinweis: reiner Sichtschutz im Browser, kein echter Zugriffsschutz. */
(function () {
  'use strict';
  var HASH = 'aa0c60528b380c6eee5989194943ef1a783c12be6d9e81d0328d7b804a437e53';
  var KEY = 'cb-admin-ok';
  try { if (sessionStorage.getItem(KEY) === '1') return; } catch (e) {}

  var root = document.documentElement;
  root.classList.add('gate-locked');

  var css = document.createElement('style');
  css.textContent =
    'html.gate-locked{overflow:hidden}' +
    'html.gate-locked body>*:not(.gate){filter:blur(16px);pointer-events:none;user-select:none;-webkit-user-select:none}' +
    '.gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(236,238,233,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:var(--font-body,system-ui,sans-serif);color:#151515}' +
    '.gate__card{width:100%;max-width:400px;background:#fff;border-radius:20px;padding:32px 28px;box-shadow:0 20px 60px rgba(21,21,21,.18)}' +
    '.gate__title{margin:0 0 6px;font:800 1.5rem/1.2 var(--font-display,Arial,sans-serif)}' +
    '.gate__text{margin:0 0 20px;font-size:.95rem;color:#4A4A46}' +
    '.gate__label{display:block;margin-bottom:6px;font-size:.85rem;font-weight:600}' +
    '.gate__input{width:100%;box-sizing:border-box;padding:12px 14px;font:inherit;border:2px solid #CDD0C9;border-radius:12px;background:#fff}' +
    '.gate__input:focus{outline:none;border-color:#151515}' +
    '.gate__btn{margin-top:14px;width:100%;padding:13px 18px;font:700 1rem var(--font-body,sans-serif);color:#fff;background:#C8141B;border:0;border-radius:999px;cursor:pointer}' +
    '.gate__btn:hover{background:#A30F15}.gate__btn:disabled{opacity:.6;cursor:wait}' +
    '.gate__err{min-height:1.3em;margin:10px 0 0;font-size:.9rem;color:#A30F15}';
  document.head.appendChild(css);

  function sha256(str) {
    var data = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  function build() {
    var gate = document.createElement('div');
    gate.className = 'gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-labelledby', 'gate-title');
    gate.innerHTML =
      '<form class="gate__card" autocomplete="off">' +
      '<h1 class="gate__title" id="gate-title">Admin-Login</h1>' +
      '<p class="gate__text">Diese Seite ist noch nicht öffentlich. Bitte gib das Passwort ein.</p>' +
      '<label class="gate__label" for="gate-pw">Passwort</label>' +
      '<input class="gate__input" id="gate-pw" type="password" autocomplete="current-password" required>' +
      '<button class="gate__btn" type="submit">Entsperren</button>' +
      '<p class="gate__err" role="alert" aria-live="polite"></p>' +
      '</form>';
    document.body.appendChild(gate);

    var form = gate.querySelector('form');
    var input = gate.querySelector('input');
    var btn = gate.querySelector('button');
    var err = gate.querySelector('.gate__err');
    var kids = Array.prototype.filter.call(document.body.children, function (el) { return el !== gate; });
    kids.forEach(function (el) { el.setAttribute('inert', ''); });
    input.focus();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.textContent = '';
      if (!(window.crypto && crypto.subtle)) {
        err.textContent = 'Login nicht möglich: Bitte die Seite über https:// öffnen.';
        return;
      }
      btn.disabled = true;
      sha256(input.value).then(function (h) {
        if (h === HASH) {
          try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
          kids.forEach(function (el) { el.removeAttribute('inert'); });
          gate.remove();
          root.classList.remove('gate-locked');
        } else {
          setTimeout(function () {
            err.textContent = 'Falsches Passwort.';
            input.value = '';
            input.focus();
            btn.disabled = false;
          }, 600);
        }
      });
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
