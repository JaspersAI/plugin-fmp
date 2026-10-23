import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  fromDate,
  INDICATORS,
  indicatorId,
  indicatorLabel,
  mergeByDate,
  newsOutput,
  OUTPUT_MAX,
  newsSummary,
  num,
  readNewsState,
  readSymbol,
  readTechnicalsState,
  shortDate,
  technicalsOutput,
  technicalsSummary,
} from './fmp.ts'

// The plugin's pure half: each view's state read the forgiving way, FMP's numbers formatted, the
// indicator runs merged into one table, and what each view publishes and says in the model's map.
// The rows below are FMP's own answers for AAPL, cut down.

const TODAY = new Date('2026-09-13T12:00:00Z')

test('a symbol is trimmed and upper case, and nothing when missing', () => {
  assert.equal(readSymbol({ symbol: ' aapl ' }), 'AAPL')
  assert.equal(readSymbol({ symbol: 7 }), '')
  assert.equal(readSymbol(null), '')
})

test('the technicals state defaults to RSI 14 and SMA 50 and 200 on daily bars', () => {
  assert.deepEqual(readTechnicalsState({ symbol: 'aapl' }), {
    symbol: 'AAPL',
    timeframe: '1day',
    days: 30,
    indicators: [
      { kind: 'rsi', period: 14 },
      { kind: 'sma', period: 50 },
      { kind: 'sma', period: 200 },
    ],
  })
  const custom = readTechnicalsState({
    symbol: 'AAPL',
    timeframe: '1hour',
    days: 400,
    indicators: [{ kind: 'ema', period: 20 }, { kind: 'macd', period: 9 }, { kind: 'adx', period: 0 }, { kind: 'ema', period: 20 }],
  })
  assert.equal(custom.timeframe, '1hour')
  assert.equal(custom.days, 365)
  assert.deepEqual(custom.indicators, [{ kind: 'ema', period: 20 }])
  assert.equal(readTechnicalsState({ timeframe: 'weekly' }).timeframe, '1day')
})

test('the news state takes a limit between 1 and 50, 20 by default', () => {
  assert.deepEqual(readNewsState({ symbol: 'aapl' }), { symbol: 'AAPL', limit: 20 })
  assert.equal(readNewsState({ limit: 500 }).limit, 50)
  assert.equal(readNewsState({ limit: 0 }).limit, 1)
  assert.equal(readNewsState({ limit: '7' }).limit, 20)
})

test('each indicator kind names its FMP endpoint and the key its rows carry', () => {
  assert.deepEqual(INDICATORS.rsi, { endpoint: 'relative-strength-index', key: 'rsi', label: 'RSI' })
  assert.deepEqual(INDICATORS.stddev, { endpoint: 'standard-deviation', key: 'standardDeviation', label: 'StdDev' })
  assert.deepEqual(INDICATORS.adx, { endpoint: 'average-directional-index', key: 'adx', label: 'ADX' })
  assert.equal(indicatorLabel({ kind: 'sma', period: 50 }), 'SMA 50')
  assert.equal(indicatorId({ kind: 'sma', period: 50 }), 'sma50')
})

test('the from date is that many days back', () => {
  assert.equal(fromDate(TODAY, 30), '2026-08-14')
  assert.equal(fromDate(TODAY, 0), '2026-09-13')
})

