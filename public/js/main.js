(function () {
  'use strict';

  var urlParameter = new URLSearchParams(window.location.search);

  // Von den Init-Funktionen gefüllt (für Austausch zwischen den Bausteinen)
  var karteApi = { flug: null };

  // ---------- Fehlermeldungen ----------
  var FEHLER_TEXTE = {
    leer: 'Bitte schreibe zuerst einen Wunsch auf.',
    'zu-lang': 'Der Wunsch ist zu lang. Maximal 600 Zeichen sind erlaubt.',
    'zu-schnell':
      'Bitte kurz warten – du kannst deinen Wunsch gleich noch einmal anhängen.',
    speicher:
      'Der Wunsch konnte nicht gespeichert werden. Bitte versuche es noch einmal.'
  };

  function zeigeFormularFehler(code) {
    var box = document.getElementById('formular-fehler');
    if (!box) return;
    box.textContent = FEHLER_TEXTE[code] || FEHLER_TEXTE.speicher;
    box.hidden = false;
  }

  function versteckeFormularFehler() {
    var box = document.getElementById('formular-fehler');
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
  }

  // ---------- Pop-ups ----------
  function oeffneDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', 'open');
    }

    if (dialog.id === 'wunsch-dialog') {
      versteckeFormularFehler();
    }

    var feld = dialog.querySelector('textarea');
    if (feld) {
      feld.focus();
    }
  }

  function schliesseDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  document.querySelectorAll('[data-dialog-oeffnen]').forEach(function (knopf) {
    knopf.addEventListener('click', function () {
      oeffneDialog(document.getElementById(knopf.dataset.dialogOeffnen));
    });
  });

  document.querySelectorAll('[data-dialog-schliessen]').forEach(function (knopf) {
    knopf.addEventListener('click', function () {
      schliesseDialog(document.getElementById(knopf.dataset.dialogSchliessen));
    });
  });

  // Klick auf den Hintergrund des Pop-ups schließt es
  document.querySelectorAll('dialog').forEach(function (dialog) {
    dialog.addEventListener('click', function (ereignis) {
      if (ereignis.target === dialog) {
        schliesseDialog(dialog);
      }
    });
  });

  // Nach einem Fehler (ohne JavaScript) das Pop-up direkt wieder öffnen
  if (urlParameter.get('fehler')) {
    oeffneDialog(document.getElementById('wunsch-dialog'));
  }

  // ---------- Zeichen zählen ----------
  var feld = document.getElementById('text');
  var stand = document.getElementById('zeichenzaehler-stand');

  function aktualisiereZaehler() {
    if (feld && stand) {
      stand.textContent = String(feld.value.length);
    }
  }

  if (feld && stand) {
    // Text nach einem Speicherfehler wiederherstellen
    var vorbehalterText = urlParameter.get('text');
    if (vorbehalterText) {
      feld.value = vorbehalterText;
    }

    feld.addEventListener('input', function () {
      aktualisiereZaehler();
      versteckeFormularFehler();
    });
    aktualisiereZaehler();
  }

  // ---------- Zu lange Wünsche: Klick öffnet das Blatt zum Lesen ----------
  var positDialog = document.getElementById('posit-dialog');
  var positBlatt = positDialog ? positDialog.querySelector('.posit-blatt') : null;
  var positText = positDialog ? positDialog.querySelector('.notiz-text-inhalt') : null;

  // Die Schrift so weit verkleinern, dass der ganze Text auf das Blatt passt
  function passeSchriftAnBlatt() {
    if (!positBlatt || !positText) return;

    var bereich = positText.closest('.notiz-text-bereich');
    if (!bereich) return;

    var stil = window.getComputedStyle(positText);
    var groesse = parseFloat(stil.fontSize) || 16;

    positText.style.fontSize = '';
    while (
      positText.scrollHeight > bereich.clientHeight + 2 &&
      groesse > 9
    ) {
      groesse -= 1;
      positText.style.fontSize = groesse + 'px';
    }
  }

  function zeigePosit(notiz) {
    if (!positDialog || !positBlatt || !positText) return;
    if (positDialog.open) return; // das Blatt ist schon offen
    if (!notiz || !notiz.querySelector('.notiz-text-inhalt')) return;

    var stil = window.getComputedStyle(notiz);
    var eigenschaften = [
      '--bild',
      '--aspect',
      '--text-links',
      '--text-rechts',
      '--text-oben',
      '--text-unten'
    ];

    eigenschaften.forEach(function (name) {
      positBlatt.style.setProperty(name, stil.getPropertyValue(name));
    });

    positText.textContent = notiz.querySelector('.notiz-text-inhalt').textContent;
    oeffneDialog(positDialog);
    passeSchriftAnBlatt();
  }

  window.addEventListener('resize', function () {
    if (positDialog && positDialog.open) {
      passeSchriftAnBlatt();
    }
  });

  // Jeder Wunsch lässt sich antippen und zeigt dann das ganze Blatt
  function notizKlickbarMachen(notiz) {
    if (!notiz || notiz.dataset.klickbar === 'ja') return;
    notiz.dataset.klickbar = 'ja';

    notiz.addEventListener('click', function () {
      zeigePosit(notiz);
    });

    notiz.addEventListener('keydown', function (ereignis) {
      if (ereignis.key === 'Enter' || ereignis.key === ' ') {
        ereignis.preventDefault();
        zeigePosit(notiz);
      }
    });

    notiz.setAttribute('tabindex', '0');
    notiz.setAttribute('role', 'button');
    notiz.setAttribute('aria-label', 'Wunsch vollständig lesen');
  }

  // Passt der Text nicht auf das Blatt, gibt es einen „Mehr lesen“-Klick
  function starteUeberlaufPruefung(notiz) {
    var text = notiz.querySelector('.notiz-text-inhalt');
    if (!text) return;

    var bereich = text.closest('.notiz-text-bereich');
    if (!bereich) return;

    var ueberlauf =
      text.scrollHeight > text.offsetHeight + 2 ||
      text.scrollHeight > bereich.clientHeight + 2;

    notizKlickbarMachen(notiz);

    if (!ueberlauf) return;

    notiz.classList.add('ist-zu-lang');

    var knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'notiz-mehr';
    knopf.textContent = 'Mehr lesen';
    knopf.setAttribute('aria-label', 'Wunsch vollständig lesen');

    var meta = notiz.querySelector('.notiz-meta');
    if (meta) {
      meta.appendChild(knopf);
    } else {
      notiz.appendChild(knopf);
    }

    knopf.addEventListener('click', function (ereignis) {
      ereignis.stopPropagation();
      zeigePosit(notiz);
    });
  }

  document.querySelectorAll('.notiz').forEach(starteUeberlaufPruefung);

  // ---------- Wunsch absenden, ohne die Seite neu zu laden ----------
  function baueNotiz(eintrag, drehung) {
    var notiz = document.createElement('article');
    notiz.className = 'notiz notiz--' + eintrag.bildIndex;
    notiz.setAttribute('role', 'listitem');
    notiz.dataset.id = eintrag.id;

    notiz.style.setProperty('--drehung', drehung + 'deg');
    notiz.style.setProperty('--bild', 'url("' + eintrag.image + '")');
    notiz.style.setProperty('--aspect', String(eintrag.aspect));
    notiz.style.setProperty('--schrift', eintrag.schriftFaktor + 'cqw');
    notiz.style.setProperty('--text-links', eintrag.textBereich.links);
    notiz.style.setProperty('--text-rechts', eintrag.textBereich.rechts);
    notiz.style.setProperty('--text-oben', eintrag.textBereich.oben);
    notiz.style.setProperty('--text-unten', eintrag.textBereich.unten);
    notiz.style.left = eintrag.x + '%';
    notiz.style.top = eintrag.y + '%';

    var bereich = document.createElement('div');
    bereich.className = 'notiz-text-bereich';
    var absatz = document.createElement('p');
    absatz.className = 'notiz-text';
    var inhalt = document.createElement('span');
    inhalt.className = 'notiz-text-inhalt';
    inhalt.textContent = eintrag.text;
    absatz.appendChild(inhalt);
    bereich.appendChild(absatz);
    notiz.appendChild(bereich);

    var meta = document.createElement('div');
    meta.className = 'notiz-meta';
    var zeit = document.createElement('time');
    zeit.dateTime = eintrag.createdAt;
    zeit.textContent = new Date(eintrag.createdAt).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    meta.appendChild(zeit);
    notiz.appendChild(meta);

    return notiz;
  }

  function aktualisiereWunschAnzahl(anzahl) {
    var text = document.querySelector('.pinnwand-ueberschrift .abschnitt-text');
    if (!text) return;
    text.textContent =
      anzahl +
      ' ' +
      (anzahl === 1 ? 'Wunsch' : 'Wünsche') +
      ' für Manfred hängen gerade an der Wand.';
  }

  function haengeAnWand(eintrag) {
    var welt = document.getElementById('pinnwand-welt');
    if (!welt) return;

    var leerText = welt.querySelector('.pinnwand-leer');
    if (leerText) {
      leerText.parentNode.removeChild(leerText);
    }

    var vorhanden = welt.querySelectorAll('.notiz').length;
    var drehungen = [-3, 2.5, -1.5, 4, -4.5, 1.5, 3.5, -2.5, 2, -3.5];
    var notiz = baueNotiz(eintrag, drehungen[vorhanden % drehungen.length]);
    notiz.classList.add('ist-neu');
    welt.appendChild(notiz);

    starteUeberlaufPruefung(notiz);
    aktualisiereWunschAnzahl(vorhanden + 1);

    // Kamera sanft zur neuen Stelle fliegen
    if (karteApi.flug) {
      karteApi.flug(eintrag.x, eintrag.y, 0.9);
    }
  }

  function initFormularAbsenden() {
    var formular = document.querySelector('#wunsch-dialog form');
    if (!formular || !window.fetch) return;

    var dialog = document.getElementById('wunsch-dialog');
    var absendenKnopf = formular.querySelector('button[type="submit"]');

    formular.addEventListener('submit', function (ereignis) {
      ereignis.preventDefault();

      var knopfText = absendenKnopf.textContent;
      absendenKnopf.disabled = true;
      absendenKnopf.textContent = 'Wird angepinnt …';
      versteckeFormularFehler();

      fetch(formular.action, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams(new FormData(formular))
      })
        .then(function (antwort) {
          return antwort.json();
        })
        .then(function (daten) {
          absendenKnopf.disabled = false;
          absendenKnopf.textContent = knopfText;

          if (!daten.ok) {
            zeigeFormularFehler(daten.fehler);
            return;
          }

          schliesseDialog(dialog);

          if (feld) {
            feld.value = '';
            aktualisiereZaehler();
          }

          if (daten.eintrag) {
            haengeAnWand(daten.eintrag);
          }
        })
        .catch(function () {
          absendenKnopf.disabled = false;
          absendenKnopf.textContent = knopfText;
          zeigeFormularFehler('speicher');
        });
    });
  }

  // ---------- Karte: Schwenken & Zoomen ----------
  function initKarte() {
    var viewport = document.getElementById('pinnwand-viewport');
    var welt = document.getElementById('pinnwand-welt');
    if (!viewport || !welt) return;

    var MIN_ZOOM = 0.1;
    var MAX_ZOOM = 2.5;
    var RAND = 60;
    var PAN_SCHWELLE = 10; // erst ab dieser Bewegung gilt es als Schwenken

    // Auf kleinen Bildschirmen wird die Wand kleiner gerechnet – die Wünsche
    // wirken dadurch größer und sind besser zu lesen
    function weltMasse() {
      var klein = window.innerWidth <= 720;
      var faktor = klein ? 0.75 : 1;
      return {
        breite: (parseFloat(viewport.dataset.weltBreite) || 3200) * faktor,
        hoehe: (parseFloat(viewport.dataset.weltHoehe) || 2100) * faktor
      };
    }

    var masse = weltMasse();
    var weltBreite = masse.breite;
    var weltHoehe = masse.hoehe;

    function setzeWeltGroesse() {
      welt.style.setProperty('--welt-breite', weltBreite + 'px');
      welt.style.setProperty('--welt-hoehe', weltHoehe + 'px');
      // Für den Viewport nötig: dort läuft die Textur in Weltkoordinaten weiter
      viewport.style.setProperty('--welt-breite', weltBreite + 'px');
      viewport.style.setProperty('--welt-hoehe', weltHoehe + 'px');
    }

    setzeWeltGroesse();

    var kamera = { x: 0, y: 0, zoom: 0.5 };
    var hinweis = document.getElementById('karte-hinweis');
    var hatGepannt = false;
    var klickSperre = false;
    var flugNummer = 0;

    // Wischen auf dem Handy soll sich wie eine echte Karte anfühlen
    var tempoX = 0;
    var tempoY = 0;
    var traegheitNummer = 0;
    var letzteFinger = { x: 0, y: 0 };
    var letzteZeit = 0;
    var letzterTipp = { zeit: 0, x: 0, y: 0 };
    var startZiel = null;

    function begrenzeKamera() {
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      var ww = weltBreite * kamera.zoom;
      var wh = weltHoehe * kamera.zoom;

      if (ww <= vw) {
        kamera.x = (vw - ww) / 2;
      } else {
        kamera.x = Math.min(RAND, Math.max(vw - ww - RAND, kamera.x));
      }

      if (wh <= vh) {
        kamera.y = (vh - wh) / 2;
      } else {
        kamera.y = Math.min(RAND, Math.max(vh - wh - RAND, kamera.y));
      }
    }

    function zeichneKamera() {
      welt.style.transform =
        'translate(' + kamera.x + 'px, ' + kamera.y + 'px) scale(' + kamera.zoom + ')';

      // Die Korktextur des Viewports wird exakt an der Welt ausgerichtet,
      // damit sie über den Weltrand hinaus nahtlos weiterläuft
      viewport.style.setProperty('--kamera-x', kamera.x + 'px');
      viewport.style.setProperty('--kamera-y', kamera.y + 'px');
      viewport.style.setProperty('--kamera-zoom', kamera.zoom);
    }

    function setzeZoom(bildX, bildY, neueZoom) {
      var weltX = (bildX - kamera.x) / kamera.zoom;
      var weltY = (bildY - kamera.y) / kamera.zoom;

      kamera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, neueZoom));
      kamera.x = bildX - weltX * kamera.zoom;
      kamera.y = bildY - weltY * kamera.zoom;

      begrenzeKamera();
      zeichneKamera();
    }

    // Kamerazustand berechnen, ohne die laufende Ansicht zu verändern
    function zielKamera(wxProzent, wyProzent, zoom) {
      var alt = { x: kamera.x, y: kamera.y, zoom: kamera.zoom };

      kamera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
      kamera.x = viewport.clientWidth / 2 - (wxProzent / 100) * weltBreite * kamera.zoom;
      kamera.y = viewport.clientHeight / 2 - (wyProzent / 100) * weltHoehe * kamera.zoom;
      begrenzeKamera();

      var ziel = { x: kamera.x, y: kamera.y, zoom: kamera.zoom };
      kamera.x = alt.x;
      kamera.y = alt.y;
      kamera.zoom = alt.zoom;
      return ziel;
    }

    function setzeKamera(ziel) {
      kamera.x = ziel.x;
      kamera.y = ziel.y;
      kamera.zoom = ziel.zoom;
      zeichneKamera();
    }

    function zentriereAuf(wxProzent, wyProzent, zoom) {
      setzeKamera(zielKamera(wxProzent, wyProzent, zoom));
    }

    // Sanfter Flug zu einer Kartenstelle (wird aus dem Formular heraus aufgerufen)
    function flugHin(wxProzent, wyProzent, zoom) {
      stoppeTraegheit();
      var von = { x: kamera.x, y: kamera.y, zoom: kamera.zoom };
      var ziel = zielKamera(wxProzent, wyProzent, zoom);

      flugNummer += 1;
      var nummer = flugNummer;

      var reduziert = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

      if (reduziert) {
        setzeKamera(ziel);
        return;
      }

      var start = performance.now();

      function schritt(zeit) {
        if (nummer !== flugNummer) return; // vom Nutzer unterbrochen
        var p = Math.min(1, (zeit - start) / 600);
        var e = 1 - Math.pow(1 - p, 3);

        kamera.x = von.x + (ziel.x - von.x) * e;
        kamera.y = von.y + (ziel.y - von.y) * e;
        kamera.zoom = von.zoom + (ziel.zoom - von.zoom) * e;
        zeichneKamera();

        if (p < 1) {
          requestAnimationFrame(schritt);
        }
      }

      requestAnimationFrame(schritt);
    }

    karteApi.flug = flugHin;

    // ---------- Trägheit beim Wischen ----------
    function stoppeTraegheit() {
      traegheitNummer += 1;
      tempoX = 0;
      tempoY = 0;
    }

    function starteTraegheit() {
      if (Math.abs(tempoX) < 0.08 && Math.abs(tempoY) < 0.08) return;

      traegheitNummer += 1;
      var nummer = traegheitNummer;
      var zeit = performance.now();

      function schritt(jetzt) {
        if (nummer !== traegheitNummer) return;

        var dauer = Math.min(34, jetzt - zeit);
        zeit = jetzt;

        kamera.x += tempoX * dauer;
        kamera.y += tempoY * dauer;

        var bremsung = Math.pow(0.93, dauer / 16);
        tempoX *= bremsung;
        tempoY *= bremsung;

        begrenzeKamera();
        zeichneKamera();

        if (Math.abs(tempoX) > 0.02 || Math.abs(tempoY) > 0.02) {
          requestAnimationFrame(schritt);
        }
      }

      requestAnimationFrame(schritt);
    }

    // ---------- Doppeltipp: hinein- oder herauszoomen ----------
    function registriereTipp(x, y) {
      var jetzt = performance.now();

      if (jetzt - letzterTipp.zeit < 320) {
        letzterTipp.zeit = 0;

        var weltX = (x - kamera.x) / kamera.zoom;
        var weltY = (y - kamera.y) / kamera.zoom;

        if (kamera.zoom < 0.8) {
          flugHin((weltX / weltBreite) * 100, (weltY / weltHoehe) * 100, 1.4);
        } else {
          var passend =
            Math.min(
              viewport.clientWidth / weltBreite,
              viewport.clientHeight / weltHoehe
            ) * 0.95;
          flugHin(50, 50, passend);
        }
        return;
      }

      letzterTipp = { zeit: jetzt, x: x, y: y };
    }

    function versteckeHinweis() {
      if (hinweis) hinweis.hidden = true;
    }

    // Startansicht: die ganze Wand im Bild – wie beim Button "Übersicht"
    var startZoom =
      Math.min(viewport.clientWidth / weltBreite, viewport.clientHeight / weltHoehe) *
      0.95;

    var neuId = urlParameter.get('neu');
    var neueNotiz = neuId
      ? welt.querySelector('.notiz[data-id="' + neuId + '"]')
      : null;

    if (neueNotiz) {
      // Ein neuer Wunsch wird gezielt gezeigt
      zentriereAuf(
        parseFloat(neueNotiz.style.left) || 50,
        parseFloat(neueNotiz.style.top) || 50,
        0.9
      );
    } else {
      // Sonst startet die Seite in der Übersicht
      zentriereAuf(50, 50, startZoom);
    }

    // --- Maus & Touch: Ziehen zum Schwenken, Pinch zum Zoomen ---
    var zeiger = new Map();
    var startMaus = null;
    var startKamera = null;
    var pinchnStartAbstand = 0;
    var pinchnStartZoom = 1;
    var pinchnStartMitte = null;

    function abstand(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function mitte(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    viewport.addEventListener('pointerdown', function (ereignis) {
      if (ereignis.pointerType === 'mouse' && ereignis.button !== 0) return;

      flugNummer += 1; // laufenden Flug abbrechen
      stoppeTraegheit();

      // Wichtig: der Zeiger wird hier noch NICHT gefangen – sonst landet
      // der Klick auf der Karte statt auf dem Wunsch darunter
      zeiger.set(ereignis.pointerId, { x: ereignis.clientX, y: ereignis.clientY });
      hatGepannt = false;
      klickSperre = false;
      versteckeHinweis();

      letzteFinger = { x: ereignis.clientX, y: ereignis.clientY };
      letzteZeit = performance.now();
      tempoX = 0;
      tempoY = 0;
      startZiel = ereignis.target;

      if (zeiger.size === 1) {
        startMaus = { x: ereignis.clientX, y: ereignis.clientY };
        startKamera = { x: kamera.x, y: kamera.y };
      } else if (zeiger.size === 2) {
        var liste = Array.from(zeiger.values());
        pinchnStartAbstand = abstand(liste[0], liste[1]);
        pinchnStartZoom = kamera.zoom;
        pinchnStartMitte = mitte(liste[0], liste[1]);
        startKamera = { x: kamera.x, y: kamera.y };
      }
    });

    viewport.addEventListener('pointermove', function (ereignis) {
      if (!zeiger.has(ereignis.pointerId)) return;

      zeiger.set(ereignis.pointerId, { x: ereignis.clientX, y: ereignis.clientY });

      if (zeiger.size === 1 && startMaus && startKamera) {
        var jetzt = performance.now();
        var dauer = Math.max(1, jetzt - letzteZeit);
        tempoX = (ereignis.clientX - letzteFinger.x) / dauer;
        tempoY = (ereignis.clientY - letzteFinger.y) / dauer;
        letzteFinger = { x: ereignis.clientX, y: ereignis.clientY };
        letzteZeit = jetzt;

        var dx = ereignis.clientX - startMaus.x;
        var dy = ereignis.clientY - startMaus.y;

        // Erst ab einer deutlicheren Bewegung wird die Karte geschwenkt –
        // so bleibt ein Tippen auf einen Wunsch ein Tippen und kein Schwenken
        if (!hatGepannt) {
          if (Math.hypot(dx, dy) <= PAN_SCHWELLE) return;

          hatGepannt = true;

          // Erst jetzt den Zeiger fangen, damit das Schwenken auch weiterläuft,
          // wenn der Finger den Rand der Karte verlässt
          try {
            viewport.setPointerCapture(ereignis.pointerId);
          } catch (fehler) {
            // Manche Browser verweigern das Fangen – das Schwenken klappt trotzdem
          }

          startMaus = { x: ereignis.clientX, y: ereignis.clientY };
          startKamera = { x: kamera.x, y: kamera.y };
          dx = 0;
          dy = 0;
        }

        kamera.x = startKamera.x + dx;
        kamera.y = startKamera.y + dy;
        begrenzeKamera();
        zeichneKamera();
      } else if (zeiger.size === 2 && pinchnStartAbstand > 0) {
        var liste = Array.from(zeiger.values());
        var jetztAbstand = abstand(liste[0], liste[1]);
        var jetztMitte = mitte(liste[0], liste[1]);
        var rect = viewport.getBoundingClientRect();
        var neuerZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, pinchnStartZoom * (jetztAbstand / pinchnStartAbstand))
        );

        var weltX = (pinchnStartMitte.x - rect.left - startKamera.x) / pinchnStartZoom;
        var weltY = (pinchnStartMitte.y - rect.top - startKamera.y) / pinchnStartZoom;

        hatGepannt = true;
        kamera.zoom = neuerZoom;
        kamera.x = jetztMitte.x - rect.left - weltX * neuerZoom;
        kamera.y = jetztMitte.y - rect.top - weltY * neuerZoom;
        begrenzeKamera();
        zeichneKamera();
      }
    });

    function zeigerEntfernen(ereignis) {
      if (!zeiger.has(ereignis.pointerId)) return;
      zeiger.delete(ereignis.pointerId);

      if (zeiger.size === 1) {
        // Weiter schwenken mit dem verbleibenden Finger
        var rest = Array.from(zeiger.values())[0];
        startMaus = { x: rest.x, y: rest.y };
        startKamera = { x: kamera.x, y: kamera.y };
      } else if (zeiger.size === 0) {
        if (hatGepannt) {
          klickSperre = true;
          if (ereignis.type === 'pointerup') starteTraegheit();
        } else if (ereignis.type === 'pointerup') {
          // Ein Tippen auf einen Wunsch öffnet das Blatt – ein Tippen auf die
          // Wand zählt als Doppelklick für den Zoom
          var notizElement =
            startZiel && startZiel.closest ? startZiel.closest('.notiz') : null;

          if (notizElement) {
            zeigePosit(notizElement);
          } else {
            registriereTipp(letzteFinger.x, letzteFinger.y);
          }
        }
        startMaus = null;
        startKamera = null;
        pinchnStartAbstand = 0;
      }
    }

    viewport.addEventListener('pointerup', zeigerEntfernen);
    viewport.addEventListener('pointercancel', zeigerEntfernen);

    // Nach dem Schwenken darf kein Klick auf ein Posit durchrutschen
    viewport.addEventListener(
      'click',
      function (ereignis) {
        if (klickSperre) {
          klickSperre = false;
          ereignis.stopPropagation();
          ereignis.preventDefault();
        }
      },
      true
    );

    // Mausrad zoomt an der Cursorposition
    viewport.addEventListener(
      'wheel',
      function (ereignis) {
        ereignis.preventDefault();
        flugNummer += 1;
        versteckeHinweis();

        var rect = viewport.getBoundingClientRect();
        var faktor = Math.exp(
          -ereignis.deltaY * (ereignis.deltaMode === 1 ? 0.012 : 0.0012)
        );

        setzeZoom(
          ereignis.clientX - rect.left,
          ereignis.clientY - rect.top,
          kamera.zoom * faktor
        );
      },
      { passive: false }
    );

    // Knöpfe
    function zoomKnopf(id, faktor) {
      var knopf = document.getElementById(id);
      if (!knopf) return;

      knopf.addEventListener('click', function () {
        flugNummer += 1;
        versteckeHinweis();
        setzeZoom(
          viewport.clientWidth / 2,
          viewport.clientHeight / 2,
          kamera.zoom * faktor
        );
      });
    }

    zoomKnopf('karte-zoom-rein', 1.35);
    zoomKnopf('karte-zoom-raus', 1 / 1.35);

    var knopfUebersicht = document.getElementById('karte-uebersicht');
    if (knopfUebersicht) {
      knopfUebersicht.addEventListener('click', function () {
        flugNummer += 1;
        versteckeHinweis();
        var passend =
          Math.min(
            viewport.clientWidth / weltBreite,
            viewport.clientHeight / weltHoehe
          ) * 0.95;
        zentriereAuf(50, 50, passend);
      });
    }

    window.addEventListener('resize', function () {
      var neu = weltMasse();

      if (neu.breite !== weltBreite || neu.hoehe !== weltHoehe) {
        // Die Wand wurde neu vermessen – die Kamera bleibt auf derselben Stelle
        var zentrumX =
          ((kamera.x + viewport.clientWidth / 2) / (weltBreite * kamera.zoom)) * 100;
        var zentrumY =
          ((kamera.y + viewport.clientHeight / 2) / (weltHoehe * kamera.zoom)) * 100;

        weltBreite = neu.breite;
        weltHoehe = neu.hoehe;
        setzeWeltGroesse();

        kamera.x =
          viewport.clientWidth / 2 - (zentrumX / 100) * weltBreite * kamera.zoom;
        kamera.y =
          viewport.clientHeight / 2 - (zentrumY / 100) * weltHoehe * kamera.zoom;
      }

      begrenzeKamera();
      zeichneKamera();
    });
  }

  initKarte();
  initFormularAbsenden();
})();
