// Binary STL writer from a Manifold mesh (getMesh() result).
export function meshToBinarySTL(mesh) {
  const { triVerts, vertProperties, numProp } = mesh;
  const nTri = triVerts.length / 3;
  const buf = new ArrayBuffer(84 + nTri * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, nTri, true);
  let off = 84;
  const v = (idx) => {
    const b = idx * numProp;
    return [vertProperties[b], vertProperties[b + 1], vertProperties[b + 2]];
  };
  for (let t = 0; t < nTri; t++) {
    const a = v(triVerts[3 * t]), b = v(triVerts[3 * t + 1]), c = v(triVerts[3 * t + 2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true);
    off += 12;
    for (const pt of [a, b, c]) {
      dv.setFloat32(off, pt[0], true); dv.setFloat32(off + 4, pt[1], true); dv.setFloat32(off + 8, pt[2], true);
      off += 12;
    }
    dv.setUint16(off, 0, true); off += 2;
  }
  return new Uint8Array(buf);
}
