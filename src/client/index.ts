/** HanaWorlds brand and built-in Shell management page. */
import type { Context as ClientContext, FiberState } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-modules/client'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { BrandMark, BrandName, HeroBrandMark } from './Brand.tsx'
import { PluginStatus, type PluginStatusFace, type PluginPhase, type PluginObservation } from './PluginStatus.tsx'
import { SkillToolsSettings } from './SkillToolsSettings.tsx'
import { ShellSettings } from './ShellSettings.tsx'
import { ShellPanelIcon, type ShellPanel } from './HanaShellPage.tsx'
import { PluginFaultStore, ShellFaultStatus, ShellPageWithFaults } from './PluginFaults.tsx'
import { REQUIRED_PLUGIN_ROLES, parseRoleProviders, type ShellConfig } from './plugin-roles.ts'
import type { BundleInfo } from '@deepseek-ai/dsh-plugin-manager/types'
import { en, zh, type Key } from './locales.ts'
import { HANA_THEME_TOKENS } from './theme.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'hanaworlds.shell': Key }
}

/** Services used by the Shell management page. */
export const inject = ['slots', 'locale', 'remote', 'remote.pluginManager', 'layout', 'theme', 'loader', 'modules']

// Cordis const enums have no runtime object in shared browser modules.
const CLIENT_ACTIVE = 2 as FiberState.ACTIVE
const CLIENT_FAILED = 3 as FiberState.FAILED

