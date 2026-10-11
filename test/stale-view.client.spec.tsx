// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import { HanaShellPage } from '../src/client/HanaShellPage.tsx'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
import { en, type Key } from '../src/client/locales.ts'

const Page = HanaShellPage as unknown as ComponentType<{ panel: 'hana-home'; navigate: () => void; t: (key: Key) => string }>

afterEach(() => { cleanup();  })

it.each([
  ['changed connection', { phase: 'rejected', reason: 'CONTEXT_CHANGED' }],
  ['disconnected Adapter', { phase: 'rejected', reason: 'SERVICE_CHANGED' }],
  ['switched Core Session', { phase: 'bound', view: { sessionId: 'beta', worldRef: 'world-b', actorRef: 'player-b',
    localContext: { connectionRef: 'connection:grant-b', connectionIncarnationRef: 'open:2', worldRef: 'fixture-world', selectionRevision: 'select:2' }, serviceIdentity: 'service-a', source: 'FIXTURE' } }],
] as const)('does not restore old player/world after %s', async (_case, latest) => {
  const pending: Array<(value: unknown) => void> = []
  let changed: () => void = () => {}
  installDesktopBridgeFixture({ view: {
    current: () => new Promise((resolve) => { pending.push(resolve) }),
    subscribe: (listener: () => void) => { changed = listener; return () => {} },
    fixtureAvailable: async () => false,
    history: async () => ({ sessionId: 'alpha', worldRef: 'world-a', source: 'FIXTURE', turns: [], pending: null }),
  } })
  const bound = { phase: 'bound', view: { sessionId: 'alpha', worldRef: 'world-a', actorRef: 'player-a',
    localContext: { connectionRef: 'connection:grant-a', connectionIncarnationRef: 'open:1', worldRef: 'fixture-world', selectionRevision: 'select:1' }, serviceIdentity: 'service-a', source: 'FIXTURE' } }
  render(<Page panel="hana-home" navigate={() => {}} t={key => en[key]} />)
  await waitFor(() => { expect(pending.length).toBe(1) })
  await act(async () => { pending[0]!(bound) })
  await screen.findByText('world-a')
  fireEvent.click(screen.getByRole('button', { name: en.refreshView }))
  expect(pending.length).toBe(2)
  await act(async () => { changed() })
  expect(pending.length).toBe(3)
  await act(async () => { pending[2]!(latest) })
  if (latest.phase === 'rejected') await screen.findByText(new RegExp(latest.reason))
  else await screen.findByText('world-b')
  await act(async () => { pending[1]!(bound) })
  expect(screen.queryByText('world-a')).toBeNull()
  expect(screen.queryByText('player-a')).toBeNull()
  if (latest.phase === 'bound') expect(screen.getByText('world-b')).toBeTruthy()
})
