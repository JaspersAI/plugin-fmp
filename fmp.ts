// The plugin's pure half: each view's state read the forgiving way (main stores state as written, so
// a key can be missing or the wrong shape), FMP's numbers formatted for a cell, the indicator runs
// merged into one table, and what each view publishes and says in the model's map. No React and no
// bridge here, so it runs under the tests.

export type Row = Record<string, unknown>

export function record(value: unknown): Row | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Row) : null
}

/** The ticker every view is about: trimmed and upper case, or nothing. */
export function readSymbol(raw: unknown): string {
  const symbol = record(raw)?.['symbol']
  return typeof symbol === 'string' ? symbol.trim().toUpperCase() : ''
}

// News.

export interface NewsState {
  symbol: string
  limit: number
}

export function readNewsState(raw: unknown): NewsState {
  const limit = int(record(raw)?.['limit'])
  return { symbol: readSymbol(raw), limit: limit === undefined ? 20 : clamp(limit, 1, 50) }
}

// Technicals: which indicators, on which bars, over how many days.

export const KINDS = ['sma', 'ema', 'wma', 'dema', 'tema', 'rsi', 'stddev', 'williams', 'adx'] as const
export type Kind = (typeof KINDS)[number]

export interface Indicator {
  kind: Kind
  period: number
}

export const TIMEFRAMES = ['1min', '5min', '15min', '30min', '1hour', '4hour', '1day'] as const
export type Timeframe = (typeof TIMEFRAMES)[number]

/** Each kind's FMP endpoint, the key its rows carry the value under, and its label. */
export const INDICATORS: Record<Kind, { endpoint: string; key: string; label: string }> = {
  sma: { endpoint: 'simple-moving-average', key: 'sma', label: 'SMA' },
  ema: { endpoint: 'exponential-moving-average', key: 'ema', label: 'EMA' },
  wma: { endpoint: 'weighted-moving-average', key: 'wma', label: 'WMA' },
  dema: { endpoint: 'double-exponential-moving-average', key: 'dema', label: 'DEMA' },
  tema: { endpoint: 'triple-exponential-moving-average', key: 'tema', label: 'TEMA' },
  rsi: { endpoint: 'relative-strength-index', key: 'rsi', label: 'RSI' },
  stddev: { endpoint: 'standard-deviation', key: 'standardDeviation', label: 'StdDev' },
  williams: { endpoint: 'williams', key: 'williams', label: 'Williams %R' },
  adx: { endpoint: 'average-directional-index', key: 'adx', label: 'ADX' },
}

export const MAX_INDICATORS = 6
const DEFAULT_INDICATORS: Indicator[] = [
  { kind: 'rsi', period: 14 },
  { kind: 'sma', period: 50 },
  { kind: 'sma', period: 200 },
]

export interface TechnicalsState {
  symbol: string
  timeframe: Timeframe
  days: number
  indicators: Indicator[]
}

export function readTechnicalsState(raw: unknown): TechnicalsState {
  const state = record(raw) ?? {}
  const timeframe = TIMEFRAMES.find((t) => t === state['timeframe']) ?? '1day'
  const days = clamp(int(state['days']) ?? 30, 1, 365)
  const given = state['indicators']
  const indicators: Indicator[] = []
  for (const entry of Array.isArray(given) ? given : []) {
    const item = record(entry)
    const kind = KINDS.find((k) => k === item?.['kind'])
    const period = item?.['period']
    if (!kind || !Number.isInteger(period) || (period as number) < 1 || (period as number) > 500) continue
    if (indicators.some((i) => i.kind === kind && i.period === period)) continue
    if (indicators.length === MAX_INDICATORS) break
    indicators.push({ kind, period: period as number })
  }
  return { symbol: readSymbol(raw), timeframe, days, indicators: Array.isArray(given) ? indicators : DEFAULT_INDICATORS }
}

export function indicatorLabel(indicator: Indicator): string {
  return `${INDICATORS[indicator.kind].label} ${indicator.period}`
}

