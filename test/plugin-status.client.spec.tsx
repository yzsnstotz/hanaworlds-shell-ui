// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PluginStatus, type PluginObservation } from '../src/client/PluginStatus.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)
const identity = { version: '0.6.1', sourceRevision: 'FIXTURE-source', tarSha256: 'FIXTURE-tar' }
const active = { enabled: true, phase: 'active' }
const canvas: PluginObservation = { name: 'hanaworlds-canvas', hostRequired: true, clientRequired: true,
  host: active, client: active, identity }

it('requires both live halves and keeps installed SDK separate from runtime state', async () => {
  const read = vi.fn(async () => ({ plugins: [canvas], sdk: identity }))
  render(<PluginStatus view="page" read={read} t={key => en[key as keyof typeof en]} />)
  await screen.findByText(en.pluginsRunning)
  expect(screen.getByText(en.pluginsSdk)).toBeTruthy()
  expect(screen.getAllByText(en.pluginsRunning)).toHaveLength(1)
  await expect(document.body.textContent).toMatchFileSnapshot('./expected/plugin-status.txt')
})

it('reports client failure and its original reason even with an active Host and installed package', async () => {
  const read = async () => ({ plugins: [{ ...canvas, client: { enabled: true, phase: 'failed', reason: 'FIXTURE-original-factory-error' } }], sdk: identity })
  render(<PluginStatus view="page" read={read} t={key => en[key as keyof typeof en]} />)
  await screen.findByText(en.pluginsFailed)
  expect(screen.getByText(/FIXTURE-original-factory-error/)).toBeTruthy()
  expect(screen.queryByText(en.pluginsRunning)).toBeNull()
})

it('clears previous running observations when a requested read fails', async () => {
  const read = vi.fn().mockResolvedValueOnce({ plugins: [canvas], sdk: identity }).mockRejectedValueOnce(Error('FIXTURE-read-refused'))
  render(<PluginStatus view="page" read={read} t={key => en[key as keyof typeof en]} />)
  await screen.findByText(en.pluginsRunning)
  fireEvent.click(screen.getByRole('button', { name: en.pluginsRead }))
  await screen.findByRole('alert')
  await waitFor(() => { expect(screen.queryByText(en.pluginsRunning)).toBeNull() })
})

it('does not infer activation for an absent Client or a disabled Host', async () => {
  const read = async () => ({ plugins: [{ ...canvas, client: null }, { ...canvas, name: 'disabled-fixture', host: { enabled: false, phase: 'active' } }], sdk: null })
  render(<PluginStatus view="page" read={read} t={key => en[key as keyof typeof en]} />)
  await screen.findByText(en.pluginsDisabled)
  expect(screen.getAllByText(en.pluginsUnknown).length).toBeGreaterThan(0)
  expect(screen.queryByText(en.pluginsRunning)).toBeNull()
})
