/** Inspect and execute the packed DSH registration, without starting a Host. */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('package.json', root)))
assert.deepEqual(Object.keys(manifest.dsh), ['client'])
assert.equal(manifest.dependencies['hanaworlds-contracts'], 'git+https://github.com/yzsnstotz/hanaworlds-contracts.git#v2.9.0')
assert.deepEqual(readdirSync(new URL('lib/', root)).sort(), ['client.js', 'client.js.map', 'index.js'])
const source = readFileSync(new URL('lib/client.js', root), 'utf8')
assert.doesNotMatch(source, /hanaworldsDesktopView|hanaworldsDesktopWorlds|hanaworldsWorkshopTransport|hanaworldsDesktopConfig|hanaworlds_request|session\/v3|尚未接入/)
assert.doesNotMatch(source, /(?:require\(["'](?:node:|electron)|process\.env\.)/)
const imports = [...source.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map(match => match[1])
const platform = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit'])
for (const id of imports) assert(platform.has(id), `Unsupported Host module-table request: ${id}`)
const registrations = [], styles = []
vm.runInNewContext(source, {
  window: { __ModuleLoader__: { load: registration => registrations.push(registration) } },
  document: { querySelector: () => null, createElement: () => ({ dataset: {} }), head: { appendChild: tag => styles.push(tag) } },
}, { filename: 'lib/client.js' })
assert.equal(registrations.length, 1)
assert.equal(registrations[0].id, manifest.name)
const require = createRequire(import.meta.url)
const plugin = registrations[0].factory(id => { assert(platform.has(id)); return require(id) })
assert.equal(typeof plugin.apply, 'function')
assert(plugin.inject.includes('remote.pluginManager'))
assert.equal(styles.length, 2)
assert(styles.every(tag => tag.textContent.length > 0 && tag.dataset.plugin === manifest.name))
const slots = [], themes = [], locales = [], panels = []
const ctx = {
  effect: effect => effect(),
  locale: { register: (id, value) => locales.push({ id, value }), bind: () => key => key },
  theme: { overrideTokens: (id, value) => themes.push({ id, value }) },
  slots: { inject: (_slot, factory) => { const value = factory(); if (value?.next) [...value] },
    register: (options, component) => { slots.push({ options, component }); return () => {} } },
  layout: { selectPanel: id => panels.push(id), panelInfo: { getSnapshot: () => ({ activePanelId: null }) } },
}
plugin.apply(ctx)
for (const name of ['sidebar.brand.mark', 'sidebar.brand.name', 'conversation.hero.brand.mark', 'main', 'settings.section', 'plugins.item']) {
  assert(slots.some(row => row.options.name === name), `Missing slot: ${name}`)
}
assert.deepEqual(slots.filter(row => row.options.name === 'main').map(row => row.options.key), ['hana-home', 'hana-workshop', 'hana-world'])
assert.deepEqual(panels, ['hana-home'])
assert.equal(locales.length, 1)
assert.equal(themes.length, 1)
const hostSource = readFileSync(new URL('lib/index.js', root), 'utf8')
assert.doesNotMatch(hostSource, /\bimport\b|electron|fetch\(/)
console.log(`Bundle verified: ${manifest.name}; one DSH registration, 2 inline CSS modules, ${slots.length} slots; no native or business runtime bundled.`)
