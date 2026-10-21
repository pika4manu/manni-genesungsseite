(function () {
  'use strict';

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
  if (window.location.search.indexOf('fehler') !== -1) {
    oeffneDialog(document.getElementById('wunsch-dialog'));
  }

  // ---------- Zeichen zählen ----------
  var feld = document.getElementById('text');
  var stand = document.getElementById('zeichenzaehler-stand');

  if (feld && stand) {
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
})();
