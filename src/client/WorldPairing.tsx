/** World management uses the Desktop bridge; game authority never comes from form fields. */
import { bridgeJSON } from './desktop-bridge.ts'
import { useEffect, useRef, useState } from 'react'
import type { Key } from './locales.ts'
import css from './HanaShellPage.module.css'

interface WorldState {
  sessionId: string
  worldPath: string
  worldRef: string | null
  gameId: string
  payloadVersion: string | null
  paired: boolean
  endpoint: { host: string
    port: number } | null
  localContext: { connectionRef: string; connectionIncarnationRef: string; worldRef: string; selectionRevision: string } | null
}
interface WorldSummary { connectionRef: string; worldRef: string | null; worldPath: string; name: string; terrain: 'flat' | 'unknown' }
interface DeletionPreview { worldName: string
  confirmationRef: string | null
  reason: string | null
  dataLoss: { files: number; bytes: number } }
interface WorldApi {
  invoke(input: { action: 'describeDelete'; connectionRef: string; worldRef: string }): Promise<DeletionPreview>
  invoke(input: { action: 'deleteWorld'; confirmationRef: string }): Promise<{ deleted: boolean }>
  invoke(input: { action: 'catalog' }): Promise<{ worlds: readonly WorldSummary[] }>
  invoke(input: object): Promise<WorldState | null> }
