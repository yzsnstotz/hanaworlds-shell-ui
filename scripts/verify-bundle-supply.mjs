/** Verify self-owned management supply through the official public patch loader. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
// app-boot is the exact public development dependency of our declared manager SDK.
export const official = createRequire(require.resolve('@deepseek-ai/dsh-plugin-manager'))
export const { loadOverlayPatches, composeEntries } = official('@deepseek-ai/dsh-app-boot')
export function checkSupply(manifest, patchPath, packedFiles) {
  assert.deepEqual(Object.keys(manifest.dsh).sort(), ['bundle', 'client'])
  assert.deepEqual(manifest.dsh.bundle, { patch: './cordis.patch.yml' }, 'Exact own bundle patch required')
  assert(manifest.files.includes('cordis.patch.yml'), 'Patch must be declared for packaging')
  assert(packedFiles.includes('cordis.patch.yml'), 'Patch absent from actual package file list')
  const patches = loadOverlayPatches('shell-ui', patchPath)
  assert.deepEqual(patches, [{ insert: [{ id: manifest.name, name: manifest.name }] }], 'Only one self insertion allowed')
  assert.deepEqual(composeEntries([patches]), [{ id: manifest.name, name: manifest.name }], 'Official composition must contain only Shell')
  assert.equal(manifest.main, 'lib/index.js')
  assert.equal(manifest.exports['.'], './lib/index.js')
  assert.equal(manifest.exports['./client'], './lib/client.js')
  for (const entry of ['lib/index.js', 'lib/client.js', 'lib/client.js.map']) assert(packedFiles.includes(entry), `Missing artifact: ${entry}`)
}
export function checkHost(code) {
  const ast = ts.createSourceFile('index.js', code, ts.ScriptTarget.Latest, true)
  const statements = ast.statements.filter(row => !ts.isEmptyStatement(row))
  // tsdown's only permitted Host output is an empty function and its named export.
  assert.equal(statements.length, 2, 'Host must remain a no-op without top-level effects')
  const [fn, exp] = statements
  assert(ts.isFunctionDeclaration(fn) && fn.name?.text === 'apply' && fn.parameters.length === 0 && fn.body?.statements.length === 0,
    'Host apply must remain empty')
  assert(ts.isExportDeclaration(exp) && !exp.moduleSpecifier && ts.isNamedExports(exp.exportClause)
    && exp.exportClause.elements.length === 1 && exp.exportClause.elements[0].name.text === 'apply', 'Only apply may be exported')
}
export function verifySupply(root = new URL('../', import.meta.url)) {
  const manifest = JSON.parse(readFileSync(new URL('package.json', root)))
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: fileURLToPath(root), encoding: 'utf8' }))
  checkSupply(manifest, fileURLToPath(new URL('cordis.patch.yml', root)), pack.files.map(row => row.path))
  checkHost(readFileSync(new URL('lib/index.js', root), 'utf8'))
  console.log('Bundle supply verified: actual pack list, official insert composition, exact own Host/Client exports, empty Host.')
}
if (process.argv[1] === fileURLToPath(import.meta.url)) verifySupply()
