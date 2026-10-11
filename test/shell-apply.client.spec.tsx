/// <reference types="node" />
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/client/index.ts'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import type { ClientBundleRegistration, ClientModuleLoaderTarget } from '@deepseek-ai/dsh-client-modules/client'
import { en } from '../src/client/locales.ts'
import type { PluginStatusFace } from '../src/client/PluginStatus.tsx'
import type { ComponentType } from 'react'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
import { createPluginRolesMock, type ReadPluginRolesResponse } from 'hanaworlds-contracts'

const roleFixture = JSON.parse(readFileSync(createRequire(import.meta.url).resolve('hanaworlds-contracts/fixtures/plugin-roles'), 'utf8')) as {
  reject: { title: string; code: string; request: unknown; response: unknown }[]
  exchanges: { title: string; wire: 'world-inspection/v1'; operation: 'ReadPluginRoles'; host: Parameters<typeof createPluginRolesMock>[0]; response: ReadPluginRolesResponse }[]
}
function installRoles(index = 0) {
  const exchange = roleFixture.exchanges[index]!
  const mock = createPluginRolesMock(exchange.host)
  return installDesktopBridgeFixture({ reads: async url => {
    if (url !== '/api-hanaworlds-plugin-roles') throw Error(`FIXTURE_UNEXPECTED_ROLE_ROUTE: ${url}`)
    return mock(exchange.wire, exchange.operation, { contractVersion: exchange.wire, requestId: 'fixture:roles' })
  } })
}

