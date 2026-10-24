import fs from 'node:fs';
import { PNG } from 'pngjs';

const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
// Ieško aukso atspalvio pikselių (r>g>b, pakankamai šviesių) ir grupuoja pagal eilutes
const rows = new Map();
for (let y = 0; y < png.height; y++) {
  let count = 0;
  for (let x = 0; x < png.width; x += 2) {
    const i = (png.width * y + x) << 2;
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 110 && r > b + 30 && g > b + 15 && g < r + 10 && r < 235) count++;
  }
  if (count > 3) rows.set(y, count);
}
// Grupuoja gretimas eilutes į juostas
const bands = [];
let cur = null;
for (const y of [...rows.keys()].sort((a, b) => a - b)) {
  if (cur && y - cur.y2 <= 4) { cur.y2 = y; cur.n += rows.get(y); }
  else { cur = { y1: y, y2: y, n: rows.get(y) }; bands.push(cur); }
}
for (const b of bands) {
  console.log(`y ${b.y1}-${b.y2} (vid. ${Math.round((b.y1 + b.y2) / 2)}), gold pikselių ~${b.n * 2} (ekranas ${png.height}px)`);
}
