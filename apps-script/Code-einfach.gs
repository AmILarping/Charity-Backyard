/**
 * Charity Backyard Bad Vilbel 2027 – einfache Anmeldung (ohne Zahlung)
 *
 * Gehört in die Google-Tabelle „Backyard 2027“ (Erweiterungen → Apps Script)
 * und wird als Web-App bereitgestellt. Jede Anmeldung wird als neue Zeile im
 * Blatt „Anmeldungen“ gespeichert. Das Blatt wird automatisch angelegt.
 */

const BLATT = 'Anmeldungen';
const KOPF = ['Zeitstempel', 'Vorname', 'Nachname', 'E-Mail', 'Status'];
const MAX_ZEILEN = 3000; // Schutz gegen massenhafte Einträge

function doGet() {
  return antwort_({ ok: true });
}

function doPost(e) {
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return antwort_({ ok: false, message: 'Die Anfrage konnte nicht gelesen werden.' });
  }
  if (!d || d.action !== 'anmelden') return antwort_({ ok: false, message: 'Unbekannte Aktion.' });

  // Spam-Falle: Das versteckte Feld muss leer bleiben. Bots bekommen „Erfolg“, es wird nichts gespeichert.
  if (d.website) return antwort_({ ok: true });

  const vorname = text_(d.vorname, 60);
  const nachname = text_(d.nachname, 60);
  const email = text_(d.email, 120).toLowerCase();
  if (!vorname || !nachname) return antwort_({ ok: false, message: 'Bitte gib Vor- und Nachnamen ein.' });
  if (!/^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    return antwort_({ ok: false, message: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  }
  if (d.bedingungen !== true || d.datenschutz !== true) {
    return antwort_({ ok: false, message: 'Bitte bestätige die Teilnahmebedingungen und die Datenschutzerklärung.' });
  }

  const sperre = LockService.getScriptLock();
  try {
    sperre.waitLock(20000);
  } catch (err) {
    return antwort_({ ok: false, message: 'Gerade ist viel los. Bitte versuche es in einem Moment erneut.' });
  }
  try {
    const blatt = blatt_();
    const zeilen = blatt.getLastRow();
    if (zeilen >= MAX_ZEILEN) return antwort_({ ok: false, message: 'Die Anmeldung ist gerade nicht möglich.' });

    if (zeilen > 1) {
      const bekannt = blatt.getRange(2, 4, zeilen - 1, 1).getValues().map(function (r) {
        return String(r[0]).toLowerCase();
      });
      if (bekannt.indexOf(email) !== -1) {
        return antwort_({ ok: false, message: 'Mit dieser E-Mail-Adresse gibt es schon eine Anmeldung.' });
      }
    }
    blatt.appendRow([new Date(), vorname, nachname, email, 'angemeldet']);
    SpreadsheetApp.flush();
    return antwort_({ ok: true });
  } catch (err) {
    console.error(err);
    return antwort_({ ok: false, message: 'Es ist ein Fehler aufgetreten. Bitte versuche es in ein paar Minuten erneut.' });
  } finally {
    sperre.releaseLock();
  }
}

function blatt_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let blatt = ss.getSheetByName(BLATT);
  if (!blatt) {
    blatt = ss.insertSheet(BLATT);
  }
  if (blatt.getLastRow() === 0) {
    blatt.appendRow(KOPF);
    blatt.getRange(1, 1, 1, KOPF.length).setFontWeight('bold');
    blatt.setFrozenRows(1);
  }
  return blatt;
}

// Schutz vor Formeln: Zellen, die mit = + - @ beginnen, würden als Formel gelesen
function text_(wert, max) {
  let t = String(wert == null ? '' : wert).trim().slice(0, max);
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}

function antwort_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Zum Testen im Apps-Script-Editor: legt eine Testzeile an und löscht sie wieder.
function test() {
  const blatt = blatt_();
  blatt.appendRow([new Date(), 'Test', 'Test', 'test@example.com', 'TEST']);
  blatt.deleteRow(blatt.getLastRow());
  console.log('Blatt „' + BLATT + '“ funktioniert.');
}
