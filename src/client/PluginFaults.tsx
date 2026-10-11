import { useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { HanaShellPage } from './HanaShellPage.tsx'
import styles from './ShellSettings.module.css'

export interface PluginFault { name: string; operation: string; reason: string }
/** One apply lifetime; unmounting the plugin releases its fault state with its seats. */
export class PluginFaultStore {
  private faults: readonly PluginFault[] = []
  private listeners = new Set<() => void>()
  readonly getSnapshot = () => this.faults
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  record(operation: string, error: unknown) {
    // Keep the first original error for each registration; no retry or rewritten success.
    if (this.faults.some(item => item.operation === operation)) return
    const reason = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
    this.faults = [...this.faults, { name: 'hanaworlds-shell-ui', operation, reason }]
    for (const listener of this.listeners) listener()
  }
}
export function PluginFaultCards({ faults }: { faults: PluginFaultStore }) {
  const observed = useSyncExternalStore(faults.subscribe, faults.getSnapshot, faults.getSnapshot)
  return <>{observed.map(fault => <section role="alert" className={styles.panel} key={fault.operation} data-hanaworlds-plugin-fault={fault.name}>
    <h3>{fault.name}</h3><p>{fault.operation} · {fault.reason}</p>
  </section>)}</>
}
export function ShellFaultStatus({ faults, view }: InjectFace<{ faults: PluginFaultStore; view: 'summary' | 'page' }>) {
  return view === 'page' ? <PluginFaultCards faults={faults} /> : null
}
export function ShellPageWithFaults({ faults, ...props }: Parameters<typeof HanaShellPage>[0] & { faults: PluginFaultStore } & PropsLocale<'hanaworlds.shell'>) {
  return <><PluginFaultCards faults={faults} /><HanaShellPage {...props} /></>
}
