import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useData, usePanelState, usePublish, type PanelRef } from '@jaspers-ai/sdk'
import {
  fromDate,
  INDICATORS,
  indicatorId,
  indicatorLabel,
  mergeByDate,
  num,
  readSymbol,
  readTechnicalsState,
  shortDate,
  technicalsOutput,
  TIMEFRAMES,
  type Indicator,
  type Row,
  type Timeframe,
} from './fmp'
import { cleanError, Loading, NoSymbol, SymbolField, useInitialState } from './shared'
import './styles.css'

// Technical indicators for one company: one run per indicator in the panel's state, merged into
// one table by bar. Each run is a child of its own, since hooks cannot be called in a loop whose
// length the state decides; the children report their rows up and the table is made here.

interface RunReport {
  rows: Row[] | undefined
  loading: boolean
  error: string | null
}

export function TechnicalsView({ panel }: { panel: PanelRef }): ReactElement {
  const initial = useInitialState(panel)
  if (initial === undefined) return <Loading />
  return <Technicals panel={panel} initial={initial} />
}

function Technicals({ panel, initial }: { panel: PanelRef; initial: unknown }): ReactElement {
  const first = readTechnicalsState(initial)
  const [symbol, setSymbol] = usePanelState<string>(panel, 'symbol', first.symbol)
  const [timeframe, setTimeframe] = usePanelState<Timeframe>(panel, 'timeframe', first.timeframe)
  const [days] = usePanelState<number>(panel, 'days', first.days)
  const [indicators] = usePanelState<Indicator[]>(panel, 'indicators', first.indicators)
  const state = readTechnicalsState({ symbol, timeframe, days, indicators })
  return (
    <div className="fm-root">
      <div className="fm-bar">
        <SymbolField symbol={state.symbol} onSymbol={setSymbol} />
        <select className="fm-select" value={state.timeframe} onChange={(event) => setTimeframe(event.target.value as Timeframe)}>
          {TIMEFRAMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="fm-muted">{state.indicators.map(indicatorLabel).join(', ') || 'no indicators'}</span>
      </div>
      <div className="fm-body">
        {state.symbol ? (
          <Body panel={panel} symbol={state.symbol} timeframe={state.timeframe} days={state.days} indicators={state.indicators} />
        ) : (
          <NoSymbol panel={panel} output={technicalsOutput(state, [])} />
        )}
      </div>
    </div>
  )
}

function Body({
  panel,
  symbol,
  timeframe,
  days,
  indicators,
}: {
  panel: PanelRef
  symbol: string
  timeframe: Timeframe
  days: number
  indicators: Indicator[]
}): ReactElement {
  // The from date is fixed for as long as `days` holds, or a new date every render would re-run everything.
  const from = useMemo(() => fromDate(new Date(), days), [days])
  const [reports, setReports] = useState<Record<string, RunReport>>({})
  const ids = indicators.map(indicatorId)
  const merged = mergeByDate(indicators.map((indicator) => ({ indicator, rows: reports[indicatorId(indicator)]?.rows })))
  const loading = ids.some((id) => reports[id]?.loading ?? true)
  const errors = ids.flatMap((id) => (reports[id]?.error ? [`${id}: ${cleanError(reports[id]!.error!)}`] : []))
  usePublish(panel, technicalsOutput({ symbol, timeframe, days, indicators }, merged))
  const intraday = timeframe !== '1day'
  return (
    <>
      {indicators.map((indicator) => (
        <IndicatorRun
          key={indicatorId(indicator)}
          id={indicatorId(indicator)}
          args={{ endpoint: INDICATORS[indicator.kind].endpoint, symbol, periodLength: indicator.period, timeframe, from_date: from }}
          onReport={(id, report) => setReports((previous) => ({ ...previous, [id]: report }))}
        />
      ))}
      {errors.map((error) => (
        <p key={error} className="fm-error">
          {error}
        </p>
      ))}
      {indicators.length === 0 ? (
        <p className="fm-empty">No indicators in state.</p>
      ) : (
        <table className="fm-table">
          <thead>
            <tr>
              <th>{intraday ? 'Bar' : 'Date'}</th>
              <th className="fm-num">Close</th>
              {indicators.map((indicator) => (
                <th key={indicatorId(indicator)} className="fm-num">
                  {indicatorLabel(indicator)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {merged.map((row) => (
              <tr key={row.date}>
                <td>{intraday ? row.date.slice(0, 16) : shortDate(row.date)}</td>
                <td className="fm-num">{num(row.close)}</td>
                {ids.map((id) => (
                  <td key={id} className="fm-num">
                    {num(row.values[id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {merged.length === 0 && !loading && errors.length === 0 && indicators.length > 0 && <p className="fm-muted">Nothing returned.</p>}
      {loading && <p className="fm-muted fm-loading">loading…</p>}
    </>
  )
}

/** One indicator's run. Renders nothing; the parent draws the table once every run has reported. */
function IndicatorRun({ id, args, onReport }: { id: string; args: Record<string, unknown>; onReport: (id: string, report: RunReport) => void }): null {
  const run = useData('fmp/technical-indicators', args)
  useEffect(() => {
    onReport(id, { rows: run.data, loading: run.loading, error: run.error })
    // The parent's callback is a new function every render; what matters is the run's result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, run.data, run.loading, run.error])
  return null
}
