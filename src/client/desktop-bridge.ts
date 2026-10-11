/** Client HTTP boundary. Fixture routes are exercised here; real bridge ownership belongs to later cards. */
import type { AdvanceCurrentBuildResponse, ReadCurrentUndoStatusResponse, UndoCurrentBuildResponse } from 'hanaworlds-contracts'

export interface BoundView {
  readonly sessionId: string
  readonly localContext: { readonly connectionRef: string; readonly connectionIncarnationRef: string; readonly worldRef: string; readonly selectionRevision: string }
  readonly worldRef: string
  readonly serviceIdentity: string
  readonly source: 'ADAPTER' | 'FIXTURE'
}
export type ViewState = { readonly phase: 'unselected' } | { readonly phase: 'rejected'; readonly reason: string }
  | { readonly phase: 'bound'; readonly view: BoundView }
export interface WorkshopView {
  readonly sessionId: string
  readonly worldRef: string
  readonly source: 'WORKSHOP' | 'FIXTURE'
  readonly turns: readonly { readonly turnRef: string; readonly userText: string; readonly resultText: string; readonly confirmedBrief: boolean }[]
  readonly modelReply?: string | null
  readonly pending: { readonly question: string; readonly userText: string } | null
}
export interface ResearchConfig {
  readonly appId: string
  readonly profilePath: string | null
  readonly telemetry: { readonly enabled: boolean; readonly target: string | null }
  readonly updates: { readonly enabled: boolean; readonly target: string | null }
}

/** All authority stays at the bridge. No fallback, world-path mapping or native IPC. */
export async function bridgeJSON<T>(url: string, input?: object): Promise<T> {
  const response = await fetch(url, input === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  })
  if (!response.ok) {
    const body: unknown = await response.json()
    const code = typeof body === 'object' && body !== null && 'error' in body
      && typeof body.error === 'object' && body.error !== null && 'code' in body.error
      && typeof body.error.code === 'string' ? body.error.code : `BRIDGE_HTTP_${response.status}`
    throw new Error(code)
  }
  return await response.json() as T
}
export const bridgeView = {
  current: () => bridgeJSON<ViewState>('/api-hanaworlds-view'),
  choose: () => bridgeJSON<void>('/api-hanaworlds-view/choose', {}),
  history: () => bridgeJSON<WorkshopView>('/api-hanaworlds-workshop/history'),
  prepare: (text: string) => bridgeJSON<WorkshopView>('/api-hanaworlds-workshop/prepare', { text }),
  confirm: () => bridgeJSON<WorkshopView>('/api-hanaworlds-workshop/confirm', {}),
  subscribe(listener: () => void): () => void {
    const events = new EventSource('/api-hanaworlds-view/events')
    events.addEventListener('change', listener)
    // A failed stream invalidates the view through a fresh read; never retain a stale binding.
    events.addEventListener('error', listener)
    return () => { events.removeEventListener('change', listener); events.removeEventListener('error', listener); events.close() }
  },
}
export type BuildOperation = 'ReadCurrentUndoStatus' | 'AdvanceCurrentBuild' | 'UndoCurrentBuild'
export type BuildResponse = ReadCurrentUndoStatusResponse | AdvanceCurrentBuildResponse | UndoCurrentBuildResponse
export interface BuildAction { readonly expectedTurnRevision?: string; readonly expectedHistoryRevision?: string }

/** UI operation/revisions only; desktop-bridge creates the full session/v5 request from current facts. */
export async function bridgeBuild(operation: BuildOperation, payload: BuildAction = {}): Promise<BuildResponse> {
  const response = await bridgeJSON<BuildResponse>('/api-hanaworlds-workshop', { operation, payload })
  if (response.contractVersion !== 'session/v5' || typeof response.requestId !== 'string') throw new Error('UNSUPPORTED_VERSION')
  return response
}