test('indicator runs merge into one table by date, latest first, a column per indicator', () => {
  const rsi = { kind: 'rsi' as const, period: 14 }
  const sma = { kind: 'sma' as const, period: 50 }
  const merged = mergeByDate([
    {
      indicator: rsi,
      rows: [
        { date: '2026-09-11 00:00:00', close: 332.27, rsi: 62.789 },
        { date: '2026-09-10 00:00:00', close: 326.57, rsi: 58.93 },
      ],
    },
    {
      indicator: sma,
      rows: [
        { date: '2026-09-10 00:00:00', close: 326.57, sma: 317.2 },
        { date: '2026-09-09 00:00:00', close: 315.34, sma: 316.4 },
      ],
    },
    { indicator: { kind: 'adx', period: 14 }, rows: undefined },
  ])
  assert.deepEqual(merged, [
    { date: '2026-09-11 00:00:00', close: 332.27, values: { rsi14: 62.789, sma50: null, adx14: null } },
    { date: '2026-09-10 00:00:00', close: 326.57, values: { rsi14: 58.93, sma50: 317.2, adx14: null } },
    { date: '2026-09-09 00:00:00', close: 315.34, values: { rsi14: null, sma50: 316.4, adx14: null } },
  ])
})

test('numbers format plain; anything else is a dash', () => {
  assert.equal(num(62.789), '62.79')
  assert.equal(num(62.789, 1), '62.8')
  assert.equal(num(50716865, 0), '50,716,865')
  assert.equal(num('x'), '—')
  assert.equal(shortDate('2026-09-11 00:00:00'), '2026-09-11')
  assert.equal(shortDate(3), '')
})

test('the news view publishes at most ten items and says what is latest', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    symbol: 'AAPL',
    publishedDate: `2026-09-${String(13 - i).padStart(2, '0')} 18:30:00`,
    site: 'fool.com',
    title: `Story ${i}`,
    url: `https://www.fool.com/${i}`,
    text: 'body',
  }))
  const output = newsOutput('AAPL', rows)
  assert.equal(output.items.length, 10)
  assert.deepEqual(output.items[0], { date: '2026-09-13 18:30:00', site: 'fool.com', title: 'Story 0', url: 'https://www.fool.com/0' })
  assert.equal(output.count, 12)
  assert.equal(newsSummary({ symbol: 'AAPL' }, output), 'AAPL news: 12 items, latest 2026-09-13 fool.com')
  assert.equal(newsSummary({ symbol: 'AAPL' }, null), 'AAPL news')
})

test('the news view keeps its output under the 4 KB main takes, however long the headlines', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    symbol: 'PZZA',
    publishedDate: `2026-10-21 15:${String(10 + i).padStart(2, '0')}:00`,
    site: 'globenewswire.com',
    title: `DEADLINE ALERT for several companies (${i}): ${'shareholders are reminded of the lead plaintiff deadline '.repeat(8)}`,
    url: `https://www.globenewswire.com/news-release/2026/10/21/${'3166'.repeat(60)}${i}/0/en/deadline-alert.html`,
    text: 'body',
  }))
  const output = newsOutput('PZZA', rows)
  assert.ok(new TextEncoder().encode(JSON.stringify(output)).length <= OUTPUT_MAX)
  assert.ok(output.items.length > 0 && output.items.length < 10)
  assert.ok(output.items.every((item) => item.title.length <= 200))
  assert.equal(output.items[0]!.date, '2026-10-21 15:10:00')
  assert.equal(output.count, 12)
})

test('the technicals view publishes the latest row and names its values', () => {
  const state = readTechnicalsState({ symbol: 'AAPL', indicators: [{ kind: 'rsi', period: 14 }, { kind: 'sma', period: 50 }] })
  const output = technicalsOutput(state, [
    { date: '2026-09-11 00:00:00', close: 332.27, values: { rsi14: 62.789, sma50: 317.97 } },
    { date: '2026-09-10 00:00:00', close: 326.57, values: { rsi14: 58.93, sma50: 317.2 } },
  ])
  assert.deepEqual(output, {
    symbol: 'AAPL',
    timeframe: '1day',
    date: '2026-09-11 00:00:00',
    close: 332.27,
    values: { rsi14: 62.789, sma50: 317.97 },
    rows: 2,
  })
  assert.equal(technicalsSummary(state, output), 'AAPL 1day: RSI 14 62.8, SMA 50 318.0')
  assert.equal(technicalsSummary(state, null), 'AAPL 1day technicals')
})
