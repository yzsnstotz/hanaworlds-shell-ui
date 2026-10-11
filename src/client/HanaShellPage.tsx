/** First-level HanaWorlds Desktop pages backed by the plugin HTTP View/Workshop boundary. */
import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { BLOSSOM_ICON } from './blossom-data.ts'
import type { Key } from './locales.ts'
import css from './HanaShellPage.module.css'
import { BuildControls } from './BuildControls.tsx'
import { WorldPairing } from './WorldPairing.tsx'

export type ShellPanel = 'hana-home' | 'hana-workshop' | 'hana-world'
import { bridgeView, type ViewState, type WorkshopView } from './desktop-bridge.ts'
interface PageFace { sessionId?: string; panel: ShellPanel; navigate(this: void, id: ShellPanel | 'plugins' | 'hanaworlds-canvas-objects-history'): void }
const symbols: Record<ShellPanel, string> = { 'hana-home': '⌂', 'hana-workshop': '✦', 'hana-world': '◎' }

export function ShellPanelIcon({ size, panel }: PropsRuntime<'sidebar.panellist'> & { panel: ShellPanel }) {
  return <span aria-hidden="true" style={{ width: size, height: size, lineHeight: `${size}px`, fontSize: size + 2, textAlign: 'center', display: 'inline-block' }}>{symbols[panel]}</span>
}

