// Draws the app's letter logo and writes every icon and splash image from it. The rules are explained in LOGO.md.
//
//   npm.cmd install                     (once, in this folder)
//   node make-logo.cjs                  B -> ../../frontend/assets/images, plus preview.png here
//   node make-logo.cjs M ./out          any letter defined below, into another folder
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { PNG } = require("pngjs");

// ---- The system (shared with MovieList's "M") ----
const GRID = 64; // everything is drawn on a 64 x 64 plate
const STROKE = 7.4; // pen width of vertical strokes
const TOP = 14.3; // outer edge of the letter, top (centre line 18 + half the pen)
const BOTTOM = 49.7; // outer edge, bottom (centre line 46 + half the pen)
const PLATE_RADIUS = 14; // corner radius of the plate
const YELLOW = "#F9F919";
const DARK = "#0C1618";
// Horizontal strokes look heavier than vertical ones of the same width, so a letter with horizontals is drawn with
// an oval pen: verticals STROKE wide, horizontals STROKE * HORIZONTAL. 1 = round pen (letters without horizontals).
const HORIZONTAL = 0.9;
// The share of the adaptive icon that the launcher shows (72 of 108 dp): the 64-unit plate maps onto it, so the
// letter on the phone is exactly as big as MovieList's.
const ADAPTIVE_VISIBLE = 72 / 108;

// ---- Letters ----
// draw(y, ry) returns the path. Write coordinates on the 64 grid and pass every y through y() and every arc's
// vertical radius through ry(): that squashes the path for the oval pen and stretches it back.
const LETTERS = {
  // MovieList. Symmetric, no horizontals: round pen, no shift.
  M: { pen: 1, draw: (y) => `M16 ${y(46)}V${y(18)}l16 ${y(36) - y(18)} 16 ${y(18) - y(36)}v${y(46) - y(18)}` },
  // MyBudget. The upper bowl is smaller (outer right edge 43.7 vs 46.7) and the waist sits 1 unit above the middle,
  // so the letter stands steady instead of looking top-heavy.
  B: {
    pen: HORIZONTAL,
    draw: (y, ry, pen) => {
      const half = (STROKE * pen) / 2; // half the horizontal stroke
      const top = TOP + half;
      const bottom = BOTTOM - half;
      const waist = (top + bottom) / 2 - 1;
      const stem = 16.3 + STROKE / 2; // outer left edge 16.3
      const r1 = (waist - top) / 2;
      const r2 = (bottom - waist) / 2;
      const upper = 43.7 - STROKE / 2 - r1; // where the upper bowl's curve starts
      const lower = 46.7 - STROKE / 2 - r2;
      return (
        `M${stem} ${y(top)}H${upper}a${r1} ${ry(r1)} 0 0 1 0 ${ry(2 * r1)}H${stem}` +
        `M${stem} ${y(waist)}H${lower}a${r2} ${ry(r2)} 0 0 1 0 ${ry(2 * r2)}H${stem}V${y(top)}`
      );
    },
  },
};

// SVG of the letter on the 64 grid, shifted right by dx.
const letterSvg = (letter, color, dx = 0) => {
  const { pen, draw } = LETTERS[letter];
  const y = (value) => +(32 + (value - 32) / pen).toFixed(3);
  const ry = (value) => +(value / pen).toFixed(3);
  const d = draw(y, ry, pen);
  return (
    `<g transform="translate(${dx} 32) scale(1 ${pen}) translate(0 -32)">` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/></g>`
  );
};

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
const rasterize = (size, body) => new Resvg(svg(size, body)).render().asPng();
// The 64 grid placed in a size x size canvas, taking `share` of it, centred.
const onCanvas = (size, share, inner) => {
  const k = (size * share) / GRID;
  const offset = (size - GRID * k) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${k})">${inner}</g>`;
};
const plate = `<rect width="${GRID}" height="${GRID}" rx="${PLATE_RADIUS}" fill="${YELLOW}"/>`;

// Ink of the letter, measured on a 1024 render: bounding box, centre of mass, area, stroke widths in grid units.
const measure = (letter, dx = 0) => {
  const S = 1024;
  const k = S / GRID;
  const png = PNG.sync.read(rasterize(S, onCanvas(S, 1, letterSvg(letter, "#000", dx))));
  const alpha = (x, yy) => png.data[(yy * S + x) * 4 + 3] / 255;
  let mass = 0;
  let sumX = 0;
  let minX = S;
  let maxX = 0;
  let minY = S;
  let maxY = 0;
  for (let yy = 0; yy < S; yy++)
    for (let x = 0; x < S; x++) {
      const a = alpha(x, yy);
      mass += a;
      sumX += a * (x + 0.5);
      if (a > 0.5) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + 1);
        minY = Math.min(minY, yy);
        maxY = Math.max(maxY, yy + 1);
      }
    }
  // Width of the first stroke met along a line of pixels: from the first inked pixel to the next gap.
  const run = (cells) => {
    const start = cells.findIndex((a) => a > 0);
    if (start < 0) return 0;
    let n = 0;
    for (let i = start; i < cells.length && cells[i] > 0; i++) n += cells[i];
    return n / k;
  };
  return {
    left: minX / k,
    right: maxX / k,
    top: minY / k,
    bottom: maxY / k,
    boxCentre: (minX + maxX) / 2 / k,
    massCentre: sumX / mass / k,
    ink: mass / (S * S),
    // The left stem on the row at y = 40, and the top stroke on the column at x = 28 (0 when the letter has none).
    vertical: run(Array.from({ length: S }, (_, x) => alpha(x, 40 * k))),
    horizontal: alpha(28 * k, minY + 2) > 0 ? run(Array.from({ length: S }, (_, i) => alpha(28 * k, i))) : 0,
  };
};

