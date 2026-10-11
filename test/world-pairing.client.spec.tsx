// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { WorldPairing } from '../src/client/WorldPairing.tsx'
import { en } from '../src/client/locales.ts'

import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
afterEach(() => {
  cleanup()
})
it('connects the selected local world without account or permission fields', async () => {
  const selected = { sessionId: 'one', worldPath: '/world', worldRef: null, gameId: 'game', payloadVersion: null, paired: false, endpoint: null, localContext: null }
  const invoke = vi.fn(async (input: { action: string }) => {
    if (input.action === 'catalog') return { worlds: [] }
    if (input.action === 'current') return null
    if (input.action === 'choose') return selected
    if (input.action === 'connect') return { ...selected, paired: true, worldRef: 'world', endpoint: { host: '127.0.0.1', port: 40000 } }
    throw Error('unexpected')
  })
  installDesktopBridgeFixture({ worlds: { invoke } })
  render(<WorldPairing t={key => en[key]} />)
  fireEvent.click(screen.getByText(en.pairAdvanced))
  fireEvent.click(screen.getByRole('button', { name: en.pairChoose }))
  await screen.findByRole('button', { name: en.pairConnect })
  expect(screen.queryByLabelText(en.pairAdmin)).toBeNull()
  expect(screen.queryByLabelText(en.pairPassword)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: en.pairConnect }))
  await waitFor(() => { expect(invoke).toHaveBeenCalledWith({ action: 'connect' }) })
  await screen.findByText('127.0.0.1:40000')
})

it('reconciles rejected refresh with current Host state and removes a stopped endpoint', async () => {
  const selected = { sessionId: 'one', worldPath: '/world', worldRef: 'world', gameId: 'game', payloadVersion: '0.2.6', paired: true, endpoint: { host: '127.0.0.1', port: 40000 }, players: [] }
  let ended = false
  const invoke = vi.fn(async (input: { action: string }) => {
    if (input.action === 'catalog') return { worlds: [] }
    if (input.action === 'current') return ended ? { ...selected, paired: false, endpoint: null } : selected
    if (input.action === 'refresh') { ended = true; throw Error('WORLD_CONNECTION_CHANGED') }
    throw Error('unexpected')
  })
  installDesktopBridgeFixture({ worlds: { invoke } })
  render(<WorldPairing t={key => en[key]} />)
  await screen.findByText('127.0.0.1:40000')
  fireEvent.click(screen.getByRole('button', { name: en.pairRefresh }))
  await screen.findByRole('alert')
  await screen.findByRole('button', { name: en.pairConnect })
  expect(screen.queryByText(en.pairPaired)).toBeNull()
  expect(screen.queryByText('127.0.0.1:40000')).toBeNull()
})

it('creates in the current conversation and displays distinct flat worlds after each click', async () => {
  const worlds: object[] = []
  const invoke = vi.fn(async (input: { action: string; sessionId?: string }) => {
    if (input.action === 'catalog') return { worlds: [...worlds] }
    if (input.action === 'current') return null
    if (input.action === 'createFlat') {
      expect(input.sessionId).toBe('current-conversation')
      const name = `Flat world ${worlds.length + 1}`
      worlds.push({ connectionRef: name, worldPath: `/worlds/${name}`, worldRef: name, gameId: 'mineclone2', name, terrain: 'flat' })
      return { sessionId: input.sessionId, worldPath: `/worlds/${name}`, worldRef: name, gameId: 'mineclone2', paired: false, endpoint: null }
    }
    throw Error('unexpected')
  })
  installDesktopBridgeFixture({ worlds: { invoke } })
  render(<WorldPairing t={key => en[key]} sessionId="current-conversation" />)
  await waitFor(() => { expect(invoke).toHaveBeenCalledWith({ action: 'catalog' }) })
  fireEvent.click(screen.getByRole('button', { name: en.pairCreateFlat }))
  await screen.findByText('Flat world 1')
  fireEvent.click(screen.getByRole('button', { name: en.pairCreateFlat }))
  await screen.findByText('Flat world 2')
  expect(screen.getByText('Flat world 1')).toBeTruthy()
  expect(screen.getAllByText(en.pairFlat)).toHaveLength(2)
  await expect(document.body.textContent).toMatchFileSnapshot('./expected/flat-world.txt')
})

it('explains missing game content without displaying a raw IPC error', async () => {
  installDesktopBridgeFixture({ worlds: { invoke: async (input: { action: string }) => {
    if (input.action === 'catalog') return { worlds: [] }
    if (input.action === 'current') return null
    throw Error('FLAT_WORLD_PREREQUISITE_MISSING: [{"need":"GAME"}]')
  } } })
  render(<WorldPairing t={key => en[key]} />)
  fireEvent.click(screen.getByRole('button', { name: en.pairCreateFlat }))
  expect((await screen.findByRole('alert')).textContent).toBe(en.pairContentMissing)
})

