// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SkillToolsSettings } from '../src/client/SkillToolsSettings.tsx'
import type {} from '../src/client/index.ts'
import { installDesktopBridgeFixture } from './fixtures/desktop-bridge.ts'
import { en, zh } from '../src/client/locales.ts'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('shows current descriptions and unmet region needs without exposing execution controls', async () => {
  const catalog = { kind: 'HANAWORLDS_SKILL_TOOLS',
    tools: { value: [{ name: 'hanaworlds_region_proposal', description: 'Actual registered region description' }], error: null },
    skills: { value: [{ name: 'hanaworlds-building', description: 'Actual registered skill description', whenToUse: 'Building and terrain',
      source: 'bundled', provider: 'runtime', invocation: { modelInvocable: true, userInvocable: true } }], error: null, complete: true } }
  const methods = { kind: 'K3_COMPOSITION', writeTools: { value: { skillGuidance: 'Choose by task; no threshold', tools: [{
    descriptor: { method: 'REGION', toolName: 'hanaworlds_region_proposal', purpose: 'Fill and dig terrain', typicalScale: 'Contiguous terrain region', scaleUnit: 'node', unavailableReason: 'WORLD_NOT_SELECTED' },
    guidance: { whenToUse: 'Fill a hillside', notFor: 'Individual details', input: 'Region voxels' },
  }] }, error: null }, regionSeams: [{ seam: 'Canvas → Adapter', compatible: false, unmet: { code: 'PEER_UNAVAILABLE', need: 'Install the region provider' } }] }
  const request = vi.fn(async (url: string) => url === '/api-hanaworlds-skill-tools' ? catalog : methods)
  const current = vi.fn(async () => ({ phase: 'unselected' }))
  const build = vi.fn(), prepare = vi.fn(), confirm = vi.fn()
  const bridge = installDesktopBridgeFixture({ reads: request, view: { current, prepare, confirm } })
  const view = render(<SkillToolsSettings t={key => (en as Readonly<Record<string, string>>)[key] ?? key} />)
  await screen.findByText('Actual registered skill description')
  await screen.findByText('Fill a hillside')
  expect(view.container.textContent).toContain('WORLD_NOT_SELECTED')
  expect(view.container.textContent).toContain('PEER_UNAVAILABLE')
  expect(screen.getByText(en.toolsUnbound)).toBeDefined()
  expect(screen.queryAllByRole('button')).toEqual([])
  expect(request.mock.calls.map(([url]) => url)).toEqual(['/api-hanaworlds-skill-tools', '/api-hanaworlds-k3'])
  expect(bridge.calls.every(call => call.method === 'GET')).toBe(true)
  expect(build).not.toHaveBeenCalled(); expect(prepare).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled()
  await expect(view.container.textContent).toMatchFileSnapshot('./expected/skill-tools.txt')
})
it('keeps tool facts visible when skill discovery and Workshop descriptions are unavailable', async () => {
  installDesktopBridgeFixture({ reads: async (url: string) => url === '/api-hanaworlds-skill-tools'
    ? { kind: 'HANAWORLDS_SKILL_TOOLS', tools: { value: [{ name: 'hanaworlds_context', description: 'Current context description' }], error: null },
      skills: { value: null, complete: false, error: 'SKILL_REGISTRY_UNAVAILABLE' } }
    : { kind: 'K3_COMPOSITION', writeTools: { value: null, error: 'WRITE_METHODS_UNAVAILABLE' }, regionSeams: [] },
    view: { current: async () => ({ phase: 'bound', view: { source: 'FIXTURE' } }) } })
  const view = render(<SkillToolsSettings t={key => (zh as Readonly<Record<string, string>>)[key] ?? key} />)
  await screen.findByText('Current context description')
  await screen.findByText(/WRITE_METHODS_UNAVAILABLE/)
  expect(view.container.textContent).toContain('SKILL_REGISTRY_UNAVAILABLE')
  expect(screen.getByText(zh.toolsIncomplete)).toBeDefined()
  expect(screen.getByText(zh.toolsFixture)).toBeDefined()
  expect(screen.queryByText(zh.toolsNoSkills)).toBeNull()
})
it('names failed Host reads instead of inventing an available tool list', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
  render(<SkillToolsSettings t={key => (en as Readonly<Record<string, string>>)[key] ?? key} />)
  await screen.findByText(/UNKNOWN.*WRITE_METHODS_UNAVAILABLE/)
  expect(screen.getAllByText(/HANAWORLDS_SKILL_TOOLS_UNAVAILABLE/)).toHaveLength(2)
  expect(screen.queryByText('hanaworlds-building')).toBeNull()
  expect(screen.getByText(en.toolsBindingUnknown)).toBeDefined()
})
