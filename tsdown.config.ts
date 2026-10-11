/**
 * Standalone build of the DSH client artifact this plugin ships.
 *
 * Adapted from deepseek-harness `packages/client/tsdown.client.ts`
 * (dsh-v0.2.0-rc.2, MIT; as carried in hanaworlds-desktop bd964cdf) so the
 * plugin builds outside the monorepo while emitting the same wire format:
 * `lib/client.js` calls `window.__ModuleLoader__.load({ id, factory })` and
 * resolves externals through the injected `require` (the Host module table).
 * React is one of those table rows: bundling a second copy would break hooks
 * rendered by the Host's React, so only this plugin's own panels are inlined.
 * `x.module.css` compiles through lightningcss into a hashed class map plus a
 * style tag injected when the factory runs.
 */
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { defineConfig, type UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  name: string
  dsh: { client: { external?: string[] } }
}
const ID = manifest.name

/** Shared Host module table (deepseek-harness `packages/client/web/src/platform.ts`, dsh-v0.2.0-rc.2). */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]
const REQUESTED = new Set([...PLATFORM_MODULES, ...(manifest.dsh.client.external ?? [])])
const CSS_VIRTUAL_PREFIX = '\0hanaworlds-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
const MODE = process.env.NODE_ENV ?? 'production'

/** Emit one plugin-owned style injector and the CSS Modules class map. */
function styleInjectionModule(fileId: string, css: string, classMap: Readonly<Record<string, string>>): string {
  const tagId = `${ID}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(ID)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

const client: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: (specifier: string) => REQUESTED.has(specifier),
    alwaysBundle: (specifier: string) => !REQUESTED.has(specifier),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(MODE),
    'process.env.DSH_CLIENT_VERSION': JSON.stringify('0.2.0-rc.2'),
  },
  plugins: [{
    // A value import of another @deepseek-ai package would inline a second
    // runtime instance or require a row the module table cannot answer.
    // Type-only imports are erased and never reach this gate.
    name: 'hanaworlds-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/') || REQUESTED.has(source)) return null
      throw new Error(`client bundle purity: "${source}" is not a Host module-table row or a dsh.client.external request of ${ID}`)
    },
  }, {
    name: 'hanaworlds-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css') || importer === undefined) return null
      return CSS_VIRTUAL_PREFIX + new URL(source, `file://${importer}`).pathname + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: await readFile(fileId),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exported] of Object.entries(cssExports ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        classMap[local] = exported.name
      }
      return styleInjectionModule(fileId, code.toString(), classMap)
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    chunkFileNames: 'client.[name].js',
    sourcemapExcludeSources: false,
    banner: chunk => `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, ${chunk.isEntry ? '' : `chunk: ${JSON.stringify(chunk.fileName)}, `}factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

/** Host half: the Loader imports `lib/index.js`; this plugin has no Host behaviour. */
const host: UserConfig = {
  name: `${ID}/host`,
  entry: { index: 'src/index.ts' },
  outputOptions: { entryFileNames: 'index.js' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  dts: false,
  clean: false,
}

export default defineConfig([host, client])
