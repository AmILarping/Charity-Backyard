/**
 * Charity Backyard Bad Vilbel 2027 – Anmeldung (ohne Zahlung) und Erinnerung zum Anmeldestart
 *
 * Gehört in die Google-Tabelle „Backyard 2027“ (Erweiterungen → Apps Script)
 * und wird als Web-App bereitgestellt.
 *
 * Blatt „Anmeldungen“: Jede Anmeldung wird als neue Zeile gespeichert (erst ab ANMELDESTART).
 * Blatt „Erinnerung“:  E-Mail-Adressen für die einmalige Erinnerung (mit Double-Opt-In).
 *
 * Einmalig einrichten: Funktion „einrichten“ ausführen (legt Blätter und Zeitsteuerungen an).
 */

const BLATT = 'Anmeldungen';
const KOPF = ['Zeitstempel', 'Vorname', 'Nachname', 'E-Mail', 'Status'];
const BLATT_ERINNERUNG = 'Erinnerung';
const KOPF_ERINNERUNG = ['Zeitstempel', 'E-Mail', 'Status', 'Token'];
const MAX_ZEILEN = 3000; // Schutz gegen massenhafte Einträge

const ANMELDESTART = new Date('2027-02-01T00:00:00+01:00');   // ab hier nimmt das Script Anmeldungen an
const ERINNERUNG_ZEIT = new Date('2027-02-01T08:00:00+01:00'); // Versand der Erinnerungen
const SEITE = 'https://charity-backyard.de/';
const ABSENDER = 'Charity Backyard Bad Vilbel';
const MAIL_RESERVE = 10;        // so viele Mails pro Tag bleiben immer frei
const NEU_SENDEN_NACH_MIN = 10; // Bestätigungsmail erst nach so vielen Minuten erneut senden
const UNBESTAETIGT_TAGE = 7;    // unbestätigte Adressen werden danach gelöscht

const ST = { UNBESTAETIGT: 'unbestätigt', BESTAETIGT: 'bestätigt' };
const EMAIL_REGEL = /^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/* ====================================================================
   Einstiegspunkte der Web-App
   ==================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'bestaetigen') return bestaetigen_(p.t);
  return antwort_({ ok: true });
}

function doPost(e) {
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return antwort_({ ok: false, message: 'Die Anfrage konnte nicht gelesen werden.' });
  }
  if (!d) return antwort_({ ok: false, message: 'Die Anfrage konnte nicht gelesen werden.' });
  try {
    if (d.action === 'anmelden') return antwort_(anmelden_(d));
    if (d.action === 'erinnern') return antwort_(erinnern_(d));
    return antwort_({ ok: false, message: 'Unbekannte Aktion.' });
  } catch (err) {
    console.error(err);
    return antwort_({ ok: false, message: 'Es ist ein Fehler aufgetreten. Bitte versuche es in ein paar Minuten erneut.' });
  }
}

/* ====================================================================
   Anmeldung (erst ab ANMELDESTART)
   ==================================================================== */

