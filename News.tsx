import type { ReactElement } from 'react'
import { useBridge, useData, usePanelState, usePublish, type PanelRef } from '@jaspers-ai/sdk'
import { newsOutput, readNewsState, readSymbol, type Row } from './fmp'
import { Loading, NoSymbol, Section, SymbolField, rowsOf, useInitialState } from './shared'
import './styles.css'

// Stock news for one company: FMP's search-stock-news, newest first. A title opens its article in
// the system browser through the bridge, since the frame can open nothing itself.

export function NewsView({ panel }: { panel: PanelRef }): ReactElement {
  const initial = useInitialState(panel)
  if (initial === undefined) return <Loading />
  return <News panel={panel} initial={initial} />
}

function News({ panel, initial }: { panel: PanelRef; initial: unknown }): ReactElement {
  const first = readNewsState(initial)
  const [symbol, setSymbol] = usePanelState<string>(panel, 'symbol', first.symbol)
  const [limit] = usePanelState<number>(panel, 'limit', first.limit)
  const state = readNewsState({ symbol, limit })
  return (
    <div className="fm-root">
      <div className="fm-bar">
        <SymbolField symbol={state.symbol} onSymbol={setSymbol} />
        <span className="fm-muted">News</span>
      </div>
      <div className="fm-body">
        {state.symbol ? <Body panel={panel} symbol={state.symbol} limit={state.limit} /> : <NoSymbol panel={panel} output={newsOutput('', [])} />}
      </div>
    </div>
  )
}

function Body({ panel, symbol, limit }: { panel: PanelRef; symbol: string; limit: number }): ReactElement {
  const bridge = useBridge()
  const news = useData('fmp/news', { endpoint: 'search-stock-news', symbols: [symbol], limit })
  const rows = rowsOf(news)
  usePublish(panel, newsOutput(symbol, news.data))
  return (
    <Section title={`${symbol} news`} run={news} empty={rows.length === 0}>
      <ul className="fm-list">
        {rows.map((row, index) => (
          <Item key={index} row={row} onOpen={(url) => void bridge.openLink(url)} />
        ))}
      </ul>
    </Section>
  )
}

function Item({ row, onOpen }: { row: Row; onOpen: (url: string) => void }): ReactElement {
  const url = typeof row['url'] === 'string' ? row['url'] : ''
  const title = String(row['title'] ?? '')
  return (
    <li className="fm-item">
      <div className="fm-item-head">
        <span className="fm-muted">{String(row['publishedDate'] ?? '').slice(0, 16)}</span>
        <span className="fm-muted">{String(row['site'] ?? row['publisher'] ?? '')}</span>
      </div>
      {url.startsWith('https://') ? (
        <button type="button" className="fm-link" onClick={() => onOpen(url)}>
          {title}
        </button>
      ) : (
        <span className="fm-title">{title}</span>
      )}
      {typeof row['text'] === 'string' && row['text'] && <p className="fm-snippet">{row['text']}</p>}
    </li>
  )
}
