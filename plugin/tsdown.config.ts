import { defineConfig } from 'tsdown'

// Client half bundle for the unified dsh-cae-agent plugin.
// - clean:false so it never clobbers the backend (tsc) output in lib/
// - outputs an ESM bundle (lib/client.js) referenced by package.json ./client
// - externalizes the host-provided client deps (react, @deepseek-ai/dsh-client-*)
// - uses client/tsconfig.json for JSX/DOM
export default defineConfig({
  entry: ['client/src/index.tsx'],
  outDir: 'lib',
  format: ['esm'],
  dts: true,
  clean: false,
  tsconfig: 'client/tsconfig.json',
  // Do not bundle the host-provided packages; the host serves them.
  deps: {
    neverBundle: ['react', 'react/jsx-runtime', 'dsh-better-sidebar', /^@deepseek-ai\//],
  },
  // Name the output lib/client.js (rollup name -> client).
  name: 'client',
})