/** The active page asks the Host for fresh facts; no binding survives a changed connection or navigation. */
export function HanaShellPage({ panel, navigate, t, sessionId }: InjectFace<PageFace> & PropsLocale<'hanaworlds.shell'>) {
  const api = bridgeView
  const [view, setView] = useState<ViewState>({ phase: 'unselected' })
  const fixture = view.phase === 'bound' && view.view.source === 'FIXTURE'
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [workshop, setWorkshop] = useState<WorkshopView | null>(null)
  const [workshopKey, setWorkshopKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const refreshView = useRef<() => void>(() => {})
  useEffect(() => {
    if (!api) return
    let active = true
    let generation = 0
    const refresh = () => {
      if (!active) return
      const own = ++generation
      void api.current().then((next) => { if (active && own === generation) setView(next) })
        .catch((failure: unknown) => { if (active && own === generation) setView({ phase: 'rejected', reason: String(failure) }) })
    }
    refreshView.current = refresh
    const unsubscribe = api.subscribe(refresh)
    refresh()
    return () => {
      active = false; generation++
      if (refreshView.current === refresh) refreshView.current = () => {}
      unsubscribe()
    }
  }, [api])
  const binding = view.phase === 'bound' ? view.view : null
  const bindingKey = binding && [binding.sessionId, binding.worldRef, binding.localContext.connectionIncarnationRef, binding.localContext.selectionRevision, binding.serviceIdentity].join('/')
  useEffect(() => {
    setWorkshop(null)
    setWorkshopKey(null)
    setError('')
    setDraft('')
    if (!api || !binding || !bindingKey) return
    let active = true
    void api.history().then((result) => {
      if (active && result.sessionId === binding.sessionId && result.worldRef === binding.worldRef) {
        setWorkshop(result); setWorkshopKey(bindingKey)
      }
    }).catch((failure: unknown) => { if (active) setError(String(failure)) })
    return () => { active = false }
  }, [api, bindingKey])
  const shown = binding && workshop && workshopKey === bindingKey
    && workshop.sessionId === binding.sessionId && workshop.worldRef === binding.worldRef ? workshop : null
  const refresh = () => { refreshView.current() }
  const run = (action: () => Promise<WorkshopView>) => {
    if (!api || !binding || !bindingKey) return
    setBusy(true); setError('')
    void action().then((result) => {
      if (result.sessionId !== binding.sessionId || result.worldRef !== binding.worldRef) {
        setWorkshop(null); setWorkshopKey(null); setError('HANAWORLDS_CONFIRM_STALE_VIEW'); refresh(); return
      }
      setWorkshop(result); setWorkshopKey(bindingKey)
    }).catch((failure: unknown) => {
      setWorkshop(null); setWorkshopKey(null); setError(String(failure)); refresh()
    }).finally(() =>{  setBusy(false) })
  }
  const choose = () => { if (api) void api.choose().catch((failure: unknown) =>{  setView({ phase: 'rejected', reason: String(failure) }) }) }
  const heading: Record<ShellPanel, Key> = { 'hana-home': 'homeHeadline', 'hana-workshop': 'workshopTitle', 'hana-world': 'viewTitle' }
  const eyebrow: Record<ShellPanel, Key> = { 'hana-home': 'homeEyebrow', 'hana-workshop': 'workshopNav', 'hana-world': 'worldNav' }
  return <main className={css.page} data-hanaworlds-panel={panel}>
    <div className={css.inner}>
      <header className={css.header}>
        <div className={css.eyebrow}><img src={BLOSSOM_ICON} alt="" width="28" height="28" /> <span>{t(eyebrow[panel])}</span><span className={css.rule} /></div>
        <h1>{t(heading[panel])}</h1>
        <p className={css.lede}>{t(panel === 'hana-home' ? 'homeIntro' : panel === 'hana-workshop' ? 'workshopIntro' : panel === 'hana-world' ? 'worldIntro' : 'objectsIntro')}</p>
      </header>
      {panel !== 'hana-home' && <button className={css.back} type="button" onClick={() =>{  navigate('hana-home') }}>← {t('returnHome')}</button>}
      {panel === 'hana-home' && <div className={css.heroGrid}>
        <section className={css.featureCard}>
          <span className={css.cardIndex}>01 / {t('workshopNav')}</span>
          <h2>{t('currentRound')}</h2>
          <p>{t('workshopIntro')}</p>
          <button className={css.primary} type="button" onClick={() =>{  navigate('hana-workshop') }}>{t('startWorkshop')} <span aria-hidden="true">↗</span></button>
        </section>
        <div className={css.sideCards}>
          <button className={css.linkCard} type="button" onClick={() =>{  navigate('hana-world') }}><span>02 / {t('worldNav')}</span><strong>{t('bindingLabel')}</strong><span aria-hidden="true">↗</span></button>
          <button className={css.linkCard} type="button" onClick={() =>{  navigate('hanaworlds-canvas-objects-history') }}><span>03 / {t('objectsNav')}</span><strong>{t('objectsTitle')}</strong><span aria-hidden="true">↗</span></button>
        </div>
      </div>}
      {panel === 'hana-world' && <WorldPairing t={t} sessionId={sessionId} />}
      <section className={css.statusCard} aria-label={t('sessionStatus')}>
        <div className={css.statusHeading}><span className={css.cardIndex}>{t('sessionStatus')}</span><span className={css.pulse} aria-hidden="true" /></div>
        {!api ? <p role="status">{t('viewUnavailable')}</p> : view.phase === 'bound' ? <>
          <strong>{t('connected')}</strong>
          {panel === 'hana-world' ? <details><summary>{t('viewDetails')}</summary><div className={css.facts}><span>{t('viewSession')}<b>{view.view.sessionId}</b></span><span>{t('viewWorld')}<b>{view.view.worldRef}</b></span><span>{t('viewConnection')}<b>{view.view.localContext.connectionRef}</b></span></div><dl className={css.details}><dt>{t('viewService')}</dt><dd>{view.view.serviceIdentity}</dd></dl></details> : <div className={css.facts}><span>{t('viewSession')}<b>{view.view.sessionId}</b></span><span>{t('viewWorld')}<b>{view.view.worldRef}</b></span><span>{t('viewConnection')}<b>{view.view.localContext.connectionRef}</b></span></div>}
          <p className={css.source}>{view.view.source === 'FIXTURE' ? t('viewFixtureSource') : t('viewAdapterSource')}</p>
          {view.view.source === 'FIXTURE' && <p className={css.fixtureNote}>{t('fixtureNotice')}</p>}
        </> : <p role={view.phase === 'rejected' ? 'alert' : 'status'}>{view.phase === 'rejected' ? `${t('viewRejected')} · ${view.reason}` : t('needsBinding')}</p>}
        {api && <div className={css.actions}><button type="button" onClick={choose}>{t('chooseSession')}</button><button type="button" onClick={refresh}>{t('refreshView')}</button></div>}
      </section>
      {panel === 'hana-home' && <div className={css.footerAction}>
        <button type="button" onClick={() => { navigate('plugins') }}>{t('managePlugins')} ↗</button>
        {fixture && <span>{t('fixtureNotice')}</span>}
      </div>}
      {panel === 'hana-world' && <section className={css.detailCard}><span className={css.cardIndex}>{t('bindingLabel')}</span><p>{t('viewInvariant')}</p>{binding && <p className={css.source}>{binding.source === 'FIXTURE' ? t('viewFixtureSource') : t('viewAdapterSource')}</p>}{error && <p role="alert">{error}</p>}</section>}
      {panel === 'hana-workshop' && <section className={css.detailCard}>
        <span className={css.cardIndex}>{t('currentRound')}</span><p>{t('workshopInvariant')}</p>
        {!binding || !api ? <p role="status">{t('workshopUnavailable')}</p> : <>
          <label className={css.inputLabel} htmlFor="hana-workshop-draft">{t('workshopDraft')}</label>
          <textarea id="hana-workshop-draft" value={draft} onChange={(event) =>{  setDraft(event.target.value) }} disabled={busy} rows={4} />
          <div className={css.actions}><button className={css.primary} type="button" disabled={busy || !draft.trim()} onClick={() =>{  run(() => api.prepare(draft)) }}>{t('workshopPrepare')}</button><button type="button" disabled={busy || !shown?.pending} onClick={() =>{  run(() => api.confirm()) }}>{t('workshopConfirm')}</button><button type="button" disabled={busy} onClick={() =>{  run(() => api.history()) }}>{t('workshopRead')}</button></div>
          <BuildControls key={[bindingKey, shown?.turns.at(-1)?.turnRef, shown?.turns.at(-1)?.confirmedBrief].join('/')} sessionId={binding.sessionId} worldRef={binding.worldRef} t={t} disabled={busy} />
          {error && <p role="alert">{error}</p>}
          {shown?.modelReply && <p role="status">{shown.modelReply}</p>}
          {shown && <div className={css.rounds}><span className={css.source}>{shown.source === 'FIXTURE' ? t('workshopFixture') : t('workshopLive')}</span>{shown.pending && <p role="status">{t('workshopPending')} · {shown.pending.question}</p>}{shown.turns.length === 0 ? <p>{t('workshopNoTurns')}</p> : <ol>{shown.turns.map(turn => <li key={turn.turnRef}><span>{t('workshopUser')}</span><p>{turn.userText}</p><span>{t('workshopReply')}</span><p>{turn.resultText}</p></li>)}</ol>}</div>}
        </>}
      </section>}
    </div>
  </main>
}
