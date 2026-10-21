// Erzeugt die Kork-Textur der Pinnwand.
// Stil orientiert an public/img/pinn_wand.png: warme Ocker-Granulate,
// dunkle Risse und Poren, Licht von oben links.
//
// Einmalig beim Laden wird eine kachelbare Kachel berechnet und als
// Hintergrundbild gesetzt. Danach kostet die Wand beim Schwenken und
// Zoomen keine Rechenzeit mehr.
(function (wurzel) {
  'use strict';

  var KACHEL_GROESSE = 512;

  // Farbwerte aus dem Original abgeleitet
  var GRUND = [214, 165, 100];
  var RISS_FARBE = [48, 27, 12];
  var PORE_FARBE = [104, 66, 32];

  // Tonkurve: wie stark die Körner aufhellen bzw. abdunkeln
  var TON = [
    [0.72, 0.42],
    [0.70, 0.48],
    [0.62, 0.56]
  ];
  // Beleuchtung: Grundhelligkeit und Spanne des Lichts von oben links
  var LICHT_BASIS = 0.74;
  var LICHT_SPANNE = 0.56;
  var LICHT_STAERKE = 4.0;
  // Kontrast der Körnerstruktur
  var KONTRAST = 1.7;
  // Weiche Überzeichnung der Lichter, damit nichts hart abschneidet
  var KNIE = 190;

  // Farbkorrektur, damit der Ton dem Original entspricht:
  // der Kork ist dort etwas rötlicher und weniger gelb.
  var FARB_DREHUNG = 8;
  var FARB_CHROMA = 1.04;

  // ---------------------------------------------------------------------
  // Zufall
  // ---------------------------------------------------------------------

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------
  // Kachelbares Rauschen
  // ---------------------------------------------------------------------

  function hash(x, y, seed) {
    var h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  // Value-Noise, dessen Gitter über den Kachelrand hinaus weiterläuft.
  // Deshalb wiederholt sich die Kachel ohne sichtbare Naht.
  function wertRauschen(x, y, groesse, zelle, seed) {
    var gx = x / zelle;
    var gy = y / zelle;
    var ix = Math.floor(gx);
    var iy = Math.floor(gy);
    var fx = gx - ix;
    var fy = gy - iy;

    // glatte Interpolation
    var ux = fx * fx * (3 - 2 * fx);
    var uy = fy * fy * (3 - 2 * fy);

    var mx = groesse / zelle;
    var x0 = ((ix % mx) + mx) % mx;
    var y0 = ((iy % mx) + mx) % mx;
    var x1 = (x0 + 1) % mx;
    var y1 = (y0 + 1) % mx;

    var a = hash(x0, y0, seed);
    var b = hash(x1, y0, seed);
    var c = hash(x0, y1, seed);
    var d = hash(x1, y1, seed);

    var oben = a + (b - a) * ux;
    var unten = c + (d - c) * ux;
    return oben + (unten - oben) * uy;
  }

  // ---------------------------------------------------------------------
  // Höhenfeld: Granulate, Risse, Poren
  // ---------------------------------------------------------------------

  function erzeugeHoehen(groesse, rnd) {
    var n = groesse * groesse;
    var h = new Float32Array(n);
    var riss = new Float32Array(n);
    var pore = new Float32Array(n);

    // 1) Grundstruktur aus vier Oktaven
    var oktaven = [
      [16, 0.32],
      [8, 0.26],
      [4, 0.20],
      [2, 0.14],
      [1, 0.08]
    ];

    for (var y = 0; y < groesse; y++) {
      for (var x = 0; x < groesse; x++) {
        var v = 0;
        for (var o = 0; o < oktaven.length; o++) {
          v += oktaven[o][1] * wertRauschen(x, y, groesse, oktaven[o][0], 17 + oktaven[o][0]);
        }
        // Kontrast anheben, damit einzelne Körner deutlich hervortreten
        v = (v - 0.5) * KONTRAST + 0.5;
        h[y * groesse + x] = v < 0 ? 0 : v > 1 ? 1 : v;
      }
    }

    // 2) Risse – kurze, leicht gewundene Linien
    for (var r = 0; r < 240; r++) {
      var px = Math.floor(rnd() * groesse);
      var py = Math.floor(rnd() * groesse);
      var winkel = rnd() * Math.PI * 2;
      var tiefe = 0.3 + rnd() * 0.3;
      var schritte = 3 + Math.floor(rnd() * 7);

      for (var s = 0; s < schritte; s++) {
        winkel += (rnd() - 0.5) * 0.9;
        px = (px + Math.round(Math.cos(winkel))) % groesse;
        py = (py + Math.round(Math.sin(winkel))) % groesse;
        if (px < 0) px += groesse;
        if (py < 0) py += groesse;

        var idx = py * groesse + px;
        h[idx] -= tiefe;
        if (h[idx] < 0) h[idx] = 0;
        if (riss[idx] < 1) riss[idx] = 1;
      }
    }

    // 3) Poren – einzelne dunkle Löcher
    for (var p = 0; p < 1700; p++) {
      var ox = Math.floor(rnd() * groesse);
      var oy = Math.floor(rnd() * groesse);
      var oi = oy * groesse + ox;
      h[oi] -= 0.22 + rnd() * 0.26;
      if (h[oi] < 0) h[oi] = 0;
      if (pore[oi] < 1) pore[oi] = 1;
    }

    // 4) Helle Körner – kleine Erhebungen, die das Licht fangen
    for (var l = 0; l < 900; l++) {
      var lx = Math.floor(rnd() * groesse);
      var ly = Math.floor(rnd() * groesse);
      var li = ly * groesse + lx;
      h[li] += 0.08 + rnd() * 0.16;
      if (h[li] > 1) h[li] = 1;
    }

    return { h: h, riss: riss, pore: pore };
  }

  // ---------------------------------------------------------------------
  // Beleuchtung: aus dem Höhenfeld Normalen berechnen und von oben links
  // beleuchten. Das gibt dem Kork seine plastische Struktur.
  // ---------------------------------------------------------------------

  function beleuchte(h, groesse) {
    var n = groesse * groesse;
    var licht = new Float32Array(n);

    // Licht von oben links (Bildkoordinaten: y wächst nach unten)
    var lx = -0.46;
    var ly = -0.58;
    var lz = 0.67;
    var ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ll;
    ly /= ll;
    lz /= ll;

    var staerke = LICHT_STAERKE;

    for (var y = 0; y < groesse; y++) {
      var ym = ((y - 1 + groesse) % groesse) * groesse;
      var yp = ((y + 1) % groesse) * groesse;
      var yc = y * groesse;

      for (var x = 0; x < groesse; x++) {
        var xm = (x - 1 + groesse) % groesse;
        var xp = (x + 1) % groesse;

        var gx = (h[yc + xp] - h[yc + xm]) * staerke;
        var gy = (h[yp + x] - h[ym + x]) * staerke;

        var nx = -gx;
        var ny = -gy;
        var nz = 1;
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len;
        ny /= len;
        nz /= len;

        var diff = nx * lx + ny * ly + nz * lz;
        if (diff < 0) diff = 0;

        licht[yc + x] = LICHT_BASIS + LICHT_SPANNE * diff;
      }
    }

    return licht;
  }

  // ---------------------------------------------------------------------
  // Kachel erzeugen
  // ---------------------------------------------------------------------

  // Lichter weich ausrollen, damit glatte, ausgebrannte Flecken entstehen
  function weichLimit(wert) {
    if (wert <= KNIE) return wert;
    var rest = wert - KNIE;
    var spanne = 255 - KNIE;
    return KNIE + spanne * Math.tanh(rest / spanne);
  }

  // Farbton drehen und Sättigung anpassen (YIQ), ohne die Helligkeit zu ändern
  function farbKorrigieren(r, g, b, drehung, chroma) {
    var Y = 0.299 * r + 0.587 * g + 0.114 * b;
    var I = 0.5959 * r - 0.2746 * g - 0.3213 * b;
    var Q = 0.2115 * r - 0.5227 * g + 0.3112 * b;

    I *= chroma;
    Q *= chroma;

    var winkel = (drehung * Math.PI) / 180;
    var c = Math.cos(winkel);
    var s = Math.sin(winkel);
    var i2 = I * c - Q * s;
    var q2 = I * s + Q * c;

    return [
      Y + 0.956 * i2 + 0.621 * q2,
      Y - 0.272 * i2 - 0.647 * q2,
      Y - 1.106 * i2 + 1.703 * q2
    ];
  }

  function erzeugeKachel(groesse, seed, optionen) {
    var opt = optionen || {};
    var drehung = opt.drehung === undefined ? FARB_DREHUNG : opt.drehung;
    var chroma = opt.chroma === undefined ? FARB_CHROMA : opt.chroma;
    var rnd = mulberry32(seed || 20261021);
    var felder = erzeugeHoehen(groesse, rnd);
    var licht = beleuchte(felder.h, groesse);

    var daten = new Uint8ClampedArray(groesse * groesse * 4);
    var chromaRauschen = mulberry32((seed || 20261021) + 991);

    for (var y = 0; y < groesse; y++) {
      for (var x = 0; x < groesse; x++) {
        var i = y * groesse + x;
        var t = felder.h[i];

        // Grundfarbe, durch die Körner aufgehellt und abgedunkelt
        var r = GRUND[0] * (TON[0][0] + TON[0][1] * t);
        var g = GRUND[1] * (TON[1][0] + TON[1][1] * t);
        var b = GRUND[2] * (TON[2][0] + TON[2][1] * t);

        // Beleuchtung
        var f = licht[i];
        r *= f;
        g *= f;
        b *= f;

        // Risse dunkel einfärben
        if (felder.riss[i] > 0) {
          var anteil = felder.riss[i] * 0.9;
          r += (RISS_FARBE[0] - r) * anteil;
          g += (RISS_FARBE[1] - g) * anteil;
          b += (RISS_FARBE[2] - b) * anteil;
        }

        // Poren dunkel einfärben
        if (felder.pore[i] > 0) {
          var pa = felder.pore[i] * 0.7;
          r += (PORE_FARBE[0] - r) * pa;
          g += (PORE_FARBE[1] - g) * pa;
          b += (PORE_FARBE[2] - b) * pa;
        }

        // feine Farbstreuung, damit die Fläche nicht zu steril wirkt
        var c = (chromaRauschen() - 0.5) * 12;
        r += c;
        g += c * 0.45;
        b -= c * 0.7;

        // Lichter weich überzeichnen statt hart abzuschneiden
        r = weichLimit(r);
        g = weichLimit(g);
        b = weichLimit(b);

        // Farbton an das Original anpassen
        var korrigiert = farbKorrigieren(r, g, b, drehung, chroma);
        r = korrigiert[0];
        g = korrigiert[1];
        b = korrigiert[2];

        var o = i * 4;
        daten[o] = r;
        daten[o + 1] = g;
        daten[o + 2] = b;
        daten[o + 3] = 255;
      }
    }

    return { daten: daten, breite: groesse, hoehe: groesse };
  }

  // ---------------------------------------------------------------------
  // Browser: Kachel zeichnen und als Hintergrund setzen
  // ---------------------------------------------------------------------

  function anwenden() {
    var wurzelElement = document.documentElement;
    if (!wurzelElement) return;

    var start = performance.now();
    var kachel = erzeugeKachel(KACHEL_GROESSE);

    var canvas = document.createElement('canvas');
    canvas.width = kachel.breite;
    canvas.height = kachel.hoehe;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var bild = ctx.createImageData(kachel.breite, kachel.hoehe);
    bild.data.set(kachel.daten);
    ctx.putImageData(bild, 0, 0);

    var textur = '';
    try {
      textur = canvas.toDataURL('image/webp', 0.92);
    } catch (fehler) {
      textur = '';
    }
    if (textur.indexOf('data:image/webp') !== 0) {
      textur = canvas.toDataURL('image/png');
    }

    // Auf der Wurzel ablegen – dann erben Viewport und Wand dieselbe Textur
    wurzelElement.style.setProperty('--kork-textur', 'url(' + textur + ')');
    wurzelElement.style.setProperty('--kork-groesse', KACHEL_GROESSE + 'px');

    if (window.console && console.debug) {
      console.debug(
        'Kork-Textur erzeugt in ' +
          Math.round(performance.now() - start) +
          ' ms (' +
          Math.round(textur.length / 1024) +
          ' KB)'
      );
    }
  }

  wurzel.KorkTextur = { erzeugeKachel: erzeugeKachel, KACHEL_GROESSE: KACHEL_GROESSE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = wurzel.KorkTextur;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', anwenden);
    } else {
      anwenden();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
