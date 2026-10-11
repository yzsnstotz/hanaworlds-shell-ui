// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import { HanaShellPage, type ShellPanel } from '../src/client/HanaShellPage.tsx'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
import { en, type Key } from '../src/client/locales.ts'

const Page = HanaShellPage as unknown as ComponentType<{
  panel: ShellPanel
  navigate: () => void
  t: (key: Key) => string
}>

const bound = (sessionId: string, worldRef: string) => ({
  phase: 'bound' as const,
  view: { sessionId, worldRef, localContext: { connectionRef: 'local', connectionIncarnationRef: 'open', worldRef, selectionRevision: 'selected' }, serviceIdentity: 'fixture-service', source: 'FIXTURE' as const },
})

it('does not label a normal Home as fixture-backed', async () => {
  installDesktopBridgeFixture({ view: {
    current: async () => ({ phase: 'unselected' }),
    subscribe: () => () => {},
    fixtureAvailable: async () => false,
  } })
  render(<Page panel="hana-home" navigate={() => {}} t={key => en[key]} />)
  await screen.findByText(en.needsBinding)
  expect(screen.queryByText(en.fixtureNotice)).toBeNull()
  expect(screen.getByRole('button', { name: /Manage plugins/ })).toBeTruthy()
})

afterEach(() => {
  cleanup()
})

it('clears a Workshop draft when the trusted Core Session changes', async () => {
  let current = bound('alpha', 'world-a')
  let listener: () => void = () => {}
  installDesktopBridgeFixture({ view: {
    current: async () => current,
    subscribe: (next: () => void) => { listener = next; return () => {} },
    fixtureAvailable: async () => true,
    history: async () => ({ sessionId: current.view.sessionId, worldRef: current.view.worldRef,
      source: 'FIXTURE', turns: [], pending: null }),
  } })
  render(<Page panel="hana-workshop" navigate={() => {}} t={key => en[key]} />)
  await screen.findByText('alpha')
  const draft = screen.getByRole('textbox', { name: en.workshopDraft }) as HTMLTextAreaElement
  fireEvent.change(draft, { target: { value: 'alpha private draft' } })
  expect(draft.value).toBe('alpha private draft')
  current = bound('beta', 'world-b')
  await act(async () => { listener() })
  await screen.findByText('beta')
  await waitFor(() => { expect(draft.value).toBe('') })
  expect(screen.queryByText('alpha private draft')).toBeNull()
})


it('shows the actual model reply and disables writes while HTTP Prepare is active', async () => {
  let finish!: (value: object) => void
  const prepared = new Promise<object>((resolve) => { finish = resolve })
  installDesktopBridgeFixture({
    view: {
      current: async () => bound('alpha', 'world-a'), subscribe: () => () => {}, fixtureAvailable: async () => true,
      history: async () => ({ sessionId: 'alpha', worldRef: 'world-a', source: 'FIXTURE', turns: [], pending: null }),
      prepare: async () => prepared,
    },
    build: async () => ({ error: null, result: { sessionRef: 'alpha', worldRef: 'world-a', turnRevision: 't1', availability: 'AVAILABLE', head: { historyRevision: 'h1', headTransactionId: 'tx1' } } }),
  })
  try {
    render(<Page panel="hana-workshop" navigate={() => {}} t={key => en[key]} />)
    const build = await screen.findByRole('button', { name: en.buildCurrent }) as HTMLButtonElement
    await waitFor(() => expect(build.disabled).toBe(false))
    fireEvent.change(screen.getByRole('textbox', { name: en.workshopDraft }), { target: { value: 'a stone hut' } })
    fireEvent.click(screen.getByRole('button', { name: en.workshopPrepare }))
    await waitFor(() => expect(build.disabled).toBe(true))
    expect((screen.getByRole('button', { name: en.undoCurrent }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { finish({ sessionId: 'alpha', worldRef: 'world-a', source: 'FIXTURE', turns: [], pending: null, modelReply: 'What node dimensions should this hut use?' }); await prepared })
    expect(await screen.findByText('What node dimensions should this hut use?')).toBeTruthy()
    await waitFor(() => expect(build.disabled).toBe(false))
  } finally {
    finish({})
  }
})
