import { defineConfig } from 'vite';

// base: './' makes all asset URLs relative, so the build works on any GitHub
// Pages path (user.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: './',
  optimizeDeps: { exclude: ['manifold-3d'] },
  build: {
    target: 'esnext',
    // the bundle is dominated by three.js + the Manifold WASM glue; that's
    // expected for a CAD app, so lift the (cosmetic) size warning.
    chunkSizeWarningLimit: 1200,
  },
});
