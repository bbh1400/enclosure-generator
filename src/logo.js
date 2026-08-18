import { contours } from 'd3-contour';
import skull from './assets/intel_skull.json';

export function builtinSkull() {
  return { polygons: skull.polygons, name: skull.name };
}

// Ramer–Douglas–Peucker simplification of a ring.
function rdp(points, eps) {
  if (points.length < 3) return points;
  let dmax = 0, idx = 0;
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs((px - ax) * dy - (py - ay) * dx) / len;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) {
    const left = rdp(points.slice(0, idx + 1), eps);
    const right = rdp(points.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

// Trace an uploaded image into stroke polygons (dark pixels -> engraving).
export async function traceImage(file, threshold = 120) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    // downscale for a manageable contour
    const maxDim = 260;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(2, Math.round(img.width * scale));
    const h = Math.max(2, Math.round(img.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // darkness field (0..255); transparent pixels treated as light
    const dark = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3] / 255;
      const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      dark[i] = a * (255 - g);
    }

    const geo = contours().size([w, h]).thresholds([threshold])(dark);
    if (!geo.length || !geo[0].coordinates.length)
      throw new Error('No shapes found at this threshold — try lowering it.');

    // GeoJSON MultiPolygon -> our polygons; flip Y so up is positive, simplify
    const polygons = [];
    for (const poly of geo[0].coordinates) {
      const rings = poly.map(ring => rdp(ring.map(([x, y]) => [x, h - y]), 0.8))
                        .filter(r => r.length >= 4);
      if (rings.length) polygons.push(rings);
    }
    if (!polygons.length) throw new Error('Traced shape was empty.');
    return { polygons, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}
