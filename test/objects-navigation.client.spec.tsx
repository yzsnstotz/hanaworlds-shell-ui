// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HanaShellPage } from '../src/client/HanaShellPage.tsx'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

it('opens the public Canvas objects/history panel from Home', async () => {
  installDesktopBridgeFixture({ view: { current: async () => ({ phase: 'unselected' }) } })
  const navigate = vi.fn()
  render(<HanaShellPage panel="hana-home" navigate={navigate} t={key => en[key as keyof typeof en]} />)
  fireEvent.click(screen.getByText(`03 / ${en.objectsNav}`))
  expect(navigate).toHaveBeenCalledWith('hanaworlds-canvas-objects-history')
  await screen.findByText(en.needsBinding)
  expect(document.body.textContent).not.toMatch(/尚未接入|not connected.*yet/i)
  await expect(document.body.textContent).toMatchFileSnapshot('./expected/home.txt')
})
