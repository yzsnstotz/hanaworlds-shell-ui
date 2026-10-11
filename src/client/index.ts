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
import { HanaShellPage, ShellPanelIcon, type ShellPanel } from './HanaShellPage.tsx'
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
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('hanaworlds.shell', { en, zh }), 'hanaworlds-shell: locale')
  ctx.effect(() => ctx.theme.overrideTokens('hanaworlds-shell', HANA_THEME_TOKENS), 'hanaworlds-shell: palette')
  const t = ctx.locale.bind('hanaworlds.shell')
  ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({ name: 'sidebar.brand.mark' }, BrandMark))
  ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({ name: 'sidebar.brand.name' }, BrandName))
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({
    name: 'conversation.hero.brand.mark',
  }, HeroBrandMark))
  const panels: readonly { id: ShellPanel; order: number; label: Key }[] = [
    { id: 'hana-home', order: -40, label: 'homeNav' },
    { id: 'hana-workshop', order: -30, label: 'workshopNav' },
    { id: 'hana-world', order: -20, label: 'worldNav' },
  ]
  for (const panel of panels) {
    ctx.slots.inject('main', function* () {
      yield ctx.slots.register({
        name: 'main', key: panel.id as MainPanelId, locale: 'hanaworlds.shell',
        inject: () => ({ panel: panel.id, navigate: (id: ShellPanel | 'plugins' | 'hanaworlds-canvas-objects-history') => {
          ctx.layout.selectPanel(id as MainPanelId)
        } }),
      }, HanaShellPage)
      if (panel.id === 'hana-home' && ctx.layout.panelInfo.getSnapshot().activePanelId === null) {
        ctx.layout.selectPanel(panel.id as MainPanelId)
      }
    })
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist', id: panel.id, order: panel.order,
      label: () => t(panel.label), locale: 'hanaworlds.shell',
      inject: () => ({ panel: panel.id }),
    }, ShellPanelIcon))
  }
  const readPlugins: PluginStatusFace['read'] = async () => {
    const host = await ctx.remote.pluginManager.listPlugins()
    if (!host.ok) throw new Error('HANAWORLDS_PLUGIN_INVENTORY_UNAVAILABLE')
    const response = await fetch('/api-hanaworlds-deployment')
    if (!response.ok) throw new Error('HANAWORLDS_PLUGIN_IDENTITY_UNAVAILABLE')
    const deployment = await response.json() as { kind: string; packages: (NonNullable<PluginObservation['identity']> & { name: string })[] }
    if (deployment.kind !== 'DEPLOYMENT_CONFIGURATION' || !Array.isArray(deployment.packages)) {
      throw new Error('HANAWORLDS_PLUGIN_IDENTITY_UNAVAILABLE')
    }
    const failures = ctx.modules.entries.state.getSnapshot().failures
    const client: Entry[] = [...ctx.loader.entries()]
    const roster = [
      { name: 'hanaworlds-shell-ui', hostRequired: false, clientRequired: true },
      { name: 'hanaworlds-adapter-luanti', hostRequired: true, clientRequired: false },
      { name: 'hanaworlds-canvas', hostRequired: true, clientRequired: true },
      { name: 'hanaworlds-brush', hostRequired: true, clientRequired: false },
      { name: 'hanaworlds-building-exterior-painter', hostRequired: true, clientRequired: false },
      { name: 'hanaworlds-workshop', hostRequired: true, clientRequired: true },
    ]
    const plugins = roster.map((item) => {
      const hosts = host.value.filter(row => row.moduleName === item.name)
      const hostEntry = hosts.length === 1 ? hosts[0] : undefined
      const clients = client.filter(row => row.options.name === item.name)
      const failed = failures.find(row => row.id === item.name)
      const browser = clients.length === 1 ? clients[0] : undefined
      const clientPhase: PluginPhase | null = failed ? { enabled: browser ? !browser.disabled : true, phase: 'failed', reason: failed.message }
        : browser ? { enabled: !browser.disabled, phase: browser.fiber?.state === CLIENT_ACTIVE ? 'active' : browser.fiber?.state === CLIENT_FAILED ? 'failed' : 'waiting' } : null
      return { ...item, identity: deployment.packages.find(row => row.name === item.name) ?? null,
        host: hostEntry ? { enabled: hostEntry.enabled, phase: hostEntry.fiberPhase } : null,
        client: clientPhase }
    })
    return { plugins, sdk: deployment.packages.find(row => row.name === 'hanaworlds-contracts') ?? null }
  }
  ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item', id: 'hanaworlds-runtime', order: -10, label: () => t('pluginsTitle'),
    locale: 'hanaworlds.shell', inject: () => ({ read: readPlugins }),
  }, PluginStatus))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'hanaworlds-skill-tools', order: 2,
    label: () => t('toolsTitle'), locale: 'hanaworlds.shell',
  }, SkillToolsSettings))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
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
