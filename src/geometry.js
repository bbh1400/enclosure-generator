// Parametric SSD/HDD cage builder using Manifold (WASM CSG).
// Port of the reference OpenSCAD/Python design:
//   - vertical tower, drives slide in through the open front
//   - each bay = C-channel (top + bottom rail on both walls) -> screwless
//   - ramped friction bumps near the mouth for retention
//   - side walls + back frame + base plate + top frame for rigidity
//
// Coordinate frame (modelling): X = width, Y = depth (insertion), Z = up.
// The result is rotated to the print orientation before returning.

export function makeBuilder(wasm) {
  const { Manifold, CrossSection } = wasm;

  const box = (x0, x1, y0, y1, z0, z1) => {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    if (sx <= 0 || sy <= 0 || sz <= 0) return null;
    return Manifold.cube([sx, sy, sz], false).translate([x0, y0, z0]);
  };

  // Extrude (u,v) contours by `depth`, orient so u->Y, v->Z, depth->X, shift X.
  // Used for the ramped friction bumps and the engraved logo.
  const placeExtruded = (contours, depth, xStart) => {
    const cs = new CrossSection(contours, 'EvenOdd');
    const ex = cs.extrude(depth).rotate([90, 0, 90]).translate([xStart, 0, 0]);
    cs.delete();
    return ex;
  };

  // Scale + centre logo polygons to a target height; return contours in (u,v).
  const prepLogo = (polygons, targetH, cx, cy) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const rings of polygons)
      for (const ring of rings)
        for (const [x, y] of ring) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    const s = targetH / (maxY - minY);
    const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
    const contours = [];
    for (const rings of polygons)
      for (const ring of rings)
        contours.push(ring.map(([x, y]) => [(x - ox) * s + cx, (y - oy) * s + cy]));
    return { contours, width: (maxX - minX) * s, height: (maxY - minY) * s };
  };

  return function build(p) {
    const W_CLEAR = p.driveW + 2 * p.sideClr;
    const INNER_X = W_CLEAR / 2;
    const OUTER_X = INNER_X + p.wallT;
    const SLOT_H = p.driveH + p.slotClr;
    const CHANNEL_H = p.railT + SLOT_H + p.railT;
    const PITCH = CHANNEL_H + p.gap;

    const Y_FRONT = 0;
    const Y_DRIVE_BK = p.driveL;
    const Y_BACK0 = Y_DRIVE_BK + 0.5;
    const Y_BACK1 = Y_BACK0 + p.backT;
    const RAIL_Y1 = Y_DRIVE_BK;

    const TOP_STACK = p.baseT + p.nDrives * PITCH - p.gap;
    const TOTAL_H = TOP_STACK + p.topCap;

    const pos = [], neg = [];
    const add = (m) => { if (m) pos.push(m); };
    const cut = (m) => { if (m) neg.push(m); };

    // side walls
    for (const s of [1, -1]) {
      const xa = s * INNER_X, xb = s * OUTER_X;
      add(box(Math.min(xa, xb), Math.max(xa, xb), Y_FRONT, Y_BACK1, 0, TOTAL_H));
    }

    // rails + friction bumps
    for (let i = 0; i < p.nDrives; i++) {
      const zb0 = p.baseT + i * PITCH;
      const zb1 = zb0 + p.railT;          // drive rests here
      const zt0 = zb1 + SLOT_H;
      const zt1 = zt0 + p.railT;
      for (const s of [1, -1]) {
        const xa = s * (INNER_X - p.railDepth), xb = s * INNER_X;
        const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
        add(box(x0, x1, Y_FRONT, RAIL_Y1, zb0, zb1));   // bottom rail
        add(box(x0, x1, Y_FRONT, RAIL_Y1, zt0, zt1));   // top rail
        if (p.bumps) {
          const y0 = p.bumpYc - p.bumpHalf, yc = p.bumpYc, y1 = p.bumpYc + p.bumpHalf;
          // bottom bump (peak up) and top bump (peak down)
          add(placeExtruded([[[y0, zb1], [yc, zb1 + p.bumpH], [y1, zb1]]], x1 - x0, x0));
          add(placeExtruded([[[y0, zt0], [yc, zt0 - p.bumpH], [y1, zt0]]], x1 - x0, x0));
        }
      }
    }

    // base plate + vent
    if (p.baseT > 0) {
      add(box(-OUTER_X, OUTER_X, Y_FRONT, Y_BACK1, 0, p.baseT));
      if (p.baseVent && Y_BACK0 - 12 > 14)
        cut(box(-INNER_X + 6, INNER_X - 6, Y_FRONT + 12, Y_BACK0 - 12, -1, p.baseT + 1));
    }

    // back frame + window
    if (p.backT > 0) {
      add(box(-OUTER_X, OUTER_X, Y_BACK0, Y_BACK1, 0, TOTAL_H));
      if (p.backWindow && TOTAL_H - 10 - 12 > 4)
        cut(box(-INNER_X + 8, INNER_X - 8, Y_BACK0 - 1, Y_BACK1 + 1, 12, TOTAL_H - 10));
    }

    // top frame band (perimeter, open centre)
    add(box(-OUTER_X, OUTER_X, Y_FRONT, Y_FRONT + 8, TOP_STACK, TOTAL_H));   // front lintel
    add(box(-OUTER_X, OUTER_X, Y_BACK0, Y_BACK1, TOP_STACK, TOTAL_H));       // rear top
    for (const s of [1, -1]) {
      const xa = s * INNER_X, xb = s * OUTER_X;
      add(box(Math.min(xa, xb), Math.max(xa, xb), Y_FRONT, Y_BACK1, TOP_STACK, TOTAL_H));
    }

    // engraved line-art logo on the side walls
    let logoInfo = null;
    if (p.logo && p.logo.polygons && p.logo.polygons.length) {
      const availH = TOTAL_H * 0.9, availW = Y_DRIVE_BK * 0.9;
      let targetH = Math.min(p.logo.targetH, availH);
      const cx = Y_DRIVE_BK / 2, cy = TOTAL_H / 2;
      let prep = prepLogo(p.logo.polygons, targetH, cx, cy);
      if (prep.width > availW) {                     // keep it inside the wall
        targetH *= availW / prep.width;
        prep = prepLogo(p.logo.polygons, targetH, cx, cy);
      }
      logoInfo = { width: prep.width, height: prep.height };
      const walls = p.logo.walls || 'both';
      const sides = walls === 'both' ? [1, -1] : walls === 'left' ? [-1] : [1];
      for (const s of sides) {
        const xStart = s > 0 ? OUTER_X - p.logo.depth : -OUTER_X - 0.1;
        cut(placeExtruded(prep.contours, p.logo.depth + 0.1, xStart));
      }
    }

    // boolean assembly
    let solid = Manifold.union(pos);
    if (neg.length) {
      const negU = Manifold.union(neg);
      const diff = Manifold.difference(solid, negU);
      solid.delete(); negU.delete();
      solid = diff;
    }
    pos.forEach(m => m.delete());
    neg.forEach(m => m.delete());

    // print orientation: stand on the mouth (Y -> up)
    if (p.orientation === 'print') {
      const r = solid.rotate([-90, 0, 0]);
      solid.delete();
      const bb = r.boundingBox();
      solid = r.translate([0, 0, -bb.min[2]]);
      r.delete();
    }

    const bb = solid.boundingBox();
    const size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
    const volCm3 = solid.volume() / 1000;
    const grams = volCm3 * 1.24;                          // PLA
    const filamentM = (solid.volume() / (Math.PI * 0.875 * 0.875)) / 1000; // 1.75mm

    return {
      solid,
      stats: {
        size, volCm3, grams, filamentM, slotH: SLOT_H,
        engagement: p.driveW / 2 - (INNER_X - p.railDepth),
        logo: logoInfo,
      },
    };
  };
}
