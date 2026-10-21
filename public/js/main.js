(function () {
  'use strict';

  var urlParameter = new URLSearchParams(window.location.search);

  // ---------- Pop-ups ----------
  function oeffneDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', 'open');
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

  // Nach einem Fehler das Pop-up direkt wieder öffnen
  if (urlParameter.get('fehler')) {
    oeffneDialog(document.getElementById('wunsch-dialog'));
  }

  // ---------- Zeichen zählen ----------
  var feld = document.getElementById('text');
  var stand = document.getElementById('zeichenzaehler-stand');

  if (feld && stand) {
    // Text nach einem Speicherfehler wiederherstellen
    var vorbehalterText = urlParameter.get('text');
    if (vorbehalterText) {
      feld.value = vorbehalterText;
    }

    var aktualisieren = function () {
      stand.textContent = String(feld.value.length);
    };

    feld.addEventListener('input', aktualisieren);
    aktualisieren();
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

  document.querySelectorAll('.notiz').forEach(function (notiz) {
    var text = notiz.querySelector('.notiz-text-inhalt');
    if (!text) return;

    var bereich = text.closest('.notiz-text-bereich');
    if (!bereich) return;

    // Passt der Text nicht auf das Blatt (gekürzt oder zu hoch), gibt es einen Klick
    var ueberlauf =
      text.scrollHeight > text.offsetHeight + 2 ||
      text.scrollHeight > bereich.clientHeight + 2;

    if (ueberlauf) {
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
  });

  // ---------- Karte: Schwenken & Zoomen ----------
  function initKarte() {
    var viewport = document.getElementById('pinnwand-viewport');
    var welt = document.getElementById('pinnwand-welt');
    if (!viewport || !welt) return;

    var weltBreite = parseFloat(viewport.dataset.weltBreite) || 3200;
    var weltHoehe = parseFloat(viewport.dataset.weltHoehe) || 2100;
    var MIN_ZOOM = 0.1;
    var MAX_ZOOM = 2.5;
    var RAND = 60;

    var kamera = { x: 0, y: 0, zoom: 0.5 };
    var hinweis = document.getElementById('karte-hinweis');
    var hatGepannt = false;
    var klickSperre = false;

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

    function zentriereAuf(wxProzent, wyProzent, zoom) {
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;

      kamera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
      kamera.x = vw / 2 - (wxProzent / 100) * weltBreite * kamera.zoom;
      kamera.y = vh / 2 - (wyProzent / 100) * weltHoehe * kamera.zoom;

      begrenzeKamera();
      zeichneKamera();
    }

    function versteckeHinweis() {
      if (hinweis) hinweis.hidden = true;
    }

    // Startansicht: Schwerpunkt aller Wünsche
    var mittelX = 50;
    var mittelY = 50;
    var notizen = welt.querySelectorAll('.notiz');

    if (notizen.length) {
      var summeX = 0;
      var summeY = 0;

      notizen.forEach(function (notiz) {
        summeX += parseFloat(notiz.style.left) || 50;
        summeY += parseFloat(notiz.style.top) || 50;
      });

      mittelX = summeX / notizen.length;
      mittelY = summeY / notizen.length;
    }

    var startZoom = Math.min(
      0.9,
      Math.max(0.28, viewport.clientHeight / 1500)
    );

    var neuId = urlParameter.get('neu');
    var neueNotiz = neuId
      ? welt.querySelector('.notiz[data-id="' + neuId + '"]')
      : null;

    if (neueNotiz) {
      zentriereAuf(
        parseFloat(neueNotiz.style.left) || 50,
        parseFloat(neueNotiz.style.top) || 50,
        0.9
      );
    } else {
      zentriereAuf(mittelX, mittelY, startZoom);
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

      viewport.setPointerCapture(ereignis.pointerId);
      zeiger.set(ereignis.pointerId, { x: ereignis.clientX, y: ereignis.clientY });
      hatGepannt = false;
      klickSperre = false;
      versteckeHinweis();

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
        var dx = ereignis.clientX - startMaus.x;
        var dy = ereignis.clientY - startMaus.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          hatGepannt = true;
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
        versteckeHinweis();
        var passend = Math.min(
          viewport.clientWidth / weltBreite,
          viewport.clientHeight / weltHoehe
        ) * 0.95;
        zentriereAuf(50, 50, passend);
      });
    }

    window.addEventListener('resize', function () {
      begrenzeKamera();
      zeichneKamera();
    });
  }

  // ---------- Position für den neuen Wunsch wählen ----------
  function freiePosition(belegtePunkte) {
    var bester = { x: 50, y: 50 };
    var besteEntfernung = -1;
    var i, j, x, y, mindest;

    for (i = 1; i <= 6; i++) {
      for (j = 1; j <= 4; j++) {
        x = (i / 7) * 100;
        y = (j / 5) * 100;
        mindest = Infinity;

        belegtePunkte.forEach(function (punkt) {
          var dx = punkt.x - x;
          var dy = punkt.y - y;
          var entfernung = dx * dx + dy * dy;
          if (entfernung < mindest) mindest = entfernung;
        });

        if (mindest > besteEntfernung) {
          besteEntfernung = mindest;
          bester = { x: x, y: y };
        }
      }
    }

    return bester;
  }

  function initPositionswahl() {
    var karte = document.getElementById('mini-karte');
    if (!karte) return;

    var pin = document.getElementById('mini-pin');
    var feldX = document.getElementById('position-x');
    var feldY = document.getElementById('position-y');
    var belegtePunkte = [];

    karte.querySelectorAll('.mini-punkt').forEach(function (punkt) {
      belegtePunkte.push({
        x: parseFloat(punkt.style.left) || 50,
        y: parseFloat(punkt.style.top) || 50
      });
    });

    function setzePosition(x, y) {
      x = Math.min(94, Math.max(6, x));
      y = Math.min(92, Math.max(8, y));

      pin.style.left = x + '%';
      pin.style.top = y + '%';
      feldX.value = String(Math.round(x));
      feldY.value = String(Math.round(y));
    }

    function positionAusEvent(ereignis) {
      var rect = karte.getBoundingClientRect();
      return {
        x: ((ereignis.clientX - rect.left) / rect.width) * 100,
        y: ((ereignis.clientY - rect.top) / rect.height) * 100
      };
    }

    var zieht = false;

    karte.addEventListener('pointerdown', function (ereignis) {
      ereignis.preventDefault();
      zieht = true;
      karte.setPointerCapture(ereignis.pointerId);

      var position = positionAusEvent(ereignis);
      setzePosition(position.x, position.y);
    });

    karte.addEventListener('pointermove', function (ereignis) {
      if (!zieht) return;
      var position = positionAusEvent(ereignis);
      setzePosition(position.x, position.y);
    });

    karte.addEventListener('pointerup', function () {
      zieht = false;
    });

    karte.addEventListener('pointercancel', function () {
      zieht = false;
    });

    // Mit der Tastatur den Pin verschieben
    karte.addEventListener('keydown', function (ereignis) {
      var schritt = ereignis.shiftKey ? 10 : 3;
      var x = parseFloat(feldX.value) || 50;
      var y = parseFloat(feldY.value) || 50;

      if (ereignis.key === 'ArrowLeft') x -= schritt;
      else if (ereignis.key === 'ArrowRight') x += schritt;
      else if (ereignis.key === 'ArrowUp') y -= schritt;
      else if (ereignis.key === 'ArrowDown') y += schritt;
      else return;

      ereignis.preventDefault();
      setzePosition(x, y);
    });

    // Startposition: wiederhergestellte Koordinaten oder freieste Stelle
    var startX = parseFloat(urlParameter.get('x'));
    var startY = parseFloat(urlParameter.get('y'));

    if (isFinite(startX) && isFinite(startY)) {
      setzePosition(startX, startY);
    } else {
      var frei = freiePosition(belegtePunkte);
      setzePosition(frei.x, frei.y);
    }
  }

  initKarte();
  initPositionswahl();
})();
