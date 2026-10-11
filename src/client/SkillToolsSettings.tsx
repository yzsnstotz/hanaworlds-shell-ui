import { bridgeView } from './desktop-bridge.ts'
import { Fragment, useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { Key } from './locales.ts'
import styles from './ShellSettings.module.css'

interface Catalog {
  kind: string
  tools: { value: { name: string; description: string }[] | null
    error: string | null }
  skills: { value: {
    name: string
    description: string
    whenToUse?: string
    source: string
    provider: string
    invocation: { modelInvocable: boolean; userInvocable: boolean }
  }[] | null
  complete: boolean
  error: string | null }
}
interface Methods {
  kind: string
  writeTools: { value: {
    skillGuidance: string
    tools: {
      descriptor: {
        method: string
        toolName: string
        purpose: string
        typicalScale: string
        scaleUnit: string
        unavailableReason: string | null
      }
      guidance: { whenToUse: string; notFor: string; input: string }
    }[]
  } | null
  error: string | null }
  regionSeams: { seam: string
    compatible: boolean
    unmet: { code: string; need: string } | null }[]
}
interface Binding {
  phase: string
  reason?: string
  view?: { source: string }
}
const uses = new Map<string, Key>([
  ['hanaworlds_context', 'toolsContext'], ['hanaworlds_image_material', 'toolsImage'],
  ['hanaworlds_proposal', 'toolsCell'], ['hanaworlds_region_proposal', 'toolsRegion'],
  ['hanaworlds_write_methods', 'toolsMethodsUse'], ['hanaworlds_build', 'toolsBuild'],
])

/** Read-only current Host registrations and Workshop guidance; never invokes a business tool. */
export function SkillToolsSettings({ t }: PropsLocale<'hanaworlds.shell'>) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [methods, setMethods] = useState<Methods | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [methodsError, setMethodsError] = useState('')
  const [binding, setBinding] = useState<Binding | null>(null)
  useEffect(() => {
    let live = true
    void fetch('/api-hanaworlds-skill-tools').then(async (response) => {
      if (!response.ok) throw new Error('HANAWORLDS_SKILL_TOOLS_UNAVAILABLE')
      const value = await response.json() as Catalog
      if (value.kind !== 'HANAWORLDS_SKILL_TOOLS') throw new Error('HANAWORLDS_SKILL_TOOLS_UNAVAILABLE')
      if (live) setCatalog(value)
    }).catch((error: unknown) => { if (live) setCatalogError(String(error)) })
    void fetch('/api-hanaworlds-k3').then(async (response) => {
      if (!response.ok) throw new Error('WRITE_METHODS_UNAVAILABLE')
      const value = await response.json() as Methods
      if (value.kind !== 'K3_COMPOSITION') throw new Error('WRITE_METHODS_UNAVAILABLE')
      if (live) setMethods(value)
    }).catch((error: unknown) => { if (live) setMethodsError(String(error)) })
    const api = bridgeView
    if (api) void api.current().then((value) => { if (live) setBinding(value) })
      .catch(() => { if (live) setBinding(null) })
    return () => { live = false }
  }, [])
  return <section className={styles.page}>
    <header className={styles.header}><h2>{t('toolsTitle')}</h2></header>
    <p>{t('toolsIntro')}</p>
    <section className={styles.panel} aria-label={t('toolsConditions')}>
      <h3>{t('toolsConditions')}</h3><p>{t('toolsSnapshot')}</p>
      <p>{binding === null ? t('toolsBindingUnknown') : binding.phase === 'bound'
        ? binding.view?.source === 'FIXTURE' ? t('toolsFixture') : t('toolsBound')
        : t('toolsUnbound')}{binding?.reason ? ` · ${binding.reason}` : ''}</p>
      <p>{t('toolsPrerequisites')}</p>
    </section>
    <section className={styles.panel} aria-label={t('toolsSkills')}>
      <h3>{t('toolsSkills')}</h3>
      {catalogError ? <p role="alert">{t('toolsUnknown')} · {catalogError}</p> : catalog === null ? <p>{t('loading')}</p> : <>
        {catalog.skills.error && <p role="alert">{t('toolsUnknown')} · {catalog.skills.error}</p>}
        {!catalog.skills.complete && <p role="alert">{t('toolsIncomplete')}</p>}
        {catalog.skills.value?.length === 0 && <p>{t('toolsNoSkills')}</p>}
        {catalog.skills.value?.map(skill => <section key={skill.name}>
          <h4>{skill.name}</h4><p>{skill.description}</p>{skill.whenToUse && <p>{skill.whenToUse}</p>}
          <dl className={styles.facts}>
            <dt>{t('toolsOrigin')}</dt><dd>{skill.source} · {skill.provider}</dd>
            <dt>{t('toolsModel')}</dt><dd>{skill.invocation.modelInvocable ? t('toolsYes') : t('toolsNo')}</dd>
            <dt>{t('toolsUser')}</dt><dd>{skill.invocation.userInvocable ? t('toolsYes') : t('toolsNo')}</dd>
          </dl>
        </section>)}
      </>}
    </section>
    <section className={styles.panel} aria-label={t('toolsList')}>
      <h3>{t('toolsList')}</h3>
      {catalogError ? <p role="alert">{t('toolsUnknown')} · {catalogError}</p> : catalog === null ? <p>{t('loading')}</p> : <>
        {catalog.tools.error && <p role="alert">{t('toolsUnknown')} · {catalog.tools.error}</p>}
        {catalog.tools.value?.length === 0 && <p>{t('toolsNoTools')}</p>}
        {catalog.tools.value?.map(tool => <section key={tool.name}>
          <h4>{tool.name}</h4><p>{tool.description}</p><p>{t(uses.get(tool.name) ?? 'toolsUnknownScale')}</p>
        </section>)}
      </>}
    </section>
    <section className={styles.panel} aria-label={t('k3Methods')}>
      <h3>{t('k3Methods')}</h3><p>{t('k3Intro')}</p>
      {methodsError ? <p role="alert">{t('toolsUnknown')} · {methodsError}</p> : methods === null ? <p>{t('loading')}</p>
        : <>
          {methods.writeTools.value === null ? <p role="alert">{t('k3Unavailable')} · {methods.writeTools.error}</p> : <>
            <p>{methods.writeTools.value.skillGuidance}</p>
            {methods.writeTools.value.tools.map(({ descriptor: d, guidance: g }) => <section key={d.method}>
              <h4>{d.method} · {d.toolName}</h4><p>{d.purpose}</p>
              <dl className={styles.facts}>
                <dt>{t('toolsScale')}</dt><dd>{d.typicalScale} · {d.scaleUnit}</dd>
                <dt>{t('toolsWhen')}</dt><dd>{g.whenToUse}</dd>
                <dt>{t('toolsNotFor')}</dt><dd>{g.notFor}</dd>
                <dt>{t('toolsInput')}</dt><dd>{g.input}</dd>
              </dl>
              {d.unavailableReason && <p role="alert">{t('k3Unavailable')} · {d.unavailableReason}</p>}
            </section>)}
          </>}
          <dl className={styles.facts}>{methods.regionSeams.map(seam => <Fragment key={seam.seam}>
            <dt>{seam.seam}</dt><dd>{seam.compatible ? t('toolsSeamOnly') : `${t('k3Unavailable')} · ${seam.unmet?.code ?? ''} · ${seam.unmet?.need ?? t('toolsUnknown')}`}</dd>
          </Fragment>)}</dl>
        </>}
    </section>
  </section>
}
