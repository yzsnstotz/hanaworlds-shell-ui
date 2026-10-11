import { useEffect, useState } from 'react'
import type { PluginRole, PluginRoles } from 'hanaworlds-contracts'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import styles from './ShellSettings.module.css'

/** One Loader observation; package installation alone supplies no activation state. */
export interface PluginPhase {
  enabled: boolean
  phase: string | null
  reason?: string
}
/** Current Host/client activation and independently verified package identity. */
export interface PluginObservation {
  name: string
  role?: PluginRole
  version?: string | null
  versionSource?: string | null
  hostRequired: boolean
  clientRequired: boolean
  host: PluginPhase | null
  client: PluginPhase | null
  identity: { version: string; sourceRevision: string; tarSha256: string } | null
}
/** Read-only current runtime and SDK observations supplied by the Shell entry. */
export interface PluginStatusFace {
  view: 'summary' | 'page'
  read(this: void): Promise<{ plugins: PluginObservation[]; sdk: PluginObservation['identity']; roles?: PluginRoles | null; roleError?: string }>
}

/** Show live Loader states without treating package presence or protocol compatibility as activation. */
export function PluginStatus({ view, read, t }: InjectFace<PluginStatusFace> & PropsLocale<'hanaworlds.shell'>) {
  const [observed, setObserved] = useState<Awaited<ReturnType<PluginStatusFace['read']>> | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (view !== 'page') return
    let live = true
    setObserved(null); setError('')
    void read().then((value) => { if (live) setObserved(value) })
      .catch((failure: unknown) => { if (live) setError(String(failure)) })
    return () => { live = false }
  }, [view, read, revision])
  if (view === 'summary') return <>{t('pluginsIntro')}</>
  return <div className={styles.panel}>
    <p>{t('pluginsIntro')}</p>
    <button type="button" onClick={() => { setRevision(value => value + 1) }}>{t('pluginsRead')}</button>
    {error && <p role="alert">hanaworlds-shell-ui · {error}</p>}
    {!observed && !error && <p role="status">{t('pluginsReading')}</p>}
    {observed?.roles && <p role={observed.roles.status === 'COMPLETE' ? 'status' : 'alert'}>
      <span>{observed.roles.status}</span>{observed.roles.missingRoles.length > 0 && ` · ${t('pluginsMissing')}: ${observed.roles.missingRoles.join(', ')}`}
    </p>}
    {observed?.roleError && <p role="alert">desktop-bridge · {observed.roleError} · {t('pluginsRolesUnknown')}: {observed.plugins.filter(plugin => plugin.role).map(plugin => plugin.role).join(', ')}</p>}
    {observed?.plugins.map((plugin) => {
      const required = [plugin.hostRequired ? plugin.host : undefined, plugin.clientRequired ? plugin.client : undefined]
        .filter(value => value !== undefined)
      const missing = plugin.role && observed.roles?.missingRoles.includes(plugin.role)
      const phase = missing ? 'pluginsMissing' : required.some(value => value?.phase === 'failed') ? 'pluginsFailed'
        : required.some(value => value?.enabled === false) ? 'pluginsDisabled'
          : required.length > 0 && required.every(value => value?.enabled === true && value.phase === 'active') ? 'pluginsRunning'
            : required.some(value => value === null) ? 'pluginsUnknown' : 'pluginsWaiting'
      return <section key={`${plugin.role ?? ''}:${plugin.name}`} data-hanaworlds-plugin={plugin.name} data-hanaworlds-role={plugin.role}>
        <h3>{plugin.name}</h3>{plugin.role && plugin.role !== plugin.name && <p>{plugin.role}</p>}<p role="status">{t(phase)}</p>
        {phase === 'pluginsFailed' && <p role="alert">{plugin.name} · {[plugin.host, plugin.client].filter(value => value?.phase === 'failed').map(value => value?.reason ?? t('pluginsFailed')).join(' · ')}</p>}
        <p>{t('version')} · <span>{plugin.version ?? t('pluginsUnknown')}</span>{plugin.versionSource && plugin.versionSource !== plugin.name && ` · ${plugin.versionSource}`}</p>
        <dl className={styles.facts}>
          {plugin.identity && <><dt>{t('pluginsIdentity')}</dt><dd>{plugin.identity.sourceRevision} · {plugin.identity.tarSha256}</dd></>}
          {plugin.hostRequired && <><dt>{t('pluginsHost')}</dt><dd>{plugin.host?.phase ?? t('pluginsUnknown')}</dd></>}
          {plugin.clientRequired && <><dt>{t('pluginsClient')}</dt><dd>{plugin.client?.phase ?? t('pluginsUnknown')}</dd></>}
        </dl>
      </section>
    })}
    {observed && <section data-hanaworlds-sdk="hanaworlds-contracts"><h3>hanaworlds-contracts</h3>
      <p>{observed.sdk ? t('pluginsSdk') : t('pluginsUnknown')}</p>
      {observed.sdk && <dl className={styles.facts}><dt>{t('pluginsIdentity')}</dt><dd>{observed.sdk.version} · {observed.sdk.sourceRevision} · {observed.sdk.tarSha256}</dd></dl>}
    </section>}
  </div>
}