/** The key an indicator's value is published under: `rsi14`, `sma50`. */
export function indicatorId(indicator: Indicator): string {
  return `${indicator.kind}${indicator.period}`
}

/** That many days before today, as FMP's from_date. */
export function fromDate(today: Date, days: number): string {
  return new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10)
}

export interface MergedRow {
  date: string
  close: number | null
  values: Record<string, number | null>
}

/** One table out of one run per indicator: a row per bar, latest first, a column per indicator. */
export function mergeByDate(runs: { indicator: Indicator; rows: Row[] | undefined }[]): MergedRow[] {
  const ids = runs.map((run) => indicatorId(run.indicator))
  const byDate = new Map<string, MergedRow>()
  for (const run of runs) {
    const id = indicatorId(run.indicator)
    const key = INDICATORS[run.indicator.kind].key
    for (const row of run.rows ?? []) {
      const date = typeof row['date'] === 'string' ? row['date'] : ''
      if (!date) continue
      let merged = byDate.get(date)
      if (!merged) {
        merged = { date, close: null, values: Object.fromEntries(ids.map((i) => [i, null])) }
        byDate.set(date, merged)
      }
      if (merged.close === null && typeof row['close'] === 'number') merged.close = row['close']
      const value = row[key]
      if (typeof value === 'number') merged.values[id] = value
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// Formatting.

const MINUS = '−'

export function num(value: unknown, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value < 0 ? `${MINUS}${fixed(-value, digits)}` : fixed(value, digits)
}

/** FMP writes '2026-09-11 00:00:00'; the day is what a cell wants. */
export function shortDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''
}

function fixed(value: number, digits: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// News.

export type NewsOutput = {
  symbol: string
  count: number
  items: { date: string; site: string; title: string; url: string }[]
}

export function newsOutput(symbol: string, rows: Row[] | undefined, cap = 10): NewsOutput {
  const all = rows ?? []
  return {
    symbol,
    count: all.length,
    items: all.slice(0, cap).map((row) => ({
      date: text(row['publishedDate']) ?? '',
      site: text(row['site']) ?? '',
      title: text(row['title']) ?? '',
      url: text(row['url']) ?? '',
    })),
  }
}

export function newsSummary(state: unknown, output: unknown): string {
  const symbol = readSymbol(state)
  if (!symbol) return 'News: no symbol'
  const out = record(output)
  const first = record(Array.isArray(out?.['items']) ? out['items'][0] : null)
  if (!out || !first) return `${symbol} news`
  return `${symbol} news: ${num(out['count'], 0)} items, latest ${shortDate(first['date'])} ${text(first['site']) ?? ''}`.trimEnd()
}

// Technicals.

export type TechnicalsOutput = {
  symbol: string
  timeframe: Timeframe
  date: string | null
  close: number | null
  values: Record<string, number | null>
  rows: number
}

export function technicalsOutput(state: TechnicalsState, merged: MergedRow[]): TechnicalsOutput {
  const latest = merged[0]
  return {
    symbol: state.symbol,
    timeframe: state.timeframe,
    date: latest?.date ?? null,
    close: latest?.close ?? null,
    values: latest?.values ?? {},
    rows: merged.length,
  }
}

export function technicalsSummary(state: unknown, output: unknown): string {
  const read = readTechnicalsState(state)
  if (!read.symbol) return 'Technicals: no symbol'
  const values = record(record(output)?.['values'])
  const parts = values
    ? read.indicators
        .map((indicator) => ({ indicator, value: values[indicatorId(indicator)] }))
        .filter(({ value }) => typeof value === 'number')
        .map(({ indicator, value }) => `${indicatorLabel(indicator)} ${num(value, 1)}`)
    : []
  return parts.length ? `${read.symbol} ${read.timeframe}: ${parts.join(', ')}` : `${read.symbol} ${read.timeframe} technicals`
}

// Small readers.

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function int(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
