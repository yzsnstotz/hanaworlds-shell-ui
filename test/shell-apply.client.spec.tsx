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

afterEach(cleanup)
function shellFixture({ deferred = false, failTheme = false, failLocale = false, failSlot = '' } = {}) {
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
it('uses explicit roles for alternative providers and upstream bundle versions, with required roles visible', async () => {
  const fixture = shellFixture()
  installDesktopBridgeFixture({ reads: async () => ({ kind: 'DEPLOYMENT_CONFIGURATION', packages: [{ name: 'different-world-source', version: '0.0.1', sourceRevision: 'FIXTURE', tarSha256: 'FIXTURE' }] }) })
  fixture.ctx.remote.pluginManager.listPlugins = vi.fn(async () => ({ ok: true as const, value: [
    { entryId: 'fixture:world' as never, moduleName: 'different-world-source', enabled: true, fiberPhase: 'active' as const, readOnlyReason: 'management-required' as const },
  ] }))
  fixture.ctx.remote.pluginManager.listBundles = vi.fn(async () => ({ ok: true as const, value: [
    { name: 'different-world-source-bundle', version: '7.8.9', enabled: true, installed: true, optional: false, removable: true,
      rows: [{ rowId: 'world', moduleName: 'different-world-source' }], overrides: [] },
  ] }))
  Reflect.apply(apply, undefined, [fixture.ctx, { roleProviders: { 'world-source': ['different-world-source'], skills: ['different-skill-one', 'different-skill-two'] } }])
  const seat = fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!
  const face = (seat.options.inject as () => PluginStatusFace)()
  const observed = await face.read()
  expect(observed.plugins.some(row => row.name === 'hanaworlds-adapter-luanti')).toBe(false)
  expect(observed.plugins.find(row => row.name === 'different-world-source')).toMatchObject({ version: '7.8.9', versionSource: 'different-world-source-bundle', host: { phase: 'active' } })
  expect(observed.plugins.map(row => row.name)).toEqual(expect.arrayContaining(['different-skill-one', 'different-skill-two', 'desktop-bridge', 'local-runtime']))
  renderSeat(seat, { view: 'page' })
  const source = await screen.findByText('different-world-source')
  expect(within(source.closest('section')!).getByText('7.8.9')).toBeTruthy()
  expect(fixture.ctx.remote.pluginManager.listBundles).toHaveBeenCalled()
})
it('keeps unassigned roles unknown even if a formerly hard-coded package is active', async () => {
  const fixture = shellFixture()
  installDesktopBridgeFixture({ reads: async () => ({ kind: 'DEPLOYMENT_CONFIGURATION', packages: [{ name: 'different-world-source', version: '0.0.1', sourceRevision: 'FIXTURE', tarSha256: 'FIXTURE' }] }) })
  fixture.ctx.remote.pluginManager.listPlugins = vi.fn(async () => ({ ok: true as const, value: [
    { entryId: 'fixture:luanti' as never, moduleName: 'hanaworlds-adapter-luanti', enabled: true, fiberPhase: 'active' as const, readOnlyReason: 'management-required' as const },
  ] }))
  apply(fixture.ctx)
  const seat = fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!
  renderSeat(seat, { view: 'page' })
  const role = await screen.findByText('world-source')
  expect(within(role.closest('section')!).getAllByText(en.pluginsUnknown).length).toBeGreaterThan(0)
  expect(screen.queryByText('hanaworlds-adapter-luanti')).toBeNull()
})
it('does not invent a version when bundle ownership is ambiguous or the upstream value is absent', async () => {
  const fixture = shellFixture()
  fixture.ctx.remote.pluginManager.listBundles = vi.fn(async () => ({ ok: true as const, value: [
    ...['owner-one', 'owner-two'].map(name => ({ name, version: '1.2.3', enabled: true, installed: true, optional: false, removable: true,
      rows: [{ rowId: name, moduleName: 'ambiguous-provider' }], overrides: [] })),
    { name: 'unversioned-provider', enabled: true, installed: true, optional: false, removable: true, rows: [], overrides: [] },
  ] }))
  apply(fixture.ctx, { roleProviders: { 'world-source': ['ambiguous-provider'], skills: ['unversioned-provider'] } })
  const seat = fixture.seats.find(row => row.options.id === 'hanaworlds-runtime')!
  const result = await (seat.options.inject as () => PluginStatusFace)().read()
  expect(result.plugins.find(row => row.name === 'ambiguous-provider')?.version).toBeNull()
  expect(result.plugins.find(row => row.name === 'unversioned-provider')?.version).toBeNull()
})
it('turns malformed role configuration into a named card without guessing providers or stopping apply', async () => {
  const fixture = shellFixture()
  expect(() => Reflect.apply(apply, undefined, [fixture.ctx, { roleProviders: { 'world-source': 'not-an-array' } }])).not.toThrow()
  renderSeat(fixture.seats.find(row => row.options.id === 'hanaworlds-shell-faults')!, { view: 'page' })
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('hanaworlds-shell-ui')
  expect(alert.textContent).toContain('roleProviders.world-source')
  expect(fixture.seats.filter(row => row.options.name === 'main')).toHaveLength(3)
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
