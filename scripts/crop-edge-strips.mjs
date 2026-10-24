import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const src = process.argv[2];
const png = PNG.sync.read(fs.readFileSync(src));
const W = Math.min(130, png.width);
const outDir = path.dirname(src);

const crop = (x0, x1, name) => {
  const w = x1 - x0;
  const out = new PNG({ width: w, height: png.height });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < w; x++) {
      const i = (png.width * y + (x0 + x)) << 2;
      const o = (w * y + x) << 2;
      out.data[o] = png.data[i];
      out.data[o + 1] = png.data[i + 1];
      out.data[o + 2] = png.data[i + 2];
      out.data[o + 3] = png.data[i + 3];
    }
  }
  fs.writeFileSync(path.join(outDir, name), PNG.sync.write(out));
};

crop(0, W, 'strip-left.png');
crop(png.width - W, png.width, 'strip-right.png');
console.log('OK', png.width, 'x', png.height);
