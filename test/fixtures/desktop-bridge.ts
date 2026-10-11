/** Component HTTP fixture only. No plugin imports, native processes or real world writes. */
import { vi } from 'vitest'
import { validateRequest, validateResponse } from 'hanaworlds-contracts'

interface ViewFixture {
  current(): Promise<unknown>
  subscribe?(listener: () => void): () => void
  fixtureAvailable?(): Promise<boolean>
  choose?(): Promise<unknown>
  history?(): Promise<unknown>
  prepare?(text: string): Promise<unknown>
  confirm?(): Promise<unknown>
}
interface Fixture {
  view?: ViewFixture
  worlds?: { invoke(input: Record<string, unknown>): Promise<unknown> }
  build?(operation: string, payload: Record<string, unknown>): Promise<{ result: unknown; error: unknown }>
  reads?(url: string): Promise<unknown>
}
const digest = '0'.repeat(64)

/** The stub, rather than the renderer, assembles the published session/v5 request. */
async function sessionResponse(fixture: Fixture, input: Record<string, unknown>) {
  const operation = input.operation as 'ReadCurrentUndoStatus' | 'AdvanceCurrentBuild' | 'UndoCurrentBuild'
  if (!['ReadCurrentUndoStatus', 'AdvanceCurrentBuild', 'UndoCurrentBuild'].includes(operation)) throw Error('FIXTURE_UNKNOWN_OPERATION')
  const payload = input.payload as Record<string, unknown>
  if (Object.keys(input).some(key => !['operation', 'payload'].includes(key))
    || Object.keys(payload).some(key => !['expectedTurnRevision', 'expectedHistoryRevision'].includes(key))) throw Error('FIXTURE_RENDERER_AUTHORITY_REJECTED')
  const binding = await fixture.view?.current() as { view?: { sessionId: string; worldRef: string; localContext: unknown } } | undefined
  if (!binding?.view || !fixture.build) throw Error('FIXTURE_BUILD_UNAVAILABLE')
  const { sessionId, worldRef, localContext } = binding.view
  const requestId = `fixture:${operation}`
  const request = { contractVersion: 'session/v5', sessionRef: sessionId, worldRef, localContext, requestId, ...payload }
  validateRequest('session/v5', operation, request)
  const reply = await fixture.build(operation, payload)
  const raw = reply.result as Record<string, unknown> | null
  let result = raw
  if (raw && operation === 'ReadCurrentUndoStatus') result = { turnRef: raw.turnRevision ? 'fixture:turn' : null, ...raw }
  if (raw && operation === 'AdvanceCurrentBuild' && raw.outcome === 'VERIFIED') result = {
    ...raw, stage: 'COMPLETE', receipt: {
      contractVersion: 'canvas/v7', transactionId: 'fixture:transaction', operationDigest: digest,
      transactionPayloadDigest: digest, status: 'VERIFIED', previousWorldRevision: 'fixture:before',
      observedWorldRevision: 'fixture:after', readbackDigest: digest, restoreStatus: 'NOT_REQUIRED',
      error: null, localContext, guardRefusal: null, applyFailure: null,
    },
  }
  // The old UI responder supplies only a result. The new HTTP envelope is a v2 schema response.
  if (result && operation === 'AdvanceCurrentBuild') { result = { ...result }; delete result.turnRef }
  const response = { contractVersion: 'session/v5', requestId, result, error: reply.error,
    ...(operation === 'ReadCurrentUndoStatus' ? {} : { guardRefusal: null }) }
  validateResponse('session/v5', operation, response)
  return response
}

export function installDesktopBridgeFixture(fixture: Fixture = {}) {
  const calls: { url: string; method: string; input: unknown }[] = []
  const events: FixtureEvents[] = []
  class FixtureEvents extends EventTarget {
    readonly url: string
    closed = false
    private dispose: (() => void) | undefined
    constructor(url: string) {
      super(); this.url = url; events.push(this)
      this.dispose = fixture.view?.subscribe?.(() => this.dispatchEvent(new Event('change')))
    }
    close() { this.closed = true; this.dispose?.() }
  }
  vi.stubGlobal('EventSource', FixtureEvents)
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET'
    const input = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : {}
    calls.push({ url, method, input })
    try {
      let value: unknown
      if (url === '/api-hanaworlds-view' && method === 'GET') {
        if (!fixture.view) return new Response('{}', { status: 503 })
        value = await fixture.view.current()
      } else if (url === '/api-hanaworlds-worlds' && method === 'POST') {
        if (!fixture.worlds) return new Response('{}', { status: 503 })
        value = await fixture.worlds.invoke(input)
      } else if (url === '/api-hanaworlds-workshop' && method === 'POST') {
        value = await sessionResponse(fixture, input)
      } else if (url === '/api-hanaworlds-view/choose' && method === 'POST') {
        value = await fixture.view?.choose?.() ?? null
      } else if (url === '/api-hanaworlds-workshop/history' && method === 'GET') {
        value = await fixture.view?.history?.() ?? null
      } else if (url === '/api-hanaworlds-workshop/prepare' && method === 'POST') {
        value = await fixture.view?.prepare?.(String(input.text)) ?? null
      } else if (url === '/api-hanaworlds-workshop/confirm' && method === 'POST') {
        value = await fixture.view?.confirm?.() ?? null
      } else if (fixture.reads && method === 'GET') value = await fixture.reads(url)
      else return new Response('{}', { status: 503 })
      return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
    } catch (error) {
      // Surface the original fixture refusal; never transform a schema failure into success.
      return new Response(JSON.stringify({ error: { code: String(error) } }), { status: 409 })
    }
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, calls, events }
}