afterEach(cleanup)
function shellFixture({ deferred = false, failTheme = false, failLocale = false, failSlot = '' } = {}) {
  installRoles()
  const seats: { options: Record<string, unknown>; component: ComponentType<Record<string, unknown>> }[] = []
  const pending: (() => void)[] = []
  const ctx = {
    effect: (work: () => unknown) => work(),
    locale: { register: () => { if (failLocale) throw Error('FIXTURE-locale-refused') }, bind: () => (key: keyof typeof en) => en[key] },
    theme: { overrideTokens: () => { if (failTheme) throw Error('FIXTURE-palette-refused') } },
    slots: {
      inject: (_name: string, factory: () => unknown) => {
        const run = () => { const value = factory(); if (value && typeof value === 'object' && Symbol.iterator in value) [...value as Iterable<unknown>] }
        if (deferred) pending.push(run); else run()
      },
      register: (options: Record<string, unknown>, component: ComponentType<Record<string, unknown>>) => {
        if (options.key === failSlot) throw Error('FIXTURE-panel-refused')
        seats.push({ options, component }); return () => {}
      },
    },
    layout: { panelInfo: { getSnapshot: () => ({ activePanelId: null }) }, selectPanel: vi.fn() },
    remote: { pluginManager: { listPlugins: vi.fn(async () => ({ ok: true, value: [] })), listBundles: vi.fn(async () => ({ ok: true, value: [] })) } },
    modules: { manifest: { plugins: [] }, importError: () => undefined, entries: { state: { getSnapshot: () => ({ failures: [] }) } } },
    loader: { entries: () => [] },
  }
  return { ctx: ctx as unknown as Context, seats, pending }
}
function renderSeat(seat: ReturnType<typeof shellFixture>['seats'][number], extra = {}) {
  const props = (seat.options.inject as (() => object) | undefined)?.() ?? {}
  const Component = seat.component
  return render(<Component {...props} {...extra} t={(key: keyof typeof en) => en[key]} />)
}
it.each(['theme', 'locale'])('contains %s apply errors and keeps Home, Workshop, World and Plugins registered', async failure => {
  const fixture = shellFixture({ failTheme: failure === 'theme', failLocale: failure === 'locale' })
  expect(() => apply(fixture.ctx)).not.toThrow()
  expect(fixture.seats.filter(row => row.options.name === 'main').map(row => row.options.key)).toEqual(['hana-home', 'hana-workshop', 'hana-world'])
  const faultSeat = fixture.seats.find(row => row.options.id === 'hanaworlds-shell-faults')!
  renderSeat(faultSeat, { view: 'page' })
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('hanaworlds-shell-ui')
  expect(alert.textContent).toContain(failure === 'theme' ? 'FIXTURE-palette-refused' : 'FIXTURE-locale-refused')
})
it('contains delayed generator registration errors and preserves healthy panels', async () => {
  const fixture = shellFixture({ deferred: true, failSlot: 'hana-workshop' })
  apply(fixture.ctx)
  for (const run of fixture.pending) expect(run).not.toThrow()
  expect(fixture.seats.filter(row => row.options.name === 'main').map(row => row.options.key)).toEqual(['hana-home', 'hana-world'])
  renderSeat(fixture.seats.find(row => row.options.key === 'hana-home')!)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.startWorkshop) }))
  expect(fixture.ctx.layout.selectPanel).toHaveBeenCalledWith('hana-workshop')
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('hanaworlds-shell-ui')
  expect(alert.textContent).toContain('FIXTURE-panel-refused')
})
it.each(roleFixture.exchanges.map((exchange, index) => ({ ...exchange, index })))('reads published roles: $title', async exchange => {
  const fixture = shellFixture()
  const http = installRoles(exchange.index)
  apply(fixture.ctx)
  const seat = fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!
  const observed = await (seat.options.inject as () => PluginStatusFace)().read()
  expect(http.calls).toEqual([{ url: '/api-hanaworlds-plugin-roles', method: 'GET', input: {} }])
  renderSeat(seat, { view: 'page' })
  if (exchange.response.result) {
    const roles = exchange.response.result
    expect(observed.roles).toEqual(roles)
    for (const [role, providers] of Object.entries(roles.providers)) {
      expect(observed.plugins.filter(row => row.role === role).map(row => row.name)).toEqual(providers.length ? providers : [role])
    }
    await screen.findByText(roles.status)
    if (roles.status !== 'COMPLETE') {
      const alert = screen.getByRole('alert')
      for (const missing of roles.missingRoles) {
        expect(alert.textContent).toContain(missing)
        const section = document.querySelector(`[data-hanaworlds-role="${missing}"]`)!
        expect(within(section as HTMLElement).getByText(en.pluginsMissing)).toBeTruthy()
        expect(within(section as HTMLElement).queryByText(en.pluginsRunning)).toBeNull()
      }
    } else expect(screen.queryByRole('alert')).toBeNull()
  } else {
    expect(observed.roles).toBeNull()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('desktop-bridge')
    expect(alert.textContent).toContain('CAPABILITY_UNAVAILABLE')
    expect(alert.textContent).toContain('REQUIRED_FACT_UNKNOWN')
    for (const role of Object.keys(roleFixture.exchanges[0]!.response.result!.providers)) expect(alert.textContent).toContain(role)
    expect(screen.queryByText(en.pluginsRunning)).toBeNull()
  }
})
it('joins a renamed role provider to the real upstream bundle version', async () => {
  const fixture = shellFixture()
  installRoles(1)
  fixture.ctx.remote.pluginManager.listPlugins = vi.fn(async () => ({ ok: true as const, value: [
    { entryId: 'fixture:world' as never, moduleName: 'acme-voxel-world-source', enabled: true, fiberPhase: 'active' as const, readOnlyReason: 'management-required' as const },
  ] }))
  fixture.ctx.remote.pluginManager.listBundles = vi.fn(async () => ({ ok: true as const, value: [
    { name: 'alternative-world-bundle', version: '7.8.9', enabled: true, installed: true, official: false, availability: 'profile' as const, optional: false, removable: true,
      rows: [{ rowId: 'world', moduleName: 'acme-voxel-world-source' }], overrides: [] },
  ] }))
  apply(fixture.ctx)
  const seat = fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!
  const observed = await (seat.options.inject as () => PluginStatusFace)().read()
  expect(observed.plugins.some(row => row.name === 'hanaworlds-adapter-luanti')).toBe(false)
  expect(observed.plugins.find(row => row.name === 'acme-voxel-world-source')).toMatchObject({ version: '7.8.9', versionSource: 'alternative-world-bundle', host: { phase: 'active' } })
  renderSeat(seat, { view: 'page' })
  const source = await screen.findByText('acme-voxel-world-source')
  expect(within(source.closest('section')!).getByText('7.8.9')).toBeTruthy()
})
it('keeps roles unavailable even when a formerly hard-coded package is active', async () => {
  const fixture = shellFixture()
  installRoles(5)
  fixture.ctx.remote.pluginManager.listPlugins = vi.fn(async () => ({ ok: true as const, value: [
    { entryId: 'fixture:luanti' as never, moduleName: 'hanaworlds-adapter-luanti', enabled: true, fiberPhase: 'active' as const, readOnlyReason: 'management-required' as const },
  ] }))
  apply(fixture.ctx)
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
  await screen.findByText('UNAVAILABLE')
  expect(screen.queryByText('hanaworlds-adapter-luanti')).toBeNull()
  expect(screen.queryByText(en.pluginsRunning)).toBeNull()
})
it('does not invent a version when bundle ownership is ambiguous or the upstream value is absent', async () => {
  const fixture = shellFixture()
  fixture.ctx.remote.pluginManager.listBundles = vi.fn(async () => ({ ok: true as const, value: [
    ...['owner-one', 'owner-two'].map(name => ({ name, version: '1.2.3', enabled: true, installed: true, official: false, availability: 'profile' as const, optional: false, removable: true,
      rows: [{ rowId: name, moduleName: 'hanaworlds-adapter-luanti' }], overrides: [] })),
    { name: 'hanaworlds-skills', enabled: true, installed: true, official: false, availability: 'profile' as const, optional: false, removable: true, rows: [], overrides: [] },
  ] }))
  apply(fixture.ctx)
  const seat = fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!
  const result = await (seat.options.inject as () => PluginStatusFace)().read()
  expect(result.plugins.find(row => row.name === 'hanaworlds-adapter-luanti')?.version).toBeNull()
  expect(result.plugins.find(row => row.name === 'hanaworlds-skills')?.version).toBeNull()
})
// The final published rejection binds a caller request ID. This GET route mints its ID at
// Desktop; there is no client request to correlate, so the other eleven cases apply here.
it.each(roleFixture.reject.slice(0, -1))('rejects published invalid roles: $title', async rejection => {
  const fixture = shellFixture()
  installDesktopBridgeFixture({ reads: async () => rejection.response })
  expect(() => apply(fixture.ctx)).not.toThrow()
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('desktop-bridge')
  expect(alert.textContent).toContain(rejection.code)
  expect(screen.queryByText('COMPLETE')).toBeNull()
  expect(screen.queryByText(en.pluginsRunning)).toBeNull()
  expect(fixture.seats.filter(row => row.options.name === 'main')).toHaveLength(3)
})
it('rejects a route response without its bridge-owned request identity', async () => {
  const fixture = shellFixture()
  installDesktopBridgeFixture({ reads: async () => ({ ...roleFixture.exchanges[0]!.response, requestId: '' }) })
  apply(fixture.ctx)
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
  expect((await screen.findByRole('alert')).textContent).toContain('SCHEMA_INVALID')
})
it('retains the published HTTP 409 contract error and its original route reason', async () => {
  const fixture = shellFixture()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    error: 'FIXTURE-skill-catalog-incomplete', contractError: roleFixture.exchanges[7]!.response.error,
  }), { status: 409 })))
  apply(fixture.ctx)
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
  const alert = await screen.findByRole('alert')
  for (const reason of ['desktop-bridge', 'CAPABILITY_UNAVAILABLE', 'REQUIRED_FACT_UNKNOWN', 'FIXTURE-skill-catalog-incomplete']) expect(alert.textContent).toContain(reason)
})
it('clears known providers when a fresh route read returns the published refusal', async () => {
  const fixture = shellFixture()
  apply(fixture.ctx)
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
  await screen.findByText('COMPLETE')
  installRoles(7)
  fireEvent.click(screen.getByRole('button', { name: en.pluginsRead }))
  await screen.findByRole('alert')
  expect(screen.queryByText('COMPLETE')).toBeNull()
  expect(screen.queryByText('hanaworlds-adapter-luanti')).toBeNull()
})
it('shows an HTTP role route failure by name and leaves Home usable', async () => {
  const fixture = shellFixture()
  installDesktopBridgeFixture({ reads: async () => { throw Error('FIXTURE-role-route-refused') } })
  apply(fixture.ctx)
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('desktop-bridge')
  expect(alert.textContent).toContain('FIXTURE-role-route-refused')
  cleanup()
  renderSeat(fixture.seats.find(row => row.options.key === 'hana-home')!)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.startWorkshop) }))
  expect(fixture.ctx.layout.selectPanel).toHaveBeenCalledWith('hana-workshop')
})

