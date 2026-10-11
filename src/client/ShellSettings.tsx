import { Fragment, useEffect, useRef, useState } from 'react'
import type { PluginRegistries } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { BLOSSOM_ICON } from './blossom-data.ts'
import styles from './ShellSettings.module.css'

const SOURCE = 'deepseek-ai/deepseek-harness · dsh-v0.2.0-rc.2 · 639ed015397290b3745d163aafe02ffee4aa3f84 · MIT'

/** Host facts and navigation available to the Shell page. */
export interface ShellSettingsFace {
  readRegistries(this: void): Promise<PluginRegistries>
  openPlugins(this: void): void
}

import { bridgeJSON, bridgeView, type ViewState, type WorkshopView, type ResearchConfig } from './desktop-bridge.ts'

interface DeploymentView {
  kind: string
  safetyProfile: { avatarDimensions: { width: number; height: number; depth: number; unit: string }
    connectivity: number
    requireBodyClearance: boolean
    requireEntranceConnectivity: boolean
    hazardPolicy: { forbidLiquid: boolean; maximumDamagePerSecond: number }
    optionalLightRule: unknown }
}

interface WriteMethodView { method: string
  toolName: string
  purpose: string
  typicalScale: string
  unavailableReason: string | null }
interface ContentView { id: string
  name: string
  version: string
  license: string
  state: string
  target: string }
interface K3View {
  kind: 'K3_COMPOSITION'
  writeTools: { value: { tools: { descriptor: WriteMethodView }[] } | null
    error: string | null }
  regionSeams: { seam: string; label: string; wire: string; compatible: boolean; unmet: { code: string; need: string } | null }[]
  regionInvariants: { id: string; owner: string; text: string; consequence: string }[]
  luantiContent: { value: { userPath: string
    components: ContentView[] } | null
  error: string | null }
}

