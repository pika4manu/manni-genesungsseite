require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'storage', 'db.json');
const MAX_TEXT_LENGTH = 600;

// Extrem toleranter Spamschutz: Honigtopf-Feld + Mindestabstand von 8 Sekunden pro IP
const SPAM_HONIGTOPF = 'homepage';
const MINDEST_ABSTAND_MS = 8 * 1000;
const letzterWunsch = new Map(); // IP → Zeitpunkt des letzten gespeicherten Wunsches

setInterval(function () {
  const jetzt = Date.now();
  for (const [ip, zeit] of letzterWunsch) {
    if (jetzt - zeit > MINDEST_ABSTAND_MS) letzterWunsch.delete(ip);
  }
}, 60 * 1000).unref();

// Passwort für den geheimen Verwaltungsbereich /admin (steht in der .env)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123';
const ADMIN_SESSION_DAUER = 2 * 60 * 60 * 1000; // 2 Stunden
const ADMIN_MAX_VERSUCHE = 5;
const ADMIN_SPERRZEIT = 5 * 60 * 1000; // 5 Minuten nach zu vielen Fehlversuchen

// Die "Posits" sind die gelben Blätter, auf die die Wünsche geschrieben werden.
// textBereich beschreibt, wo auf dem Blatt freie Fläche für den Text ist.
// schriftFaktor legt die Schriftgröße fest (in % der Blattbreite).
const POSIT_BILDER = [
  {
    url: '/img/posit/1.png',
    breite: 200,
    hoehe: 223,
    textBereich: { links: '11%', rechts: '9%', oben: '25%', unten: '15%' },
    schriftFaktor: 8
  },
  {
    url: '/img/posit/2.png',
    breite: 282,
    hoehe: 300,
    textBereich: { links: '13%', rechts: '9%', oben: '17%', unten: '20%' },
    schriftFaktor: 7.8
  },
  {
    url: '/img/posit/3.png',
    breite: 500,
    hoehe: 354,
    textBereich: { links: '24%', rechts: '23%', oben: '17%', unten: '13%' },
    schriftFaktor: 5.3
  }
];

// --- EJS als Template-Engine einrichten ---
// Seiten liegen in ./views, die EJS-Resources (Partials) in ./views/resources
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Statische Dateien (Bilder, CSS, JS) aus ./public
app.use(express.static(path.join(__dirname, 'public')));

// Formulardaten entgegennehmen (POST /wuensche)
app.use(express.urlencoded({ extended: true }));

// --- Datenzugriff auf storage/db.json ---
function readEintraege() {
  try {
    const rohdaten = fs.readFileSync(DB_FILE, 'utf8').trim();
    if (!rohdaten) return [];

    const daten = JSON.parse(rohdaten);
    if (Array.isArray(daten)) return daten;
    if (Array.isArray(daten.eintraege)) return daten.eintraege;
    return [];
  } catch (fehler) {
    console.error('db.json konnte nicht gelesen werden:', fehler.message);
    return [];
  }
}

function writeEintraege(eintraege) {
  fs.writeFileSync(DB_FILE, JSON.stringify(eintraege, null, 2), 'utf8');
}

