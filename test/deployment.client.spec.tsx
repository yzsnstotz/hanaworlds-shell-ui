// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ShellSettings } from '../src/client/ShellSettings.tsx'
import type {} from '../src/client/index.ts'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
import { en } from '../src/client/locales.ts'

const texts: Readonly<Record<string, string>> = en
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('shows installed geometry values explicitly as configuration rather than native measurements', async () => {
  installDesktopBridgeFixture({ reads: async url => { if (url !== '/api-hanaworlds-deployment') throw Error('FIXTURE_ROUTE_UNAVAILABLE'); return ({ kind: 'DEPLOYMENT_CONFIGURATION',
    safetyProfile: { avatarDimensions: { width: 1, height: 2, depth: 1, unit: 'node' }, connectivity: 6,
      requireBodyClearance: true, requireEntranceConnectivity: false,
      hazardPolicy: { forbidLiquid: true, maximumDamagePerSecond: 0 }, optionalLightRule: null } }) } })
  render(<ShellSettings t={key => texts[key] ?? key}
    readRegistries={async () => ({ registry: null, fallbackRegistries: [], resolved: null })} openPlugins={() => {}} />)
  await screen.findByText('1 × 2 × 1 · node')
  expect(screen.getByText(en.geometrySource).textContent).toContain('not a measured player size')
  expect(screen.getByText(en.geometryInvariant).textContent).toContain('Canvas alone')
})
