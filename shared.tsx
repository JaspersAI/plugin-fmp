import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { useData, usePublish, type PanelRef } from '@jaspers-ai/sdk'

// What the two views share: the bar with the symbol field, a section that shows its run's state
// before its rows, and the gate that waits for the panel's state to arrive.

/** The panel's state, a round trip after the frame mounts; nothing to draw until it is here. */
export function useInitialState(panel: PanelRef): unknown {
  return useData(`workspaces/${panel.workspaceId}/panels/${panel.id}/state`)
}

export function Loading(): ReactElement {
  return (
    <div className="fm-root">
      <div className="fm-bar">
        <span className="fm-muted">Loading…</span>
      </div>
    </div>
  )
}

/**
 * The symbol field: typing and Enter write the panel's state, and a state the orchestrator sets shows
 * here. Enter is read off the key, not a form: the view's frame is sandboxed without allow-forms, so a
 * form never submits.
 */
export function SymbolField({ symbol, onSymbol }: { symbol: string; onSymbol: (symbol: string) => void }): ReactElement {
  const [draft, setDraft] = useState(symbol)
  useEffect(() => setDraft(symbol), [symbol])
  return (
    <input
      className="fm-input fm-input-symbol"
      name="symbol"
      value={draft}
      placeholder="Symbol"
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
        event.preventDefault()
        onSymbol(draft.trim().toUpperCase())
      }}
    />
  )
}

/** A view with no symbol yet says so, and publishes that it shows nothing. */
export function NoSymbol({ panel, output }: { panel: PanelRef; output: Record<string, unknown> }): ReactElement {
  usePublish(panel, output)
  return <p className="fm-empty">Enter a symbol.</p>
}

interface RunState {
  loading: boolean
  error: string | null
}

/** A titled block: its run's error (FMP's own words, plan refusals included) or loading line first, then its rows. */
export function Section({ title, run, empty, children }: { title: string; run: RunState; empty?: boolean; children?: ReactNode }): ReactElement {
  return (
    <section className="fm-section">
      <h2 className="fm-h">
        {title}
        {run.loading && <span className="fm-muted fm-loading">loading…</span>}
      </h2>
      {run.error ? <p className="fm-error">{cleanError(run.error)}</p> : empty && !run.loading ? <p className="fm-muted">Nothing returned.</p> : children}
    </section>
  )
}

/** The message as the server or main wrote it, without the wrapping the IPC adds. */
export function cleanError(message: string): string {
  return message.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, '')
}

/** The rows a run gave, or none while it has not. */
export function rowsOf(run: { data: Record<string, unknown>[] | undefined }): Record<string, unknown>[] {
  return run.data ?? []
}