function sortiereNachDatum(eintraege) {
  return eintraege.slice().sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

// Die Pinnwand ist eine große Karte. Positionen werden in Prozent (0–100) gespeichert.
function zahl(wert, min, max, ersatz) {
  const n = Number(wert);
  if (!Number.isFinite(n)) return ersatz;
  return Math.min(max, Math.max(min, n));
}

// Deterministische Ersatzposition für alte Einträge ohne gespeicherte Koordinaten
function ersatzPosition(index, gesamt) {
  const spalten = Math.max(2, Math.min(7, Math.ceil(Math.sqrt(Math.max(gesamt, 1) * 1.8))));
  const zeilen = Math.max(1, Math.ceil(gesamt / spalten));
  const spalte = index % spalten;
  const zeile = Math.floor(index / spalten);
  const streuungX = (((index * 37) % 13) - 6) * 0.7;
  const streuungY = (((index * 53) % 11) - 5) * 0.9;

  return {
    x: zahl(7 + ((spalte + 0.5) / spalten) * 86 + streuungX, 5, 95, 50),
    y: zahl(10 + ((zeile + 0.5) / zeilen) * 80 + streuungY, 6, 94, 50)
  };
}

// Einträge laden; Einträge ohne x/y bekommen einmalig eine feste Position
function ladeEintraege() {
  const eintraege = readEintraege();
  let geaendert = false;

  eintraege.forEach(function (eintrag, index) {
    if (!Number.isFinite(Number(eintrag.x)) || !Number.isFinite(Number(eintrag.y))) {
      const position = ersatzPosition(index, eintraege.length);
      eintrag.x = position.x;
      eintrag.y = position.y;
      geaendert = true;
    }
  });

  if (geaendert) {
    try {
      writeEintraege(eintraege);
    } catch (fehler) {
      console.error('Positionen konnten nicht gespeichert werden:', fehler.message);
    }
  }

  return eintraege;
}

// Einem Eintrag die Daten des passenden Posits mitgeben (Bild, Seitenverhältnis, Textfläche)
function mitPositDaten(eintrag) {
  const posit =
    POSIT_BILDER.find((bild) => bild.url === eintrag.image) || POSIT_BILDER[0];

  return Object.assign({}, eintrag, {
    image: posit.url,
    bildIndex: POSIT_BILDER.indexOf(posit) + 1,
    aspect: Number((posit.breite / posit.hoehe).toFixed(4)),
    textBereich: posit.textBereich,
    schriftFaktor: posit.schriftFaktor,
    x: zahl(eintrag.x, 0, 100, 50),
    y: zahl(eintrag.y, 0, 100, 50)
  });
}

// --- Routen ---
app.get('/', (req, res) => {
  res.render('index', {
    eintraege: sortiereNachDatum(ladeEintraege()).map(mitPositDaten),
    fehler: req.query.fehler || null,
    textVorbelegt: req.query.text || null,
    posX: req.query.x != null ? zahl(req.query.x, 0, 100, null) : null,
    posY: req.query.y != null ? zahl(req.query.y, 0, 100, null) : null,
    neuId: req.query.neu || null,
    titel: 'Meine Genesungsseite'
  });
});

// Neuen Wunsch aufschreiben und an die Pinnwand hängen
app.post('/wuensche', (req, res) => {
  // Honigtopf gefüllt → vermutlich Bot: tun, als wäre alles in Ordnung, nichts speichern
  if ((req.body[SPAM_HONIGTOPF] || '').toString().trim() !== '') {
    return res.redirect('/');
  }

  const text = (req.body.text || '').toString().trim();
  const x = zahl(req.body.x, 0, 100, 50);
  const y = zahl(req.body.y, 0, 100, 50);

  if (!text) {
    return res.redirect('/?fehler=leer');
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.redirect(
      '/?fehler=zu-lang&text=' + encodeURIComponent(text) +
      '&x=' + encodeURIComponent(x) + '&y=' + encodeURIComponent(y)
    );
  }

  // Mindestabstand pro IP – schützt vor massenhaften Abgaben, stört aber niemanden
  const jetzt = Date.now();
  const letztes = letzterWunsch.get(req.ip) || 0;
  if (jetzt - letztes < MINDEST_ABSTAND_MS) {
    return res.redirect(
      '/?fehler=zu-schnell&text=' + encodeURIComponent(text) +
      '&x=' + encodeURIComponent(x) + '&y=' + encodeURIComponent(y)
    );
  }

  const eintraege = ladeEintraege();
  // Jeder neue Wunsch landet auf dem nächsten freien Posit
  const posit = POSIT_BILDER[eintraege.length % POSIT_BILDER.length];
  const eintrag = {
    id: crypto.randomUUID(),
    text: text,
    image: posit.url,
    createdAt: new Date().toISOString(),
    x: x,
    y: y
  };

  eintraege.push(eintrag);

  try {
    writeEintraege(eintraege);
    letzterWunsch.set(req.ip, jetzt);
  } catch (fehler) {
    console.error('db.json konnte nicht gespeichert werden:', fehler.message);
    return res.redirect(
      '/?fehler=speicher&text=' + encodeURIComponent(text) +
      '&x=' + encodeURIComponent(x) + '&y=' + encodeURIComponent(y)
    );
  }

  // Direkt zur neuen Kartenstelle springen
  res.redirect('/?neu=' + encodeURIComponent(eintrag.id));
});

// JSON-Schnittstelle, falls die Pinnwand später live aktualisiert werden soll
app.get('/api/wuensche', (req, res) => {
  res.json(sortiereNachDatum(ladeEintraege()).map(mitPositDaten));
});

// Der Verwaltungsbereich soll nicht in Suchmaschinen landen
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /admin\nDisallow: /api\n');
});

