/** Required capabilities and their activation halves; package names are configuration, never role inference. */
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
] as const
export type PluginRole = typeof REQUIRED_PLUGIN_ROLES[number]['role']
export interface ShellConfig { roleProviders?: Partial<Record<PluginRole, readonly string[]>> }

/** This is the Shell's own Cordis configuration, not an added cross-module HTTP contract. */
export function parseRoleProviders(config: ShellConfig): NonNullable<ShellConfig['roleProviders']> {
  const providers = config.roleProviders ?? {}
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) throw Error('roleProviders must be a role-to-module-list object')
  for (const [role, names] of Object.entries(providers)) {
    if (!REQUIRED_PLUGIN_ROLES.some(item => item.role === role)) throw Error(`Unknown plugin role: ${role}`)
    if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || name.trim() !== name || !name)) {
      throw Error(`roleProviders.${role} must contain exact nonempty module specifiers`)
    }
    if (new Set(names).size !== names.length) throw Error(`roleProviders.${role} contains duplicate providers`)
  }
  return { 'shell-ui': ['hanaworlds-shell-ui'], ...providers }
}
