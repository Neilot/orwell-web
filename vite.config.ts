import { defineConfig, type Plugin } from 'vite';

// The CSP in index.html is the production policy. The dev server needs a websocket for
// hot reload and injects CSS as <style> tags, so it gets a relaxed copy.
function devCsp(): Plugin {
  return {
    name: 'orwell:dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace("connect-src 'none'", "connect-src 'self' ws: wss:")
        .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
    },
  };
}

// GitHub Pages serves project sites from /<repo>/. The deploy workflow passes it in.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  worker: { format: 'es' },
  // Source maps help when debugging locally; the published site (built in CI) goes without them.
  build: { target: 'es2022', sourcemap: process.env.CI !== 'true' },
  plugins: [devCsp()],
});