// --- Geheimer Verwaltungsbereich /admin ---
// Wird bewusst nicht in der Navigation verlinkt.
const adminSessions = new Map();
const adminFehlversuche = new Map();

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach((teil) => {
    const trenner = teil.indexOf('=');
    if (trenner === -1) return;
    cookies[teil.slice(0, trenner).trim()] = decodeURIComponent(
      teil.slice(trenner + 1).trim()
    );
  });
  return cookies;
}

function adminAngemeldet(req) {
  const token = parseCookies(req).admin_session;
  if (!token) return false;

  const sitzung = adminSessions.get(token);
  if (!sitzung) return false;

  if (sitzung.laufzeitBis < Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

function passwortPasst(eingabe) {
  const hashEingabe = crypto.createHash('sha256').update(String(eingabe)).digest();
  const hashPasswort = crypto.createHash('sha256').update(String(ADMIN_PASSWORD)).digest();
  return crypto.timingSafeEqual(hashEingabe, hashPasswort);
}

function adminGesperrt(ip) {
  const eintrag = adminFehlversuche.get(ip);
  if (!eintrag) return false;
  if (eintrag.bis < Date.now()) {
    adminFehlversuche.delete(ip);
    return false;
  }
  return true;
}

function fehlversuchNotieren(ip) {
  const eintrag = adminFehlversuche.get(ip) || { anzahl: 0, bis: 0 };
  eintrag.anzahl += 1;

  if (eintrag.anzahl >= ADMIN_MAX_VERSUCHE) {
    eintrag.bis = Date.now() + ADMIN_SPERRZEIT;
    eintrag.anzahl = 0;
  }

  adminFehlversuche.set(ip, eintrag);
}

// Anmeldung
app.post('/admin/login', (req, res) => {
  const ip = req.ip;

  if (adminGesperrt(ip)) {
    return res.redirect('/admin?fehler=gesperrt');
  }

  if (!passwortPasst(req.body.passwort)) {
    fehlversuchNotieren(ip);
    return res.redirect('/admin?fehler=falsch');
  }

  adminFehlversuche.delete(ip);

  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, { laufzeitBis: Date.now() + ADMIN_SESSION_DAUER });

  res.cookie('admin_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_DAUER,
    path: '/'
  });

  res.redirect('/admin');
});

// Abmeldung
app.post('/admin/logout', (req, res) => {
  const token = parseCookies(req).admin_session;
  if (token) adminSessions.delete(token);

  res.clearCookie('admin_session', { path: '/' });
  res.redirect('/admin');
});

// Übersicht mit allen Wünschen (nur für Angemeldete)
app.get('/admin', (req, res) => {
  const angemeldet = adminAngemeldet(req);

  res.render('admin', {
    titel: 'Verwaltung',
    angemeldet: angemeldet,
    loginFehler: req.query.fehler || null,
    eintraege: angemeldet ? sortiereNachDatum(ladeEintraege()).map(mitPositDaten) : []
  });
});

// Wunsch im Verwaltungsbereich löschen
app.post('/admin/eintraege/:id/loeschen', (req, res) => {
  if (!adminAngemeldet(req)) {
    return res.redirect('/admin');
  }

  const eintraege = readEintraege().filter(
    (eintrag) => eintrag.id !== req.params.id
  );

  try {
    writeEintraege(eintraege);
  } catch (fehler) {
    console.error('db.json konnte nicht gespeichert werden:', fehler.message);
  }

  res.redirect('/admin');
});

// Seite nicht gefunden
app.use((req, res) => {
  res.status(404).render('404', {
    titel: 'Seite nicht gefunden',
    fehler: null
  });
});

app.listen(PORT, () => {
  console.log(`Genesungsseite läuft auf http://localhost:${PORT}`);
});
