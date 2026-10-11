import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const official = createRequire(require.resolve('@deepseek-ai/dsh-plugin-manager'))
const { loadOverlayPatches, composeEntries } = official('@deepseek-ai/dsh-app-boot')
const root = new URL('../', import.meta.url)
test('official public patch loader composes exactly the self-owned Shell component', () => {
  const manifest = JSON.parse(readFileSync(new URL('package.json', root)))
  assert.equal(manifest.dsh.bundle?.patch, './cordis.patch.yml', 'Shell must be a normal manager bundle')
  const patch = loadOverlayPatches('shell-ui-test', new URL(manifest.dsh.bundle.patch, root).pathname)
  assert.deepEqual(composeEntries([patch]), [{ id: manifest.name, name: manifest.name }])
})

import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { PluginManager } from '@deepseek-ai/dsh-plugin-manager'
import { checkSupply, checkHost } from './verify-bundle-supply.mjs'
const { initProfile, loadProfileDirectory } = official('@deepseek-ai/dsh-app-boot')
const manifest = JSON.parse(readFileSync(new URL('package.json', root)))
const packed = ['cordis.patch.yml', 'lib/index.js', 'lib/client.js', 'lib/client.js.map']
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'shell-bundle-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}
test('supply refuses missing declaration, missing packed patch, wrong path and foreign components', t => {
  const path = new URL('cordis.patch.yml', root).pathname
  const missing = structuredClone(manifest); delete missing.dsh.bundle
  assert.throws(() => checkSupply(missing, path, packed))
  assert.throws(() => checkSupply(manifest, path, packed.slice(1)), /absent/)
  const wrong = structuredClone(manifest); wrong.dsh.bundle.patch = './other.yml'
  assert.throws(() => checkSupply(wrong, path, packed), /Exact/)
  assert.throws(() => checkSupply(manifest, join(fixture(t), 'missing.yml'), packed))
  const bad = join(fixture(t), 'foreign.yml')
  for (const patch of ['[]', '- id: hanaworlds-shell-ui\n  name: hanaworlds-shell-ui', '- insert:\n    - id: foreign\n      name: another-plugin']) {
    writeFileSync(bad, patch); assert.throws(() => checkSupply(manifest, bad, packed), /self insertion/)
  }
})
test('Host validation refuses business imports, side effects and nonempty apply', () => {
  checkHost(readFileSync(new URL('lib/index.js', root), 'utf8'))
  for (const code of ['import x from "other"; function apply() {} export { apply };',
    'fetch("/business"); function apply() {} export { apply };', 'function apply() { return 1; } export { apply };']) assert.throws(() => checkHost(code))
})
test('real official manager selects, lists, deselects and reselects own patch without duplicate insertion', async t => {
  const home = fixture(t), dir = join(home, 'profiles', 'shell-fixture'), anchor = join(home, 'installation', 'package.json')
  mkdirSync(join(home, 'installation')); writeFileSync(anchor, JSON.stringify({ dependencies: {} }))
  initProfile(dir, [])
  const installed = JSON.parse(readFileSync(join(dir, 'package.json')))
  installed.dependencies[manifest.name] = 'file:' + fileURLToPath(root)
  writeFileSync(join(dir, 'package.json'), JSON.stringify(installed))
  mkdirSync(join(dir, 'node_modules')); symlinkSync(fileURLToPath(root), join(dir, 'node_modules', manifest.name), 'dir')
  const ctx = new Context()
  await ctx.plugin(Loader, { baseUrl: root.href }).await()
  ctx.provide('profileContext', { name: 'shell-fixture', dir, patchPath: join(dir, 'cordis.patch.yml'), installAnchor: anchor,
    cwd: home, home, startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
  const managerFiber = ctx.plugin(PluginManager, {})
  await managerFiber.await()
  t.after(() => ctx.fiber.dispose())
  for (const enabled of [true, false, true, true]) {
    const result = await ctx.pluginManager.setBundleEnabled(manifest.name, enabled)
    assert.equal(result.application, 'restart-required', JSON.stringify(result))
    assert.equal(result.error, undefined)
    const profile = loadProfileDirectory('shell-fixture', dir, anchor)
    assert.deepEqual(profile.skippedBundles, [])
    const rows = composeEntries(profile.layers.map(layer => layer.patches))
    assert.deepEqual(rows, enabled ? [{ id: manifest.name, name: manifest.name }] : [])
    const bundle = (await ctx.pluginManager.listBundles()).find(row => row.name === manifest.name)
    assert.equal(bundle?.enabled, enabled)
    if (enabled) assert.equal(bundle.rows.length, 1)
  }
  // The actual official profile reader must refuse unreadable package layers.
  const broken = join(dir, 'node_modules', 'broken-shell'); mkdirSync(broken)
  writeFileSync(join(broken, 'package.json'), JSON.stringify({ name: 'broken-shell', dsh: { bundle: { patch: './missing.yml' } } }))
  const profileManifest = JSON.parse(readFileSync(join(dir, 'package.json')))
  profileManifest.dsh.profile.bundles = ['broken-shell']
  writeFileSync(join(dir, 'package.json'), JSON.stringify(profileManifest))
  const rejected = loadProfileDirectory('shell-fixture', dir, anchor)
  assert.equal(rejected.layers.length, 0)
  assert.equal(rejected.skippedBundles[0].packageName, 'broken-shell')
  assert.match(rejected.skippedBundles[0].reason, /missing.yml/)
})

// Exercise the actual npm pack verification, including npm's cache writes.
import { spawnSync } from 'node:child_process'
test('actual pack verification is independent of an unusable inherited npm cache', t => {
  const unusableCache = join(fixture(t), 'not-a-cache-directory')
  writeFileSync(unusableCache, 'existing file')
  const result = spawnSync(process.execPath, ['scripts/verify-bundle-supply.mjs'], {
    cwd: fileURLToPath(root), encoding: 'utf8',
    env: { ...process.env, npm_config_cache: unusableCache, NPM_CONFIG_CACHE: unusableCache },
  })
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /Bundle supply verified/)
})