// Optical centre: halfway between the box centre (pixel-perfect, looks left-heavy for B: the stem carries most of
// the ink) and the centre of mass (looks too far right: the bowls stick out). That point goes to the middle, 32.
const opticalShift = (letter) => {
  const m = measure(letter);
  return Math.round((GRID / 2 - (m.boxCentre + m.massCentre) / 2) * 20) / 20;
};

const letter = (process.argv[2] || "B").toUpperCase();
if (!LETTERS[letter]) throw new Error(`No letter ${letter}: add it to LETTERS`);
const outDir = path.resolve(__dirname, process.argv[3] || "../../frontend/assets/images");
const dx = opticalShift(letter);
const glyph = (color) => letterSvg(letter, color, dx);

const write = (name, size, body, dir = outDir) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), rasterize(size, body));
  console.log("  ", path.relative(process.cwd(), path.join(dir, name)));
};

const f = (n) => n.toFixed(2);
const m = measure(letter, dx);
console.log(`${letter}: shift ${dx}, box ${f(m.left)}..${f(m.right)} x ${f(m.top)}..${f(m.bottom)}, box centre ${f(m.boxCentre)}, mass centre ${f(m.massCentre)}`);
console.log(`   strokes: vertical ${f(m.vertical)}, horizontal ${f(m.horizontal)}, ink ${(m.ink * 100).toFixed(1)}% of the plate`);

// iOS and older Android: a full square, the system rounds the corners.
write("icon.png", 1024, `<rect width="1024" height="1024" fill="${YELLOW}"/>${onCanvas(1024, 1, glyph(DARK))}`);
// Android adaptive icon: the launcher shows the middle 72 of 108 dp and masks it to its own shape.
write("android-icon-foreground.png", 1024, onCanvas(1024, ADAPTIVE_VISIBLE, glyph(DARK)));
write("android-icon-background.png", 1024, `<rect width="1024" height="1024" fill="${YELLOW}"/>`);
write("android-icon-monochrome.png", 1024, onCanvas(1024, ADAPTIVE_VISIBLE, glyph("#FFFFFF")));
// Splash: the whole logo, plate and letter, on a transparent canvas; app.json sets its size and the background.
write("splash-icon.png", 1024, onCanvas(1024, 1, plate + glyph(DARK)));
write("favicon.png", 48, onCanvas(48, 1, plate + glyph(DARK)));

// preview.png here: the letter next to MovieList's M at icon size and small, on light and dark.
const M = letterSvg("M", DARK);
const tile = (x, y, size, inner) => `<g transform="translate(${x} ${y})">${onCanvas(size, 1, plate + inner)}</g>`;
write(
  "preview.png",
  760,
  `<rect width="760" height="380" fill="#2b3240"/><rect y="380" width="760" height="380" fill="#e6e4da"/>` +
    [0, 380]
      .map(
        (top) =>
          tile(40, top + 60, 256, glyph(DARK)) +
          tile(320, top + 60, 256, M) +
          tile(610, top + 60, 96, glyph(DARK)) +
          tile(610, top + 180, 96, M) +
          `<line x1="168" y1="${top + 40}" x2="168" y2="${top + 52}" stroke="#e33" stroke-width="2"/>`
      )
      .join(""),
  __dirname
);
