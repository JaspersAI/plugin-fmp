// What the orchestrator is told while one of the FMP views is focused: how each is driven by state,
// what its output holds, and what FMP's plans keep from it.

const PLANS = 'FMP data is by plan: stock news and technical indicators answer on Starter, Form 13F (the fmp__form-13f source, which has no view) only on Ultimate or Enterprise; a refused section shows FMP’s own refusal, so tell the user which plan it needs rather than retrying.'

export const NEWS_INSTRUCTIONS = [
  'Stock news from Financial Modeling Prep for one company, newest first: date, source, title, and a line of the story. A title opens the article in the browser.',
  'state.symbol is the ticker; state.limit is how many stories, 20 by default, up to 50. Set symbol to show another company.',
  'output holds count and items, the ten newest as [{ date, site, title, url }]; read it when the user asks what is in the news, and cite the url.',
  'Press releases are a separate FMP endpoint the view does not show (Premium plan); call fmp__news with endpoint search-press-releases for them.',
].join('\n')

export const TECHNICALS_INSTRUCTIONS = [
  'Technical indicators from Financial Modeling Prep for one company: one column per indicator, one row per bar, latest first, with the close.',
  'state.symbol is the ticker. state.timeframe is the bar size: 1min, 5min, 15min, 30min, 1hour, 4hour, or 1day (default). state.days is how far back, 30 by default. state.indicators is up to six of { kind, period }, kind one of sma, ema, wma, dema, tema, rsi, stddev, williams, adx; the default is RSI 14, SMA 50, and SMA 200. Set the whole list to change it.',
  'output holds the latest bar: date, close, and values keyed by kind and period (rsi14, sma50); read it when the user asks where an indicator stands. Any earlier bar is only on screen.',
  PLANS,
].join('\n')
