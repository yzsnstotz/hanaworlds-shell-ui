// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HanaShellPage } from '../src/client/HanaShellPage.tsx'
import { en } from '../src/client/locales.ts'
import type { ComponentType } from 'react'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
const Page = HanaShellPage as unknown as ComponentType<{ panel: 'hana-workshop'; navigate(): void; t(key: keyof typeof en): string }>
afterEach(() => { cleanup(); })
it('uses the current turn and history for build and Undo without accepting renderer world fields', async () => {
  const calls: { operation: string; payload: Record<string, unknown> }[] = []
  const localContext = { connectionRef: 'local', connectionIncarnationRef: 'open',
    worldRef: 'world', selectionRevision: 'selected' }
  const bridge = installDesktopBridgeFixture({
    view: { current: async () => ({ phase: 'bound', view: { sessionId: 'session', worldRef: 'world', localContext, serviceIdentity: 'host', source: 'FIXTURE' } }), subscribe: () => () => {}, history: async () => ({ sessionId: 'session', worldRef: 'world', source: 'FIXTURE', turns: [], pending: null }) },
    build: async (op, payload) => {
      calls.push({ operation: op, payload })
      const base = { sessionRef: 'session', worldRef: 'world', turnRef: 'turn', turnRevision: 'turn-1' }
      return { error: null, result: op === 'ReadCurrentUndoStatus' ? { ...base, availability: 'AVAILABLE', head: { historyRevision: 'history-1', headTransactionId: 'tx-1' } }
        : op === 'AdvanceCurrentBuild' ? { ...base, outcome: 'VERIFIED' }
          : { ...base, status: 'VERIFIED', beforeHead: { historyRevision: 'history-1', headTransactionId: 'tx-1' }, afterHead: { historyRevision: 'history-2', headTransactionId: null } } }
    },
  })
  render(<Page panel="hana-workshop" navigate={() => {}} t={key => en[key]} />)
  const build = await screen.findByRole('button', { name: 'Build current turn' }) as HTMLButtonElement
  await waitFor(() => { expect(build.disabled).toBe(false) })
  fireEvent.click(build)
  await screen.findByText('Build readback verified')
  fireEvent.click(screen.getByRole('button', { name: 'Undo this build' }))
  await screen.findByText('Undo readback verified')
  expect(calls.find(c => c.operation === 'UndoCurrentBuild')?.payload).toMatchObject({ expectedTurnRevision: 'turn-1', expectedHistoryRevision: 'history-1' })
  expect(bridge.calls.filter(call => call.url === '/api-hanaworlds-workshop').every(call => call.method === 'POST')).toBe(true)
  for (const call of calls) { expect(call.payload).not.toHaveProperty('localContext'); expect(call.payload).not.toHaveProperty('worldRef'); expect(call.payload).not.toHaveProperty('sessionRef') }
})

it('rejects an old session wire before enabling build controls', async () => {
  const localContext = { connectionRef: 'local', connectionIncarnationRef: 'open', worldRef: 'world', selectionRevision: 'selected' }
  installDesktopBridgeFixture({ view: {
    current: async () => ({ phase: 'bound', view: { sessionId: 'session', worldRef: 'world', localContext, serviceIdentity: 'fixture', source: 'FIXTURE' } }),
    history: async () => ({ sessionId: 'session', worldRef: 'world', source: 'FIXTURE', turns: [], pending: null }),
  } })
  const http = globalThis.fetch
  globalThis.fetch = async (url, init) => String(url) === '/api-hanaworlds-workshop'
    ? new Response(JSON.stringify({ contractVersion: 'session/v3', requestId: 'old-wire', result: null, error: null }))
    : http(url, init)
  render(<Page panel="hana-workshop" navigate={() => {}} t={key => en[key]} />)
  await screen.findByText(/UNSUPPORTED_VERSION/)
  expect((screen.getByRole('button', { name: en.buildCurrent }) as HTMLButtonElement).disabled).toBe(true)
})

it('rejects renderer authority fields at the HTTP fixture boundary', async () => {
  installDesktopBridgeFixture()
  for (const payload of [{ worldRef: 'invented' }, { sessionRef: 'invented' }, { localContext: {} }]) {
    const response = await fetch('/api-hanaworlds-workshop', { method: 'POST', body: JSON.stringify({ operation: 'ReadCurrentUndoStatus', payload }) })
    expect(response.status).toBe(409)
    expect(await response.text()).toContain('FIXTURE_RENDERER_AUTHORITY_REJECTED')
  }
})