/** Add HanaWorlds identity and a management section to the official Shell. */
export function apply(ctx: ClientContext, config: ShellConfig = {}): void {
  const faults = new PluginFaultStore()
  function protect<T>(operation: string, work: () => T): T | undefined {
    try { return work() } catch (error) { faults.record(operation, error); return undefined }
  }
  let roleProviders: NonNullable<ShellConfig['roleProviders']> = {}
  protect('role configuration', () => { roleProviders = parseRoleProviders(config) })
  // Slot callbacks can execute after apply returns. Contain both callback and generator execution.
  const slots = ctx.slots
  const safeSlots = {
    inject: ((name, factory) => protect(`slot ${name}`, () => slots.inject(name, () => {
      const value = protect(`slot ${name}`, factory)
      if (value && typeof value === 'object' && Symbol.iterator in value) {
        return (function* () {
          try { yield* value as Iterable<() => void> } catch (error) { faults.record(`slot ${name}`, error) }
        })()
      }
      return value ?? (() => {})
    }))) as typeof slots.inject,
    register: slots.register.bind(slots),
  }
  safeSlots.inject('plugins.item', () => safeSlots.register({
    name: 'plugins.item', id: 'hanaworlds-shell-faults', order: -20,
    label: () => 'hanaworlds-shell-ui', inject: () => ({ faults }),
  }, ShellFaultStatus))
  protect('locale', () => ctx.effect(() => ctx.locale.register('hanaworlds.shell', { en, zh }), 'hanaworlds-shell: locale'))
  protect('palette', () => ctx.effect(() => ctx.theme.overrideTokens('hanaworlds-shell', HANA_THEME_TOKENS), 'hanaworlds-shell: palette'))
  const t = protect('locale binding', () => ctx.locale.bind('hanaworlds.shell')) ?? ((key: Key) => en[key])
  safeSlots.inject('sidebar.brand.mark', () => safeSlots.register({ name: 'sidebar.brand.mark' }, BrandMark))
  safeSlots.inject('sidebar.brand.name', () => safeSlots.register({ name: 'sidebar.brand.name' }, BrandName))
  safeSlots.inject('conversation.hero.brand.mark', () => safeSlots.register({
    name: 'conversation.hero.brand.mark',
  }, HeroBrandMark))
  const panels: readonly { id: ShellPanel; order: number; label: Key }[] = [
    { id: 'hana-home', order: -40, label: 'homeNav' },
    { id: 'hana-workshop', order: -30, label: 'workshopNav' },
    { id: 'hana-world', order: -20, label: 'worldNav' },
  ]
  for (const panel of panels) {
    safeSlots.inject('main', function* () {
      yield safeSlots.register({
        name: 'main', key: panel.id as MainPanelId, locale: 'hanaworlds.shell',
        inject: () => ({ faults, panel: panel.id, navigate: (id: ShellPanel | 'plugins' | 'hanaworlds-canvas-objects-history') => {
          ctx.layout.selectPanel(id as MainPanelId)
        } }),
      }, ShellPageWithFaults)
      if (panel.id === 'hana-home' && ctx.layout.panelInfo.getSnapshot().activePanelId === null) {
        ctx.layout.selectPanel(panel.id as MainPanelId)
      }
    })
    safeSlots.inject('sidebar.panellist', () => safeSlots.register({
      name: 'sidebar.panellist', id: panel.id, order: panel.order,
      label: () => t(panel.label), locale: 'hanaworlds.shell',
      inject: () => ({ panel: panel.id }),
    }, ShellPanelIcon))
  }
  const readPlugins: PluginStatusFace['read'] = async () => {
    const host = await ctx.remote.pluginManager.listPlugins()
    if (!host.ok) throw new Error(`HANAWORLDS_PLUGIN_INVENTORY_UNAVAILABLE: ${host.error.message}`)
    const bundles = await ctx.remote.pluginManager.listBundles()
    if (!bundles.ok) throw new Error(`HANAWORLDS_PLUGIN_VERSIONS_UNAVAILABLE: ${bundles.error.message}`)
    const hostRows = host.value
    const bundleRows = bundles.value
    const failures = [...ctx.modules.entries.state.getSnapshot().failures]
    // Initial boot failures are audited through importError, before reconciliation publishes failures.
    for (const row of ctx.modules.manifest.plugins) {
      const error = ctx.modules.importError(row.id)
      if (error && !failures.some(failure => failure.id === row.id)) failures.push({ id: row.id, message: error.message })
    }
    const client: Entry[] = [...ctx.loader.entries()]
    for (const entry of client) {
      if (entry.fiber?.state !== CLIENT_FAILED || failures.some(failure => failure.id === entry.options.name)) continue
      try { await entry.fiber.await() } catch (error) {
        failures.push({ id: entry.options.name, message: error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error) })
      }
    }
    function versionOf(name: string): { version: string | null; versionSource: string | null } {
      const owners: BundleInfo[] = bundleRows.filter(bundle => bundle.name === name || bundle.rows.some(row => row.moduleName === name))
      return owners.length === 1 ? { version: owners[0]?.version ?? null, versionSource: owners[0]?.name ?? null } : { version: null, versionSource: null }
    }
    function observe(name: string, item: { role?: string; hostRequired: boolean; clientRequired: boolean }): PluginObservation {
      const hosts = hostRows.filter(row => row.moduleName === name)
      const hostEntry = hosts.length === 1 ? hosts[0] : undefined
      const clients = client.filter(row => row.options.name === name)
      const failed = failures.find(row => row.id === name)
      const browser = clients.length === 1 ? clients[0] : undefined
      const clientPhase: PluginPhase | null = failed ? { enabled: browser ? !browser.disabled : true, phase: 'failed', reason: failed.message }
        : browser ? { enabled: !browser.disabled, phase: browser.fiber?.state === CLIENT_ACTIVE ? 'active' : browser.fiber?.state === CLIENT_FAILED ? 'failed' : 'waiting' } : null
      return { ...item, name, ...versionOf(name), identity: null,
        host: hostEntry ? { enabled: hostEntry.enabled, phase: hostEntry.fiberPhase } : null,
        client: clientPhase }
    }
    const plugins = REQUIRED_PLUGIN_ROLES.flatMap(item => {
      const providers = roleProviders[item.role] ?? []
      return providers.length ? providers.map(name => observe(name, item))
        : [{ ...item, name: item.role, version: null, identity: null, host: null, client: null }]
    })
    // A failed optional plugin also needs a named card, even when it supplies no required role.
    for (const failure of failures) {
      if (!plugins.some(plugin => plugin.name === failure.id)) {
        plugins.push(observe(failure.id, { hostRequired: false, clientRequired: true }))
      }
    }
    return { plugins, sdk: null }
  }
  safeSlots.inject('plugins.item', () => safeSlots.register({
    name: 'plugins.item', id: 'hanaworlds-runtime', order: -10, label: () => t('pluginsTitle'),
    locale: 'hanaworlds.shell', inject: () => ({ read: readPlugins }),
  }, PluginStatus))
  safeSlots.inject('settings.section', () => safeSlots.register({
    name: 'settings.section', id: 'hanaworlds-skill-tools', order: 2,
    label: () => t('toolsTitle'), locale: 'hanaworlds.shell',
  }, SkillToolsSettings))
  safeSlots.inject('settings.section', () => safeSlots.register({
    name: 'settings.section', id: 'hanaworlds-shell', order: 1,
    label: () => t('nav'), locale: 'hanaworlds.shell',
    inject: () => ({
      readRegistries: async () => {
        const answer = await ctx.remote.pluginManager.registries()
        if (!answer.ok) throw new Error('HanaWorlds Shell: registry configuration unavailable')
        return answer.value
      },
      openPlugins: () => { ctx.layout.selectPanel('plugins' as MainPanelId) },
    }),
  }, ShellSettings))
}
