/** Current-turn actions; desktop-bridge supplies Session/world/connection fields. */
import { useEffect, useState } from 'react'
import type { Key } from './locales.ts'
import type { CurrentUndoStatus } from 'hanaworlds-contracts'
import { bridgeBuild, type BuildAction, type BuildOperation } from './desktop-bridge.ts'
export function BuildControls({ sessionId, worldRef, t, disabled = false }: {
  disabled?: boolean
  sessionId: string
  worldRef: string
  t(this: void, key: Key): string
}) {
  const [status, setStatus] = useState<CurrentUndoStatus | null>(null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const call = async (operation: BuildOperation, payload: BuildAction = {}) => {
    const response = await bridgeBuild(operation, payload)
    if (response.error) throw new Error(response.error.code)
    const result = response.result
    if (!result || result.sessionRef !== sessionId || result.worldRef !== worldRef) throw new Error('WORLD_CONTEXT_CHANGED')
    return result
  }
  useEffect(() => {
    let active = true
    void call('ReadCurrentUndoStatus').then((result) => { if (active) setStatus(result as CurrentUndoStatus) })
      .catch((failure: unknown) => { if (active) setError(String(failure)) })
    return () => { active = false }
  }, [sessionId, worldRef])
  const run = async (operation: 'AdvanceCurrentBuild' | 'UndoCurrentBuild' | 'ReadCurrentUndoStatus') => {
    if (busy) return
    setBusy(true); setMessage(''); setError('')
    try {
      const result = await call(operation, operation === 'ReadCurrentUndoStatus' ? {} : {
        ...(status?.turnRevision ? { expectedTurnRevision: status.turnRevision } : {}),
        ...(operation === 'UndoCurrentBuild' ? status?.head ? { expectedHistoryRevision: status.head.historyRevision } : {} : {}),
      })
      if (operation !== 'ReadCurrentUndoStatus') setMessage(operation === 'UndoCurrentBuild'
        ? ('status' in result && result.status === 'VERIFIED' ? t('undoVerified') : t('buildPending'))
        : ('outcome' in result && result.outcome === 'VERIFIED' ? t('buildVerified') : t('buildPending')))
      setStatus((operation === 'ReadCurrentUndoStatus' ? result : await call('ReadCurrentUndoStatus')) as CurrentUndoStatus)
    } catch (failure) { setStatus(null); setError(String(failure)) }
    finally { setBusy(false) }
  }
  return <section aria-label={t('buildActions')}>
    <button type="button" disabled={disabled || busy || !status?.turnRevision} onClick={() => { void run('AdvanceCurrentBuild') }}>{t('buildCurrent')}</button>
    <button type="button" disabled={disabled || busy || status?.availability !== 'AVAILABLE' || !status.head} onClick={() => { void run('UndoCurrentBuild') }}>{t('undoCurrent')}</button>
    <button type="button" disabled={disabled || busy} onClick={() => { void run('ReadCurrentUndoStatus') }}>{t('buildRefresh')}</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>
}
