import { defineConfig, type UserConfig } from 'tsdown'

/**
 * dsh-cae-agent client half build (matches the DSH client-modules bundle
 * format used by dsh-better-sidebar / ego-browser):
 *   - CJS bundle wrapped in `window.__ModuleLoader__.load({ id, factory })`
 *   - react + @deepseek-ai/dsh-client-* kept external (resolved from the
 *     profile via the ModuleLoader `require`)
 *   - clean:false so it never clobbers the backend (tsc) lib output
 */
const client: UserConfig = {
  name: 'dsh-cae-agent/client',
  entry: { client: 'client/src/index.tsx' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  external: ['react', 'react/jsx-runtime', 'react-dom', /^@deepseek-ai\/dsh-client-/],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify('dsh-cae-agent')}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([client])
