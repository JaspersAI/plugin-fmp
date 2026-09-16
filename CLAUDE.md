# CLAUDE.md

The `fmp` plugin for Jaspers Terminal, written against `@jaspers-ai/sdk`. The app loads it from a folder in `~/Jaspers/plugins/fmp` (a clone of this repo, or an installed release) and rebuilds it on save. How plugins work, the SDK, and the app's side are in the terminal repo's CLAUDE.md.

## Commands

Node 24.

- `npm install`
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Node's test runner over the `*.test.ts` files, which strips the types itself
- `npm run package` — `build/fmp-<version>.zip`, what a release attaches; the Release workflow runs it on a `v*` tag

Style: square, no rounded corners; `#e5e5e5` borders, `#737373` muted.

## The plugin

- The FMP connection: this repo declares `fmp/mcp`, Financial Modeling Prep's MCP server (`https://financialmodelingprep.com/mcp`, streamable HTTP, stateful) with the key in the URL's `apikey` query, since the server reads it nowhere else (an `apikey` or `Authorization` header gets a 401), the plugin's one secret, `apikey`, filled in at connect time. The server lists 28 grouped tools, each taking an `endpoint` naming the FMP endpoint; the connection's `tools` cuts them to `form13F`, `news`, and `technicalIndicators`, and the plugin makes each a source (`fmp__form-13f`, `fmp__news`, `fmp__technical-indicators`) with no description of its own, so the model reads FMP's, and a view for all but `form13F` (The FMP plugin, below). FMP accepts any key at connect, so a wrong key shows `ready` and every call answers `isError` with "Invalid API KEY". What answers is by plan: on Starter, stock news and technical indicators answer, `form13F` and press releases are refused (Ultimate, Premium). Its OAuth server has no dynamic registration (client-id metadata documents only), so `auth: oauth` is not an option.

### The FMP plugin

This repo holds the three sources above, on its connection `fmp/mcp`, and two views, each about one company, `fmp/news` and `fmp/technicals`, rendered in the plugin's own iframes like any plugin view. Analyst coverage (price targets, grades, rating, estimates) had a source and a view until it was taken out; a saved panel that held it shows `Unknown view fmp/analyst`. Form 13F has its source and no view: FMP keeps it behind the Ultimate plan, and the only key at hand is a Starter one, so a view for it was built, seen refused, and taken out.

- `fmp.ts` is the pure half, tested in `fmp.test.ts`: each view's state read the forgiving way (`readSymbol`, `readNewsState`, `readTechnicalsState` with RSI 14, SMA 50, and SMA 200 on daily bars as the default and up to six indicators), the indicator table (`INDICATORS` maps a kind to its FMP endpoint and the key its rows carry, `mergeByDate` makes one table out of one run per indicator), the formatters (`num`, `shortDate`), and each view's output and summary line.
- `shared.tsx` is the symbol field (Enter writes `state.symbol`; a symbol the orchestrator sets shows in it), the state gate every view starts with (`useInitialState`, the `ScreenerView` pattern), `Section` (a run's error in FMP's own words, plan refusals included, before its rows, so a refused section says why), and `NoSymbol`. A view with no symbol mounts no run: the body that calls `useData` is a child rendered only with one.
- `News.tsx` runs `search-stock-news` and opens a title through `openLink`. `Technicals.tsx` runs one endpoint per indicator in a child of its own (`IndicatorRun`), since hooks cannot be called in a loop the state sizes, and the children report their rows up; `from_date` is fixed per `days` or a new date every render would re-run everything.
- The orchestrator drives them by state: `place_view { view: 'fmp/news', state: { symbol: 'AAPL' } }`, `set panels/e1/state/symbol MSFT`, `set panels/e3/state { symbol: 'AAPL', timeframe: '1hour', indicators: [{ kind: 'rsi', period: 14 }] }`; each view's `instructions` say what its output holds and which plan each section needs. A refused source used to run again on every tree push, since `useData` retries a failed run when `connections` changes and the bridge fired that on every push; it hears a change of value now.
