import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkCode, checkManifest, checkMap } from './verify-contract-boundary.mjs'

test('production allows only erased contract types and display text', () => {
  checkCode("import type { PluginRoles } from 'hanaworlds-contracts';", 'source.ts', true)
  checkCode("import { type PluginRoles } from 'hanaworlds-contracts';", 'source.ts', true)
  checkCode("const label = 'hanaworlds-contracts';", 'client.js')
})
test('production rejects contract value imports even if bundling would erase or inline them', () => {
  for (const code of ["import { validateRequest } from 'hanaworlds-contracts';", "import 'hanaworlds-contracts';", "export { validateRequest } from 'hanaworlds-contracts';"]) {
    assert.throws(() => checkCode(code, 'source.ts', true), /contract/)
  }
})
test('every artifact rejects direct, dynamic, subpath and computed module loads', () => {
  for (const code of ["require('hanaworlds-contracts');", "import('hanaworlds-contracts/fixtures/plugin-roles');", "require.resolve('hanaworlds-contracts');", "require('hanaworlds-' + 'contracts');", "import(`hanaworlds-contracts`);", "import type { PluginRole } from 'hanaworlds-contracts';"]) {
    assert.throws(() => checkCode(code, 'artifact.js'), /forbidden/)
  }
})
test('sourcemaps reject an inlined contract implementation', () => {
  assert.throws(() => checkMap({ sources: ['../node_modules/hanaworlds-contracts/lib/index.js'] }, 'client.js.map'), /bundled/)
})
test('development supply must retain the published identity and production must omit it', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)))
  checkManifest(manifest, lock)
  assert.throws(() => checkManifest({ ...manifest, dependencies: { 'hanaworlds-contracts': manifest.devDependencies['hanaworlds-contracts'] } }, lock), /runtime/)
  const changed = structuredClone(lock)
  changed.packages['node_modules/hanaworlds-contracts'].resolved = 'git+https://github.com/yzsnstotz/hanaworlds-contracts.git#other'
  assert.throws(() => checkManifest(manifest, changed))
})