function anmelden_(d) {
  if (new Date() < ANMELDESTART) {
    return { ok: false, message: 'Die Anmeldung startet am 1. Februar 2027.' };
  }
  // Spam-Falle: Das versteckte Feld muss leer bleiben. Bots bekommen „Erfolg“, es wird nichts gespeichert.
  if (d.website) return { ok: true };

  const vorname = text_(d.vorname, 60);
  const nachname = text_(d.nachname, 60);
  const email = text_(d.email, 120).toLowerCase();
  if (!vorname || !nachname) return { ok: false, message: 'Bitte gib Vor- und Nachnamen ein.' };
  if (!EMAIL_REGEL.test(email)) return { ok: false, message: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  if (d.bedingungen !== true || d.datenschutz !== true) {
    return { ok: false, message: 'Bitte bestätige die Teilnahmebedingungen und die Datenschutzerklärung.' };
  }

  const sperre = sperren_();
  if (!sperre) return { ok: false, message: 'Gerade ist viel los. Bitte versuche es in einem Moment erneut.' };
  try {
    const blatt = blatt_(BLATT, KOPF);
    const zeilen = blatt.getLastRow();
    if (zeilen >= MAX_ZEILEN) return { ok: false, message: 'Die Anmeldung ist gerade nicht möglich.' };

    if (zeilen > 1) {
      const bekannt = blatt.getRange(2, 4, zeilen - 1, 1).getValues().map(function (r) {
        return String(r[0]).toLowerCase();
      });
      if (bekannt.indexOf(email) !== -1) {
        return { ok: false, message: 'Mit dieser E-Mail-Adresse gibt es schon eine Anmeldung.' };
      }
    }
    blatt.appendRow([new Date(), vorname, nachname, email, 'angemeldet']);
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    sperre.releaseLock();
  }
}

/* ====================================================================
   Erinnerung mit Double-Opt-In
   ==================================================================== */

function erinnern_(d) {
  if (d.website) return { ok: true }; // Spam-Falle
  const email = text_(d.email, 120).toLowerCase();
  if (!EMAIL_REGEL.test(email)) return { ok: false, message: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  if (d.einwilligung !== true) return { ok: false, message: 'Bitte stimme der einmaligen Erinnerung per E-Mail zu.' };
  if (new Date() >= ANMELDESTART) {
    return { ok: false, message: 'Die Anmeldung ist schon geöffnet. Du kannst dich direkt anmelden.' };
  }
  if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVE) {
    return { ok: false, message: 'Gerade können wir keine Mails verschicken. Bitte versuche es morgen erneut.' };
  }

  const sperre = sperren_();
  if (!sperre) return { ok: false, message: 'Gerade ist viel los. Bitte versuche es in einem Moment erneut.' };
  try {
    const blatt = blatt_(BLATT_ERINNERUNG, KOPF_ERINNERUNG);
    const zeilen = blatt.getLastRow();
    if (zeilen >= MAX_ZEILEN) return { ok: false, message: 'Die Erinnerung ist gerade nicht möglich.' };

    const werte = zeilen > 1 ? blatt.getRange(2, 1, zeilen - 1, 4).getValues() : [];
    let zeile = -1;
    for (let i = 0; i < werte.length; i++) {
      if (String(werte[i][1]).toLowerCase() === email) { zeile = i; break; }
    }

    if (zeile === -1) {
      const token = Utilities.getUuid();
      blatt.appendRow([new Date(), email, ST.UNBESTAETIGT, token]);
      SpreadsheetApp.flush();
      try {
        bestaetigungSenden_(email, token);
      } catch (err) {
        console.error(err);
        blatt.deleteRow(blatt.getLastRow());
        return { ok: false, message: 'Die Mail konnte nicht gesendet werden. Bitte versuche es später erneut.' };
      }
    } else if (werte[zeile][2] === ST.UNBESTAETIGT) {
      const alterMin = (Date.now() - new Date(werte[zeile][0]).getTime()) / 60000;
      if (alterMin >= NEU_SENDEN_NACH_MIN) {
        bestaetigungSenden_(email, String(werte[zeile][3]));
        blatt.getRange(zeile + 2, 1).setValue(new Date());
      }
    }
    // Bereits bestätigte Adressen bekommen keine neue Mail. Die Antwort ist in allen Fällen gleich.
    return { ok: true };
  } finally {
    sperre.releaseLock();
  }
}

function bestaetigungSenden_(email, token) {
  const link = ScriptApp.getService().getUrl() + '?action=bestaetigen&t=' + encodeURIComponent(token);
  MailApp.sendEmail({
    to: email,
    name: ABSENDER,
    subject: 'Bitte bestätige deine Erinnerung – Charity Backyard Bad Vilbel',
    body:
      'Hallo,\n\n' +
      'du hast auf ' + SEITE + ' darum gebeten, an den Anmeldestart des Charity Backyard Bad Vilbel erinnert zu werden.\n\n' +
      'Bitte bestätige deine E-Mail-Adresse mit diesem Link:\n' + link + '\n\n' +
      'Danach schicken wir dir am 1. Februar 2027 eine einzige E-Mail, sobald die Anmeldung öffnet. ' +
      'Danach löschen wir deine Adresse.\n\n' +
      'Wenn du das nicht angefordert hast, ignoriere diese Mail einfach. ' +
      'Ohne Bestätigung wird deine Adresse nach ' + UNBESTAETIGT_TAGE + ' Tagen gelöscht.\n\n' +
      ABSENDER + '\n' + SEITE
  });
}

function bestaetigen_(token) {
  const t = String(token || '');
  if (!t) return seite_('Link ungültig', 'Dieser Bestätigungslink ist nicht gültig.');
  const sperre = sperren_();
  if (!sperre) return seite_('Bitte später erneut versuchen', 'Gerade ist viel los. Bitte klicke den Link in ein paar Minuten noch einmal an.');
  try {
    const blatt = blatt_(BLATT_ERINNERUNG, KOPF_ERINNERUNG);
    const zeilen = blatt.getLastRow();
    const werte = zeilen > 1 ? blatt.getRange(2, 1, zeilen - 1, 4).getValues() : [];
    for (let i = 0; i < werte.length; i++) {
      if (String(werte[i][3]) === t) {
        blatt.getRange(i + 2, 3).setValue(ST.BESTAETIGT);
        SpreadsheetApp.flush();
        return seite_('Danke, du bist eingetragen!', 'Wir schicken dir am 1. Februar 2027 eine einzige E-Mail, sobald die Anmeldung zum Charity Backyard Bad Vilbel öffnet.');
      }
    }
    return seite_('Link abgelaufen', 'Dieser Bestätigungslink ist abgelaufen oder wurde schon verwendet. Du kannst auf der Website eine neue Erinnerung anfordern.');
  } finally {
    sperre.releaseLock();
  }
}

/* ====================================================================
   Zeitgesteuerte Aufgaben
   ==================================================================== */

// Versendet die Erinnerungen an alle bestätigten Adressen und löscht sie danach.
// Reicht das Tageslimit nicht, läuft die Funktion am nächsten Tag automatisch weiter.
function erinnerungenSenden() {
  triggerLoeschen_('erinnerungenSenden');
  const sperre = sperren_(60000);
  if (!sperre) { console.error('Sperre nicht erhalten'); return; }
  let offen = 0, gesendet = 0, frei = MailApp.getRemainingDailyQuota();
  try {
    const blatt = blatt_(BLATT_ERINNERUNG, KOPF_ERINNERUNG);
    const zeilen = blatt.getLastRow();
    const werte = zeilen > 1 ? blatt.getRange(2, 1, zeilen - 1, 4).getValues() : [];
    const loeschen = [];
    for (let i = 0; i < werte.length; i++) {
      if (werte[i][2] !== ST.BESTAETIGT) continue;
      if (frei <= 0) { offen++; continue; }
      try {
        MailApp.sendEmail({
          to: String(werte[i][1]),
          name: ABSENDER,
          subject: 'Die Anmeldung zum Charity Backyard Bad Vilbel ist geöffnet',
          body:
            'Hallo,\n\n' +
            'heute startet die Anmeldung zum Charity Backyard Bad Vilbel am 22. Mai 2027. ' +
            'Es gibt 100 Startplätze, vergeben in der Reihenfolge der Anmeldungen.\n\n' +
            'Jetzt anmelden: ' + SEITE + '#anmeldung\n\n' +
            'Das war die einzige Erinnerung, die du von uns bekommst. Deine Adresse haben wir jetzt aus unserer Liste gelöscht.\n\n' +
            'Bis bald!\n' + ABSENDER
        });
        frei--; gesendet++;
        loeschen.push(i + 2);
      } catch (err) {
        console.error(err);
        offen++;
      }
    }
    loeschen.sort(function (a, b) { return b - a; }).forEach(function (z) { blatt.deleteRow(z); });
    SpreadsheetApp.flush();
  } finally {
    sperre.releaseLock();
  }
  if (offen > 0 && (gesendet > 0 || frei <= 0)) {
    ScriptApp.newTrigger('erinnerungenSenden').timeBased().after(24 * 60 * 60 * 1000 + 5 * 60 * 1000).create();
  }
}

// Löscht unbestätigte Adressen nach UNBESTAETIGT_TAGE Tagen (läuft täglich).
function aufraeumen() {
  const sperre = sperren_(60000);
  if (!sperre) return;
  try {
    const blatt = blatt_(BLATT_ERINNERUNG, KOPF_ERINNERUNG);
    const zeilen = blatt.getLastRow();
    if (zeilen < 2) return;
    const werte = blatt.getRange(2, 1, zeilen - 1, 4).getValues();
    const grenze = Date.now() - UNBESTAETIGT_TAGE * 24 * 60 * 60 * 1000;
    for (let i = werte.length - 1; i >= 0; i--) {
      if (werte[i][2] === ST.UNBESTAETIGT && new Date(werte[i][0]).getTime() < grenze) blatt.deleteRow(i + 2);
    }
  } finally {
    sperre.releaseLock();
  }
}

// Einmalig im Editor ausführen: legt die Blätter und Zeitsteuerungen an.
function einrichten() {
  blatt_(BLATT, KOPF);
  blatt_(BLATT_ERINNERUNG, KOPF_ERINNERUNG);
  triggerLoeschen_('erinnerungenSenden');
  triggerLoeschen_('aufraeumen');
  if (ERINNERUNG_ZEIT > new Date()) {
    ScriptApp.newTrigger('erinnerungenSenden').timeBased().at(ERINNERUNG_ZEIT).create();
  }
  ScriptApp.newTrigger('aufraeumen').timeBased().everyDays(1).atHour(3).create();
  console.log('Eingerichtet. Erinnerungen werden am ' + ERINNERUNG_ZEIT.toISOString() + ' versendet. Freie Mails heute: ' + MailApp.getRemainingDailyQuota());
}

// Zum Testen im Editor: legt eine Testzeile in beiden Blättern an und löscht sie wieder.
function test() {
  const a = blatt_(BLATT, KOPF);
  a.appendRow([new Date(), 'Test', 'Test', 'test@example.com', 'TEST']);
  a.deleteRow(a.getLastRow());
  const b = blatt_(BLATT_ERINNERUNG, KOPF_ERINNERUNG);
  b.appendRow([new Date(), 'test@example.com', 'TEST', 'test']);
  b.deleteRow(b.getLastRow());
  console.log('Beide Blätter funktionieren. Freie Mails heute: ' + MailApp.getRemainingDailyQuota());
}

/* ====================================================================
   Hilfsfunktionen
   ==================================================================== */

function blatt_(name, kopf) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let blatt = ss.getSheetByName(name);
  if (!blatt) blatt = ss.insertSheet(name);
  if (blatt.getLastRow() === 0) {
    blatt.appendRow(kopf);
    blatt.getRange(1, 1, 1, kopf.length).setFontWeight('bold');
    blatt.setFrozenRows(1);
  }
  return blatt;
}

function sperren_(ms) {
  const sperre = LockService.getScriptLock();
  try {
    sperre.waitLock(ms || 20000);
    return sperre;
  } catch (err) {
    return null;
  }
}

function triggerLoeschen_(funktion) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === funktion) ScriptApp.deleteTrigger(t);
  });
}

// Schutz vor Formeln: Zellen, die mit = + - @ beginnen, würden als Formel gelesen
function text_(wert, max) {
  let t = String(wert == null ? '' : wert).trim().slice(0, max);
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}

function seite_(titel, text) {
  const html =
    '<!DOCTYPE html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:Arial,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;color:#151515;line-height:1.5}' +
    'h1{font-size:24px}a{color:#C8141B}</style></head><body><h1>' + titel + '</h1><p>' + text + '</p>' +
    '<p><a href="' + SEITE + '">Zur Website</a></p></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(titel);
}

function antwort_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
