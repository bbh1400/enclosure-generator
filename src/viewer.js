import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createViewer(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1420);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(180, 140, 220);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202838, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 1.4, 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.6);
  fill.position.set(-1, 0.3, -0.6);
  scene.add(fill);

  const grid = new THREE.GridHelper(600, 30, 0x2a3550, 0x1c2438);
  grid.position.y = -0.01;
  scene.add(grid);

  // flat shading: hard-surface CAD model, so shade each triangle by its true
  // geometric normal. Smooth (averaged) normals make the box triangulation
  // show through as diagonal streaks fanning across the flat faces.
  const material = new THREE.MeshStandardMaterial({
    color: 0x5b8ff0, metalness: 0.15, roughness: 0.55, flatShading: true,
  });
  let mesh = null;
  let framed = false;

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function setGeometry(mMesh) {
    if (mesh) { mesh.geometry.dispose(); scene.remove(mesh); }
    const geo = new THREE.BufferGeometry();   // meshes are always 3 props (x,y,z)
    geo.setAttribute('position', new THREE.BufferAttribute(mMesh.vertProperties, 3));
    geo.setIndex(new THREE.BufferAttribute(mMesh.triVerts, 1));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const c = new THREE.Vector3();
    geo.boundingBox.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z);           // centre at origin

    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    grid.position.y = -size.y / 2 - 1;

    mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);

    // frame the model only once; on later rebuilds keep the user's orbit
    // position so tweaking a parameter doesn't yank the view around
    camera.near = maxDim / 100; camera.far = maxDim * 20;
    camera.updateProjectionMatrix();
    if (!framed) {
      framed = true;
      controls.target.set(0, 0, 0);
      const d = maxDim * 1.8;
      camera.position.set(d * 0.8, d * 0.6, d);
      controls.update();
    }
  }

  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();

  return { setGeometry };
}