it('executes the unchanged bd964cdf bad factory through the real DSH module system and Cordis Loader, keeping a healthy Shell panel usable', async () => {
  const registrations: ClientBundleRegistration[] = []
  const target: ClientModuleLoaderTarget = {
    mode: 'queue', pendingQueue: registrations,
    load: registration => { registrations.push(registration) },
    create: () => { throw Error('FIXTURE_BOOTSTRAP_NOT_USED') },
  }
  const modulesSource = readFileSync(createRequire(import.meta.url).resolve('@deepseek-ai/dsh-client-modules/client'), 'utf8')
  runInNewContext(modulesSource, { Error, window: { __ModuleLoader__: target } })
  const bootstrap = registrations.shift()!
  const exports = bootstrap.factory(Object.assign(() => { throw Error('FIXTURE_UNEXPECTED_MODULE_REQUEST') }, { async: async () => { throw Error('FIXTURE_UNEXPECTED_MODULE_REQUEST') } })) as unknown as typeof import('@deepseek-ai/dsh-client-modules/client')
  const name = 'hanaworlds-isolation-trial-sample'
  const healthy = 'fixture-healthy-shell'
  const graph = { rev: 'fixture:graph', entries: [name, healthy].map(id => ({ id, url: `/fixture/${id}.js`, rev: 'fixture:rev' })),
    batches: [name, healthy].map(id => ({ phase: 'application', entries: [id], url: `/fixture/${id}.js`, rev: 'fixture:rev' })) }
  const fixture = shellFixture()
  const system = exports.createClientModuleSystem(target, { id: bootstrap.id, exports: exports as unknown as Record<string, unknown> }, {
    boot: graph, staticModules: {}, loadBundle: async url => {
      if (url === `/fixture/${name}.js`) {
        runInNewContext(readFileSync(createRequire(import.meta.url).resolve('./fixtures/plugin-isolation/client.js'), 'utf8'), { Error, window: { __ModuleLoader__: target } })
      } else if (url === `/fixture/${healthy}.js`) {
        target.load({ id: healthy, factory: () => ({ apply: () => apply(fixture.ctx) }) })
      } else throw Error(`FIXTURE_UNEXPECTED_BUNDLE: ${url}`)
    },
  })
  const root = new Context()
  class MemoryLoader extends Loader {
    override write() {}
    override import(name: string) { return system.import(name) }
  }
  const loader = new MemoryLoader(root)
  try {
    await system.entries.start(loader, system.manifest)
    const failure = system.importError(name)
    expect(failure?.message).toContain('隔离试用样例：预期的首次客户端导入失败。')
    expect(system.importError(name)?.stack).toContain('factory')
    expect([...loader.entries()].some(row => row.options.name === healthy && row.fiber?.state === 2)).toBe(true)
    fixture.ctx.modules = system
    fixture.ctx.loader = loader
    renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(name)
    expect(alert.textContent).toContain(failure!.message)
    cleanup()
    renderSeat(fixture.seats.find(row => row.options.key === 'hana-home')!)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.startWorkshop) }))
    expect(fixture.ctx.layout.selectPanel).toHaveBeenCalledWith('hana-workshop')
  } finally {
    await root.fiber.dispose()
  }
})
it('reports inventory refusals as a named Shell fault without removing the other panels', async () => {
  const fixture = shellFixture()
  fixture.ctx.remote.pluginManager.listPlugins = vi.fn(async () => ({ ok: false as const, error: new RemoteError('gateway/internal', 'FIXTURE-inventory-refused', {}) }))
  apply(fixture.ctx)
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('hanaworlds-shell-ui')
  expect(alert.textContent).toContain('FIXTURE-inventory-refused')
  expect(fixture.seats.filter(row => row.options.name === 'main')).toHaveLength(3)
})
it('preserves the original reason of an optional client apply failure', async () => {
  const fixture = shellFixture()
  const root = new Context()
  const original = Error('FIXTURE-optional-apply-refused')
  const fiber = root.plugin({ apply() { throw original } })
  await expect(fiber.await()).rejects.toThrow(original.message)
  fixture.ctx.loader.entries = () => [{ options: { name: 'optional-failing-client' }, disabled: false, fiber }] as never
  apply(fixture.ctx)
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!, { view: 'page' })
  try {
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('optional-failing-client')
    expect(alert.textContent).toContain(original.message)
  } finally { await root.fiber.dispose() }
})
