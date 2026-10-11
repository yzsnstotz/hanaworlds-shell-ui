import type { PluginRole, PluginRoles, ReadPluginRolesResponse } from 'hanaworlds-contracts'

/** Activation halves belong to the UI; role/provider identities come only from ReadPluginRoles. */
export const REQUIRED_PLUGIN_ROLES = [
  { role: 'shell-ui', hostRequired: false, clientRequired: true },
  { role: 'world-source', hostRequired: true, clientRequired: false },
  { role: 'canvas', hostRequired: true, clientRequired: true },
  { role: 'brush', hostRequired: true, clientRequired: false },
  { role: 'painter', hostRequired: true, clientRequired: false },
  { role: 'workshop', hostRequired: true, clientRequired: true },
  { role: 'skills', hostRequired: true, clientRequired: false },
  { role: 'desktop-bridge', hostRequired: true, clientRequired: false },
  { role: 'local-runtime', hostRequired: true, clientRequired: false },
] as const satisfies readonly { role: PluginRole; hostRequired: boolean; clientRequired: boolean }[]

const roles = REQUIRED_PLUGIN_ROLES.map(item => item.role)
function record(value: unknown, keys: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || keys.some(key => !Object.hasOwn(value, key))) {
    throw Error('ReadPluginRoles: SCHEMA_INVALID')
  }
  if (Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key))) throw Error('ReadPluginRoles: UNKNOWN_REQUIRED_FIELD')
  return value as Record<string, unknown>
}
function reference(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && !/[\uD800-\uDFFF]/u.test(value) }

/** Browser admission of the v2.9.0 envelope and its published binding invariants.
 * The contract runtime uses node:crypto, so only public types enter the client bundle.
 * GET owns its request ID at the bridge; the client has no caller ID to correlate.
 */
export async function readPluginRoles(): Promise<PluginRoles> {
  const http = await fetch('/api-hanaworlds-plugin-roles')
  const raw: unknown = await http.json()
  if (!http.ok) {
    const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const failure = body.contractError && typeof body.contractError === 'object' ? body.contractError as Record<string, unknown> : {}
    const error = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : {}
    const reasons = [typeof body.error === 'string' ? body.error : error.code, failure.code, failure.reason].filter(reference)
    throw Error(`ReadPluginRoles: HTTP ${http.status} · ${reasons.join(' · ')}`)
  }
  const response = record(raw, ['contractVersion', 'requestId', 'result', 'error'])
  if (response.contractVersion !== 'world-inspection/v1' || !reference(response.requestId)) throw Error('ReadPluginRoles: SCHEMA_INVALID')
  if (response.error !== null) {
    const error = record(response.error, ['code', 'phase', 'retryability', 'mutationState', 'transactionRef', 'causeCode', 'reason'], ['worldRef'])
    if (response.result !== null || error.code !== 'CAPABILITY_UNAVAILABLE'
      || error.phase !== 'validate' || error.retryability !== 'AFTER_NEW_FACTS'
      || error.mutationState !== 'NONE' || error.transactionRef !== null || error.causeCode !== null
      || error.reason !== 'REQUIRED_FACT_UNKNOWN' || (error.worldRef !== undefined && !reference(error.worldRef))) throw Error('ReadPluginRoles: SCHEMA_INVALID')
    throw Error(`${error.code} · ${error.reason}`)
  }
  const result = record(response.result, ['status', 'providers', 'missingRoles'])
  const providers = record(result.providers, roles)
  for (const role of roles) {
    const names = providers[role]
    if (!Array.isArray(names) || names.some(name => !reference(name))) throw Error('ReadPluginRoles: SCHEMA_INVALID')
    if (names.some((name: string, i: number) => i > 0 && names[i - 1] >= name)) throw Error('ReadPluginRoles: NON_CANONICAL_AMBIGUITY')
  }
  const missing = roles.filter(role => (providers[role] as string[]).length === 0)
  const status = missing.length === 0 ? 'COMPLETE' : missing.length === roles.length ? 'UNAVAILABLE' : 'PARTIAL'
  if (result.status !== status || !Array.isArray(result.missingRoles)
    || result.missingRoles.length !== missing.length || result.missingRoles.some((role, i) => role !== missing[i])) {
    throw Error('ReadPluginRoles: SCHEMA_INVALID')
  }
  return (raw as ReadPluginRolesResponse).result!
}
