/** The published contract is a development SDK, never a production module. */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const contract = 'hanaworlds-contracts'
export const contractRef = 'git+https://github.com/yzsnstotz/hanaworlds-contracts.git#v2.9.0'
const isContract = id => id === contract || id.startsWith(`${contract}/`)
export function checkManifest(manifest, lock) {
  assert.equal(manifest.devDependencies?.[contract], contractRef, 'Exact development contract reference required')
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    assert(!Object.keys(manifest[field] ?? {}).some(isContract), `${field} must not supply the contract at runtime`)
  }
  assert(!manifest.dsh.client.external.some(isContract), 'Contract must not enter the Client module table')
  assert.equal(lock.packages[''].devDependencies[contract], contractRef)
  const supply = lock.packages[`node_modules/${contract}`]
  assert.equal(supply.version, '2.9.0')
  assert.equal(supply.resolved, 'git+ssh://git@github.com/yzsnstotz/hanaworlds-contracts.git#a892ceeb7047377d108f578161461aa06e0bfe5f')
  assert.equal(supply.dev, true, 'Contract lock supply must be development-only')
}
export function checkCode(code, filename, allowTypes = false) {
  const ast = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && isContract(node.moduleSpecifier.text)) {
      const clause = node.importClause
      const typeOnly = clause?.isTypeOnly || (!clause?.name && clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
        && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(row => row.isTypeOnly))
      assert(allowTypes && typeOnly, `${filename}: contract value/side-effect import forbidden`)
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && isContract(node.moduleSpecifier.text)) {
      assert(allowTypes && node.isTypeOnly, `${filename}: contract value export forbidden`)
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const id = node.moduleReference.expression
      if (id && ts.isStringLiteral(id) && isContract(id.text)) assert(allowTypes && node.isTypeOnly, `${filename}: contract require import forbidden`)
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(ast)
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || /(?:^|\.)require(?:\.resolve)?$/.test(callee)) {
        const id = node.arguments[0]
        assert(id && (ts.isStringLiteral(id) || ts.isNoSubstitutionTemplateLiteral(id)), `${filename}: non-static module loading forbidden`)
        assert(!isContract(id.text), `${filename}: runtime contract loading forbidden`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
}
export function checkMap(map, filename) {
  for (const source of map.sources ?? []) assert(!/(?:^|\/)hanaworlds-contracts(?:\/|$)/.test(source), `${filename}: contract implementation bundled`)
}
export function verifyBoundary(root = new URL('../', import.meta.url)) {
  const manifest = JSON.parse(readFileSync(new URL('package.json', root)))
  checkManifest(manifest, JSON.parse(readFileSync(new URL('package-lock.json', root))))
  const walk = (relative, types) => {
    for (const row of readdirSync(new URL(relative, root), { withFileTypes: true })) {
      const path = `${relative}${row.name}`
      if (row.isDirectory()) walk(`${path}/`, types)
      else if (/\.[cm]?[jt]sx?$/.test(path)) checkCode(readFileSync(new URL(path, root), 'utf8'), path, types)
      else if (path.endsWith('.map')) checkMap(JSON.parse(readFileSync(new URL(path, root))), path)
    }
  }
  walk('src/', true)
  // All shipped code, not just the currently known main/client entry pair.
  walk('lib/', false)
  const entries = [manifest.main, ...Object.values(manifest.exports).filter(value => typeof value === 'string' && !value.endsWith('.json'))]
  for (const entry of entries) {
    assert(entry.replace(/^\.\//, '').startsWith('lib/'), `Uninspected artifact entry: ${entry}`)
    readFileSync(new URL(entry, root))
  }
  console.log(`Contract boundary verified: exact v2.9.0 SDK; production manifest, source and all Host/Client artifacts have no contract runtime.`)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) verifyBoundary()