/** Built-in page showing the exact fixed source and the live Host registry configuration. */
export function ShellSettings({ t, readRegistries, openPlugins }:
  PropsLocale<'hanaworlds.shell'> & InjectFace<ShellSettingsFace>) {
  const [registries, setRegistries] = useState<PluginRegistries | null>(null)
  const [deployment, setDeployment] = useState<DeploymentView | null>(null)
  useEffect(() => {
    let live = true
    void fetch('/api-hanaworlds-deployment').then(async (response) => {
      if (!response.ok) throw new Error('DEPLOYMENT_UNAVAILABLE')
      const value = await response.json() as DeploymentView
      if (value.kind !== 'DEPLOYMENT_CONFIGURATION') throw new Error('DEPLOYMENT_UNAVAILABLE')
      if (live) setDeployment(value)
    }).catch(() => { if (live) setDeployment(null) })
    return () => { live = false }
  }, [])
  const [k3, setK3] = useState<K3View | null>(null)
  useEffect(() => {
    let live = true
    void fetch('/api-hanaworlds-k3').then(async (response) => {
      if (!response.ok) throw new Error('K3_UNAVAILABLE')
      const value = await response.json() as K3View
      if (value.kind !== 'K3_COMPOSITION') throw new Error('K3_UNAVAILABLE')
      if (live) setK3(value)
    }).catch(() => { if (live) setK3(null) })
    return () => { live = false }
  }, [])
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<ViewState>({ phase: 'unselected' })
  const [workshop, setWorkshop] = useState<WorkshopView | null>(null)
  const [workshopBinding, setWorkshopBinding] = useState<string | null>(null)
  const [workshopError, setWorkshopError] = useState('')
  const [workshopBusy, setWorkshopBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const refreshView = useRef<() => void>(() => {})
  const viewApi = bridgeView
  useEffect(() => {
    let mounted = true
    void readRegistries().then((value) => { if (mounted) setRegistries(value) })
      .catch(() => { if (mounted) setFailed(true) })
    return () => { mounted = false }
  }, [readRegistries])
  useEffect(() => {
    if (viewApi === undefined) return
    let mounted = true
    let revision = 0
    const refresh = (): void => {
      if (!mounted) return
      const current = ++revision
      void viewApi.current().then((result) => { if (mounted && current === revision) setView(result) })
        .catch((error: unknown) => { if (mounted && current === revision) setView({ phase: 'rejected', reason: String(error) }) })
    }
    refreshView.current = refresh
    const dispose = viewApi.subscribe(refresh)
    refresh()
    return () => {
      mounted = false; revision++
      if (refreshView.current === refresh) refreshView.current = () => {}
      dispose()
    }
  }, [viewApi])
  const selectedSession = view.phase === 'bound' ? view.view.sessionId : null
  const selectedWorld = view.phase === 'bound' ? view.view.worldRef : null
  const selectionRevision = view.phase === 'bound'
    ? `${view.view.localContext.connectionIncarnationRef}/${view.view.localContext.selectionRevision}/${view.view.serviceIdentity}` : null
  useEffect(() => {
    setWorkshop(null)
    setWorkshopBinding(null)
    setWorkshopError('')
    setDraft('')
    if (viewApi === undefined || selectedSession === null) return
    let mounted = true
    void viewApi.history().then((result) => {
      if (mounted && result.sessionId === selectedSession && result.worldRef === selectedWorld) {
        setWorkshop(result)
        setWorkshopBinding(selectionRevision)
      }
    }).catch((error: unknown) => {
      if (mounted) setWorkshopError(String(error))
    })
    return () => { mounted = false }
  }, [viewApi, selectedSession, selectedWorld, selectionRevision])
  const acceptWorkshop = (result: WorkshopView): void => {
    if (view.phase !== 'bound' || result.sessionId !== view.view.sessionId
      || result.worldRef !== view.view.worldRef) {
      setWorkshop(null)
      setWorkshopBinding(null)
      setWorkshopError('HANAWORLDS_CONFIRM_STALE_VIEW')
      return
    }
    setWorkshop(result)
    setWorkshopBinding(selectionRevision)
    setWorkshopError('')
  }
  const workshopFailed = (error: unknown): void => {
    setWorkshop(null)
    setWorkshopBinding(null)
    setWorkshopError(String(error))
    refreshView.current()
  }
  const shownWorkshop = workshop !== null && workshopBinding === selectionRevision
    && workshop.sessionId === selectedSession && workshop.worldRef === selectedWorld ? workshop : null
  const registry = registries?.registry ?? registries?.resolved ?? null
  const [config, setConfig] = useState<ResearchConfig | undefined>(undefined)
  useEffect(() => {
    let active = true
    void bridgeJSON<ResearchConfig>('/api-hanaworlds-config').then(value => { if (active) setConfig(value) })
      .catch(() => { if (active) setConfig(undefined) })
    return () => { active = false }
  }, [])
  return <section className={styles.page}>
    <header className={styles.header}>
      <img src={BLOSSOM_ICON} alt="" width="60" height="60" />
      <h2>{t('title')}</h2>
    </header>
    <dl className={styles.facts}>
      <dt>{t('source')}</dt><dd>{SOURCE}</dd>
      <dt>{t('version')}</dt><dd>{process.env.DSH_CLIENT_VERSION ?? t('versionUnavailable')}</dd>
      <dt>{t('project')}</dt><dd>{config === undefined ? t('profileUnavailable') : `${config.appId} · ${config.profilePath ?? t('profileUnavailable')}`}</dd>
      <dt>{t('registry')}</dt><dd>{failed ? t('error') : registries === null ? t('loading') : registry ?? t('none')}</dd>
      <dt>{t('fallbacks')}</dt><dd>{registries?.fallbackRegistries.join(', ') || t('none')}</dd>
      <dt>{t('telemetry')}</dt><dd>{config?.telemetry?.enabled === false && config.telemetry?.target === null ? t('offNoTarget') : t('profileUnavailable')}</dd>
      <dt>{t('updates')}</dt><dd>{config?.updates?.enabled === false && config.updates?.target === null ? t('offNoTarget') : t('profileUnavailable')}</dd>
    </dl>
    <section aria-label={t('geometryPolicy')} className={styles.panel}>
      <h3>{t('geometryPolicy')}</h3><p>{t('geometrySource')}</p>
      {deployment === null ? <p>{t('profileUnavailable')}</p> : <dl className={styles.facts}>
        <dt>{t('geometryEnvelope')}</dt><dd>{deployment.safetyProfile.avatarDimensions.width} × {deployment.safetyProfile.avatarDimensions.height} × {deployment.safetyProfile.avatarDimensions.depth} · {deployment.safetyProfile.avatarDimensions.unit}</dd>
        <dt>{t('geometryBody')}</dt><dd>{String(deployment.safetyProfile.requireBodyClearance)}</dd>
        <dt>{t('geometryEntrance')}</dt><dd>{String(deployment.safetyProfile.requireEntranceConnectivity)}</dd>
        <dt>{t('geometryLiquid')}</dt><dd>{String(deployment.safetyProfile.hazardPolicy.forbidLiquid)}</dd>
        <dt>{t('geometryDamage')}</dt><dd>{deployment.safetyProfile.hazardPolicy.maximumDamagePerSecond}</dd>
        <dt>{t('geometryTopology')}</dt><dd>{deployment.safetyProfile.connectivity}</dd>
      </dl>}
      <p>{t('geometryInvariant')}</p>
    </section>
    <section aria-label={t('k3Title')} className={styles.panel}>
      <h3>{t('k3Title')}</h3><p>{t('k3Intro')}</p>
      {k3 === null ? <p>{t('profileUnavailable')}</p> : <>
        <h4>{t('k3Methods')}</h4>
        {k3.writeTools.value === null ? <p role="alert">{t('k3Unavailable')} · {k3.writeTools.error}</p> : <dl className={styles.facts}>
          {k3.writeTools.value.tools.map(({ descriptor: d }) => <Fragment key={d.method}><dt>{d.method} · {d.toolName}</dt>
            <dd>{d.purpose} {d.typicalScale}{d.unavailableReason ? ` · ${t('k3Unavailable')}: ${d.unavailableReason}` : ''}</dd></Fragment>)}
        </dl>}
        <h4>{t('k3Seams')}</h4>
        <dl className={styles.facts}>{k3.regionSeams.map(seam => <Fragment key={seam.seam}><dt>{seam.label} · {seam.wire}</dt>
          <dd>{seam.compatible ? t('k3Compatible') : `${seam.unmet?.code ?? ''}: ${seam.unmet?.need ?? ''}`}</dd></Fragment>)}</dl>
        <h4>{t('k3Invariants')}</h4>
        <dl className={styles.facts}>{k3.regionInvariants.map(row => <Fragment key={row.id}><dt>{row.id} · {row.owner}</dt>
          <dd>{row.text} {row.consequence}</dd></Fragment>)}</dl>
        <h4>{t('k3Content')}</h4>
        {k3.luantiContent.value === null ? <p role="alert">{t('k3Unavailable')} · {k3.luantiContent.error}</p> : <dl className={styles.facts}>
          {k3.luantiContent.value.components.map(c => <Fragment key={c.id}><dt>{c.name} {c.version}</dt>
            <dd>{c.state} · {c.license} · {c.target}</dd></Fragment>)}</dl>}
      </>}
    </section>
    <section aria-label={t('viewTitle')} className={styles.panel}>
      <h3>{t('viewTitle')}</h3>
      <p>{t('viewInvariant')}</p>
      {viewApi === undefined ? <p>{t('viewUnavailable')}</p> : <>
        <div className={styles.actions}>
          <button type="button" onClick={() => {
            void viewApi.choose().catch((error: unknown) => { setView({ phase: 'rejected', reason: String(error) }) })
          }}>{t('chooseSession')}</button>
          <button type="button" onClick={() => { refreshView.current() }}>{t('refreshView')}</button>
        </div>
        {view.phase === 'unselected' ? <p role="status">{t('viewUnselected')}</p>
          : view.phase === 'rejected' ? <p role="alert">{t('viewRejected')} · {view.reason}</p>
            : <dl className={styles.facts}>
              <dt>{t('viewSession')}</dt><dd>{view.view.sessionId}</dd>
              <dt>{t('viewConnection')}</dt><dd>{view.view.localContext.connectionRef}</dd>
              <dt>{t('viewWorld')}</dt><dd>{view.view.worldRef}</dd>
              <dt>{t('viewSource')}</dt><dd>{view.view.source === 'FIXTURE' ? t('viewFixtureSource') : t('viewAdapterSource')}</dd>
              <dt>{t('viewService')}</dt><dd>{view.view.serviceIdentity}</dd>
            </dl>}

      </>}
    </section>
    <section aria-label={t('workshopTitle')} className={styles.panel}>
      <h3>{t('workshopTitle')}</h3>
      <p>{t('workshopInvariant')}</p>
      {view.phase !== 'bound' || viewApi === undefined ? <p>{t('workshopUnavailable')}</p> : <>
        <label htmlFor="hanaworlds-workshop-draft">{t('workshopDraft')}</label>
        <textarea id="hanaworlds-workshop-draft" value={draft}
          onChange={(event) => { setDraft(event.target.value) }} disabled={workshopBusy}
          rows={3} />
        <div className={styles.actions}>
          <button type="button" disabled={workshopBusy || draft.trim().length === 0} onClick={() => {
            setWorkshopBusy(true)
            void viewApi.prepare(draft).then(acceptWorkshop).catch(workshopFailed)
              .finally(() => { setWorkshopBusy(false) })
          }}>{t('workshopPrepare')}</button>
          <button type="button" disabled={workshopBusy || shownWorkshop?.pending == null} onClick={() => {
            setWorkshopBusy(true)
            void viewApi.confirm().then(acceptWorkshop).catch(workshopFailed)
              .finally(() => { setWorkshopBusy(false) })
          }}>{t('workshopConfirm')}</button>
          <button type="button" disabled={workshopBusy} onClick={() => {
            setWorkshopBusy(true)
            void viewApi.history().then(acceptWorkshop).catch(workshopFailed)
              .finally(() => { setWorkshopBusy(false) })
          }}>{t('workshopRead')}</button>
        </div>
        {workshopError && <p role="alert">{workshopError}</p>}
        {shownWorkshop !== null && <>
          <p>{shownWorkshop.source === 'FIXTURE' ? t('workshopFixture') : t('workshopLive')}</p>
          {shownWorkshop.pending !== null && <p role="status">{t('workshopPending')} · {shownWorkshop.pending.question}</p>}
          {shownWorkshop.turns.length === 0 ? <p>{t('workshopNoTurns')}</p>
            : <ol>{shownWorkshop.turns.map(turn => <li key={turn.turnRef}>
              <p><strong>{t('workshopUser')}:</strong> {turn.userText}</p>
              <p><strong>{t('workshopReply')}:</strong> {turn.resultText}</p>
            </li>)}</ol>}
        </>}
      </>}
    </section>
    <button type="button" onClick={openPlugins} className={styles.pluginLink}>{t('openPlugins')} ↗</button>
  </section>
}