function invokeWorld(input: { action: 'describeDelete'; connectionRef: string; worldRef: string }): Promise<DeletionPreview>
function invokeWorld(input: { action: 'deleteWorld'; confirmationRef: string }): Promise<{ deleted: boolean }>
function invokeWorld(input: { action: 'catalog' }): Promise<{ worlds: readonly WorldSummary[] }>
function invokeWorld(input: object): Promise<WorldState | null>
function invokeWorld(input: object): Promise<unknown> { return bridgeJSON('/api-hanaworlds-worlds', input) }
const worldApi: WorldApi = { invoke: invokeWorld }
export function WorldPairing({ t, sessionId }: { t: (key: Key) => string; sessionId?: string | undefined }) {
  const api: WorldApi = worldApi
  const [state, setState] = useState<WorldState | null>(null)
  const [worlds, setWorlds] = useState<readonly WorldSummary[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [deletion, setDeletion] = useState<(DeletionPreview & { terrain: 'flat' | 'unknown' }) | null>(null)
  const [deleteError, setDeleteError] = useState(false)
  const generation = useRef(0)
  useEffect(() => {
    const own = ++generation.current
    setState(null); setDeletion(null); setBusy(false); setError(''); setDeleteError(false)
    if (api) void api.invoke({ action: 'current' }).then((value) => {
      if (generation.current === own) setState(value && (sessionId === undefined || value.sessionId === sessionId) ? value : null)
    })
      .catch(() => { /* No selected world on a fresh profile. */ })
    if (api) void api.invoke({ action: 'catalog' }).then((value) => { if (generation.current === own) setWorlds(value.worlds) })
      .catch((failure: unknown) => { if (generation.current === own) setError(String(failure)) })
    return () => { generation.current++ }
  }, [api, sessionId])
  const run = (input: object) => {
    if (!api || busy) return
    const own = ++generation.current
    setBusy(true); setDeletion(null); setError(''); setDeleteError(false)
    void api.invoke(input).then(async (value) => {
      if (generation.current === own && value) setState(value)
      const catalog = await api.invoke({ action: 'catalog' })
      if (generation.current === own) setWorlds(catalog.worlds)
    })
      .catch(async (failure: unknown) => {
        if (generation.current !== own) return
        setError(String(failure))
        // Re-read owned process state after a rejected operation; cached pairing
        // and connection coordinates must not outlive native-session cleanup.
        try {
          const current = await api.invoke({ action: 'current' })
          if (generation.current === own) setState(current)
        } catch { if (generation.current === own) setState(null) }
      })
      .finally(() => { if (generation.current === own) setBusy(false) })
  }
  const describeDelete = (world: WorldSummary) => {
    if (!api || busy || !world.worldRef) return
    const own = ++generation.current
    setBusy(true); setError(''); setDeleteError(true)
    void api.invoke({ action: 'describeDelete', connectionRef: world.connectionRef, worldRef: world.worldRef })
      .then((value) => { if (generation.current === own) setDeletion({ ...value, terrain: world.terrain }) })
      .catch((failure: unknown) => { if (generation.current === own) setError(String(failure)) })
      .finally(() => { if (generation.current === own) setBusy(false) })
  }
  const confirmDelete = () => {
    if (!api || busy || !deletion?.confirmationRef) return
    const own = ++generation.current, confirmationRef = deletion.confirmationRef
    setBusy(true); setError(''); setDeleteError(true)
    void api.invoke({ action: 'deleteWorld', confirmationRef }).then(async (result) => {
      if (!result.deleted) throw Error('WORLD_DELETE_READBACK_MISMATCH')
      const catalog = await api.invoke({ action: 'catalog' })
      if (generation.current === own) { setWorlds(catalog.worlds); setDeletion(null) }
    }).catch((failure: unknown) => {
      if (generation.current === own) { setError(String(failure)); setDeletion(null) }
    }).finally(() => { if (generation.current === own) setBusy(false) })
  }
  const ordered = [...worlds].sort((a, b) => a.worldPath.localeCompare(b.worldPath))
  return <section className={css.detailCard} aria-label={t('pairTitle')}>
    <h2>{t('pairTitle')}</h2><p>{t('pairIntro')}</p>
    {!api ? <p>{t('viewUnavailable')}</p> : <>
      <div className={css.actions}>
        <button type="button" disabled={busy} onClick={() => { run({ action: 'createFlat', ...(sessionId === undefined ? {} : { sessionId }) }) }}>{t('pairCreateFlat')}</button>
      </div>
      <h3>{t('pairWorlds')}</h3>
      {ordered.length === 0 ? <p>{t('pairEmpty')}</p> : <ul className={css.worldList}>{ordered.map((world) => {
        const name = world.name
        const connected = !busy && state?.paired && state.localContext?.connectionRef === world.connectionRef
        return <li key={world.connectionRef}>
          <div><strong>{name}</strong> · <span>{t(world.terrain === 'flat' ? 'pairFlat' : 'pairExisting')}</span></div>
          {connected ? <p role="status">{t('pairPaired')}</p> : <div className={css.actions}>
            <button type="button" disabled={busy} aria-label={`${t('pairSwitch')} · ${name}`}
              onClick={() => { run({ action: 'switch', connectionRef: world.connectionRef, ...(sessionId === undefined ? {} : { sessionId }) }) }}>{t('pairSwitch')}</button>
          </div>}
          <div className={css.actions}><button type="button" disabled={busy || !world.worldRef}
            aria-label={`${t('pairDelete')} · ${name}`} onClick={() => { describeDelete(world) }}>{t('pairDelete')}</button></div>
        </li>
      })}</ul>}
      {deletion && <div role="dialog" aria-modal="true" aria-label={t('pairDeleteTitle')} className={css.detailCard}>
        <h3>{t('pairDeleteTitle')}</h3><strong>{deletion.worldName}</strong>
        <p>{t(deletion.terrain === 'flat' ? 'pairFlat' : 'pairExisting')}</p>
        <p>{t('pairDeleteLoss')} {deletion.dataLoss.files} {t('pairDeleteFiles')} · {deletion.dataLoss.bytes} {t('pairDeleteBytes')}</p>
        {deletion.reason && <p role="alert">{t(deleteErrorKey(deletion.reason))}</p>}
        <div className={css.actions}>
          <button type="button" disabled={busy} onClick={() => { setDeletion(null) }}>{t('pairDeleteCancel')}</button>
          {deletion.confirmationRef && <button type="button" disabled={busy} onClick={confirmDelete}>{t('pairDeleteConfirm')}</button>}
        </div>
      </div>}
      {state && <>
        {!state.paired ? <div className={css.actions}>
          <button className={css.primary} type="button" disabled={busy} onClick={() => { run({ action: 'connect' }) }}>{t('pairConnect')}</button>
        </div> : <>
          {state.endpoint && <p>{t('pairJoin')} <strong>{state.endpoint.host}:{state.endpoint.port}</strong></p>}
          <div className={css.actions}><button type="button" disabled={busy} onClick={() => { run({ action: 'play' }) }}>{t('pairPlay')}</button><button type="button" disabled={busy} onClick={() => { run({ action: 'refresh' }) }}>{t('pairRefresh')}</button></div>
        </>}
        <details><summary>{t('pairDetails')}</summary>
          <dl className={css.details}><dt>{t('viewSession')}</dt><dd>{state.sessionId}</dd><dt>{t('viewWorld')}</dt><dd>{state.worldPath}</dd>
            <dt>{t('pairGame')}</dt><dd>{state.gameId}</dd><dt>{t('pairIdentity')}</dt><dd>{state.worldRef ?? t('pairNotInstalled')}</dd>
            {state.localContext && <><dt>{t('viewConnection')}</dt><dd>{state.localContext.connectionRef}</dd>
              <dt>{t('pairIncarnation')}</dt><dd>{state.localContext.connectionIncarnationRef}</dd>
              <dt>{t('pairRevision')}</dt><dd>{state.localContext.selectionRevision}</dd></>}
          </dl>
        </details>
      </>}
      <details><summary>{t('pairAdvanced')}</summary><div className={css.actions}>
        <button type="button" disabled={busy} onClick={() => { run({ action: 'addRoot' }) }}>{t('pairAddRoot')}</button>
        <button type="button" disabled={busy} onClick={() => { run({ action: 'choose' }) }}>{t('pairChoose')}</button>
      </div></details>
      {busy && <p role="status">{t('pairWorking')}</p>}
      {error && <p role="alert">{t(deleteError ? deleteErrorKey(error) : worldErrorKey(error))}</p>}
    </>}
  </section>
}

function worldErrorKey(error: string): Key {
  if (/GAME_CLIENT|GAME_RUNTIME|GAME_ENDPOINT|ENOENT/.test(error)) return 'pairGameUnavailable'
  if (/SESSION|CORE_SESSION/.test(error)) return 'pairSessionMissing'
  if (/CONTENT|PREREQUISITE|GAME_NOT_INSTALLED|MOD/.test(error)) return 'pairContentMissing'
  if (/ADAPTER|CAPABILITY|UNSUPPORTED_VERSION/.test(error)) return 'pairAdapterMissing'
  if (/ENGINE|CONTROL/.test(error)) return 'pairEngineFailed'
  return 'pairFailed'
}

function deleteErrorKey(error: string): Key {
  if (/LIVE_SESSION_BOUND|WORLD_ALREADY_RUNNING|WORLD_IN_USE|DELETE_BLOCKED/.test(error)) return 'pairDeleteBound'
  if (/OWNERSHIP_UNKNOWN/.test(error)) return 'pairDeleteOwnership'
  if (/BINDING_UNKNOWN|OCCUPANCY_UNPROVEN|REQUIRED_FACT_UNKNOWN/.test(error)) return 'pairDeleteUnknown'
  if (/FACTS_CHANGED|CONFIRMATION_EXPIRED|CURRENT_WORLD_MISMATCH/.test(error)) return 'pairDeleteChanged'
  if (/DELETE_UNAVAILABLE/.test(error)) return 'pairDeleteUnavailable'
  return 'pairDeleteFailed'
}
