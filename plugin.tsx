import { defineConnection, definePlugin, defineSource, defineView } from '@jaspers-ai/sdk'
import { z } from 'zod'
import { KINDS, newsSummary, technicalsSummary, TIMEFRAMES } from './fmp'
import { NEWS_INSTRUCTIONS, TECHNICALS_INSTRUCTIONS } from './instructions'
import { NewsView } from './News'
import { TechnicalsView } from './Technicals'

// Financial Modeling Prep over its own connection, fmp/mcp, FMP's MCP server cut to three of its
// tools: one source per tool the connection offers, and a view for two of them, each about one
// company. Form 13F has a source and no view: FMP keeps it behind its Ultimate plan, and a
// view that has only ever been refused is not worth its space. The sources carry no description of
// their own: an MCP source without one borrows the server's, which lists the group's endpoints and
// what each requires, beside the server's own schema, whose `endpoint` names them. The orchestrator
// gets fmp__form-13f, fmp__news, and fmp__technical-indicators, and places the views instead of
// calling them for what a view shows.

const form13f = defineSource({ mcp: 'mcp', tool: 'form13F' })
const news = defineSource({ mcp: 'mcp', tool: 'news' })
const technicalIndicators = defineSource({ mcp: 'mcp', tool: 'technicalIndicators' })

const Symbol = z.string().default('')
const Amount = z.number().nullable()

const NewsState = z.object({ symbol: Symbol, limit: z.number().int().min(1).max(50).optional() })
const NewsOutput = z.object({
  symbol: z.string(),
  count: z.number(),
  items: z.array(z.object({ date: z.string(), site: z.string(), title: z.string(), url: z.string() })),
})

const TechnicalsState = z.object({
  symbol: Symbol,
  timeframe: z.enum(TIMEFRAMES).optional(),
  days: z.number().int().min(1).max(365).optional(),
  indicators: z.array(z.object({ kind: z.enum(KINDS), period: z.number().int().min(1).max(500) })).max(6).optional(),
})
const TechnicalsOutput = z.object({
  symbol: z.string(),
  timeframe: z.enum(TIMEFRAMES),
  date: z.string().nullable(),
  close: Amount,
  values: z.record(z.string(), Amount),
  rows: z.number(),
})

export default definePlugin({
  id: 'fmp',
  secrets: { apikey: { label: 'FMP API key' } },
  connections: {
    // FMP's MCP server, streamable HTTP and stateful, cut to three of its tools. FMP reads the key
    // from the URL and nowhere else (a header is refused), so it rides there. FMP accepts any key at
    // connect, so a wrong one shows as ready and fails at the first call, saying so.
    mcp: defineConnection({
      url: 'https://financialmodelingprep.com/mcp?apikey=${secret:apikey}',
      tools: ['form13F', 'news', 'technicalIndicators'],
    }),
  },
  sources: { 'form-13f': form13f, news, 'technical-indicators': technicalIndicators },
  views: {
    news: defineView(NewsView, {
      title: 'News',
      state: NewsState,
      output: NewsOutput,
      instructions: NEWS_INSTRUCTIONS,
      renders: [news],
      summarize: newsSummary,
    }),
    technicals: defineView(TechnicalsView, {
      title: 'Technicals',
      state: TechnicalsState,
      output: TechnicalsOutput,
      instructions: TECHNICALS_INSTRUCTIONS,
      renders: [technicalIndicators],
      summarize: technicalsSummary,
    }),
  },
})
