// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import { ShellSettings } from '../src/client/ShellSettings.tsx'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
import { en, type Key } from '../src/client/locales.ts'

const Page = ShellSettings as unknown as ComponentType<{
  t: (key: Key) => string
  readRegistries: () => Promise<unknown>
  openPlugins: () => void
}>

afterEach(() => { cleanup();  })

it('keeps revoked player and world hidden when an older Settings refresh resolves', async () => {
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
  render(<Page t={key => en[key]} readRegistries={async () => ({ registry: null, fallbackRegistries: [] })} openPlugins={() => {}} />)
  await waitFor(() => { expect(pending.length).toBe(1) })
  await act(async () => { pending[0]!(bound) })
  await screen.findByText('world-a')
  fireEvent.click(screen.getByRole('button', { name: en.refreshView }))
  expect(pending.length).toBe(2)
  await act(async () => { changed() })
  expect(pending.length).toBe(3)
  await act(async () => { pending[2]!({ phase: 'rejected', reason: 'AUTHORIZATION_REVOKED' }) })
  await screen.findByText(/AUTHORIZATION_REVOKED/)
  await act(async () => { pending[1]!(bound) })
  expect(screen.queryByText('world-a')).toBeNull()
  expect(screen.queryByText('player-a')).toBeNull()
})