it('switches back to an existing named world in the same conversation without creating one', async () => {
  const worlds = [1, 2].map(id => ({ connectionRef: `connection:${id}`, worldPath: `/worlds/${id}`, name: `Flat world ${id}`, terrain: 'flat' }))
  const state = (id: number) => ({ sessionId: 'current-conversation', worldPath: `/worlds/${id}`, worldRef: `world:${id}`, gameId: 'game', payloadVersion: 'fixture', paired: true,
    endpoint: { host: '127.0.0.1', port: 40000 + id }, localContext: { connectionRef: `connection:${id}`, worldRef: `world:${id}`, connectionIncarnationRef: `open:${id}`, selectionRevision: `selection:${id}` } })
  let current = state(2)
  const invoke = vi.fn(async (input: { action: string; sessionId?: string; connectionRef?: string }) => {
    if (input.action === 'catalog') return { worlds }
    if (input.action === 'current') return current
    if (input.action === 'switch') { current = state(1); return current }
    throw Error('unexpected')
  })
  installDesktopBridgeFixture({ worlds: { invoke } })
  render(<WorldPairing t={key => en[key]} sessionId="current-conversation" />)
  const switchA = await screen.findByRole('button', { name: 'Switch to this world · Flat world 1' })
  const rows = screen.getAllByRole('listitem')
  expect(within(rows[1]!).getByText(en.pairPaired)).toBeTruthy()
  fireEvent.click(switchA)
  await waitFor(() => { expect(within(rows[0]!).getByText(en.pairPaired)).toBeTruthy() })
  expect(invoke).toHaveBeenCalledWith({ action: 'switch', sessionId: 'current-conversation', connectionRef: 'connection:1' })
  expect(invoke.mock.calls.some(([input]) => input.action === 'createFlat')).toBe(false)
  expect(screen.getAllByText(en.pairPaired)).toHaveLength(1)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  const identity = screen.getByText('world:1').closest('details')
  expect(identity).not.toBeNull()
  expect(identity?.open).toBe(false)
})


it('confirms the exact named world and data loss, cancels without deletion, and removes only after success', async () => {
  let deleted = false
  const world = { connectionRef: 'connection:A', worldRef: 'world:A', worldPath: '/worlds/A', name: 'Garden A', terrain: 'flat' }
  const invoke = vi.fn(async (input: { action: string; confirmationRef?: string }) => {
    if (input.action === 'catalog') return { worlds: deleted ? [] : [world] }
    if (input.action === 'current') return null
    if (input.action === 'describeDelete') return { worldName: 'Garden A', worldRef: 'world:A', connectionRef: 'connection:A',
      dataLoss: { scope: 'ENTIRE_WORLD_DIRECTORY', files: 3, bytes: 17 }, confirmationRef: 'exact-confirmation', reason: null }
    if (input.action === 'deleteWorld') {
      expect(input.confirmationRef).toBe('exact-confirmation'); deleted = true; return { deleted: true }
    }
    throw Error('unexpected')
  })
  installDesktopBridgeFixture({ worlds: { invoke } })
  render(<WorldPairing t={key => en[key]} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Delete world · Garden A' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Garden A')).toBeTruthy()
  expect(dialog.textContent).toContain('3'); expect(dialog.textContent).toContain('17')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(invoke.mock.calls.some(([input]) => input.action === 'deleteWorld')).toBe(false)
  expect(screen.getByText('Garden A')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Delete world · Garden A' }))
  const confirmed = await screen.findByRole('dialog')
  await expect(confirmed.textContent).toMatchFileSnapshot('./expected/delete-world.txt')
  fireEvent.click(within(confirmed).getByRole('button', { name: 'Delete this world' }))
  await waitFor(() => { expect(screen.queryByText('Garden A')).toBeNull() })
})
it('names a live binding blocker and keeps the list after rejected deletion', async () => {
  const world = { connectionRef: 'A', worldRef: 'A', worldPath: '/A', name: 'Garden A', terrain: 'flat' }
  installDesktopBridgeFixture({ worlds: { invoke: async (input: { action: string }) => {
    if (input.action === 'catalog') return { worlds: [world] }
    if (input.action === 'current') return null
    if (input.action === 'describeDelete') return { worldName: 'Garden A', dataLoss: { files: 3, bytes: 17 },
      confirmationRef: null, reason: 'WORLD_LIVE_SESSION_BOUND' }
    throw Error('unexpected')
  } } })
  render(<WorldPairing t={key => en[key]} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Delete world · Garden A' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.textContent).toContain('Switch or unbind every conversation connected to this world first.')
  expect(within(dialog).queryByRole('button', { name: 'Delete this world' })).toBeNull()
  expect(screen.getAllByText('Garden A')).toHaveLength(2)
})
