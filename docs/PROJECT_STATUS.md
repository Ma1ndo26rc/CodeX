# CodeX v2 Project Status

Last reviewed: 2026-07-12

This document describes the repository state observed in the current working tree. It is a status snapshot, not a product roadmap or a substitute for `project_memory.md` and `decision_log.md`.

## 1. Product Positioning

CodeX v2 is a US equity market-intelligence system. It collects and clusters market-moving news, enriches it with market data and LLM analysis, validates the result as structured JSON, and publishes a multi-page research interface.

The active product layers are deliberately separated:

1. Dashboard: decision layer.
2. Event Feed: factual information layer.
3. Macro Analysis: sell-side strategy interpretation layer.
4. Market Agent: question-driven equity research workspace.
5. Reports: archive and historical document layer.

The intended visual language is a light, high-density institutional research interface inspired by Bloomberg and sell-side research products. It should not become a generic administration dashboard or chat application.

## 2. System Architecture

The main report flow is:

```text
News and market-data sources
  -> Python collection and normalization
  -> Deduplication, event clustering, and scoring
  -> DeepSeek-compatible structured market analysis
  -> Strict schema and UTF-8 JSON validation
  -> reports/*.json, Markdown, PDF, and assets
  -> React/Vite static frontend
  -> site/ GitHub Pages output
```

The MarketAgent has a separate runtime flow:

```text
MarketAgent Research Workspace
  -> AgentRequest v1
  -> FastAPI Agent API
  -> report_id context loader
  -> Agent Core
  -> Mock or DeepSeek LLM client
  -> validated ResearchResponse
```

Primary directories:

- `market_news_report/`: report generation, validation, market data, media, and legacy Agent code.
- `market_news_report/agent/`: provider-neutral MarketAgent Core.
- `market_news_report/agent_api/`: FastAPI schemas, context loading, and HTTP service.
- `frontend/`: React 19 and Vite 6 application.
- `reports/`: canonical generated report data and archives.
- `site/`: Vite static build output.
- `site-agent-demo/`: independent Agent prototype project.

## 3. Report Generation Status

The daily pipeline is implemented in `market_news_report/pipeline.py` and currently performs:

1. News collection.
2. Deduplication and article enrichment.
3. LLM market summarization.
4. Source enrichment.
5. Market snapshot and trend updates.
6. News-event clustering and scoring.
7. Image enrichment.
8. Theme generation.
9. Report metadata and fallback completion.
10. Optional Chinese translation.
11. Strict market JSON validation.
12. Latest, typed, historical, and archived JSON writes.
13. MarketAgent context generation.
14. Chart, Markdown, PDF, static-site, email, and diagnostics output.

Canonical report files include:

- `reports/latest.json`
- `reports/market_analysis.json`
- `reports/premarket.json`
- `reports/close.json`
- `reports/history/*.json`
- `reports/history_index.json`

JSON persistence uses strict UTF-8 encoding, `allow_nan=False`, a JSON round trip, Unicode-tree validation, and post-write parsing. Parse, encoding, and serialization failures raise explicit errors.

## 4. Frontend Status

The active application uses hash routing from `frontend/src/App.jsx`.

| Route | Active component | Responsibility |
| --- | --- | --- |
| `#dashboard` | `DecisionDashboard.jsx` | Market decision summary and ranked signals |
| `#events` | `NewsList.jsx` | Searchable factual event feed |
| `#macro` | `MacroStrategyAnalysis.jsx` | Sell-side macro strategy brief |
| `#agent` | `MarketAgentWorkspace.jsx` | Structured equity research workspace |
| `#reports` | `ReportArchive.jsx` | Historical reports and JSON documents |

Legacy files such as `MacroAnalysis.jsx`, `MarketAgent.jsx`, and `MarketData.jsx` remain in the tree but are not the active routes.

`frontend/src/lib/useReportData.js` loads static JSON from `./data/`. It prefers `latest.json`, falls back to `market_analysis.json`, loads optional history and trend datasets, and passes the selected report into `buildPageArchitecture()`.

The Vite build writes to `site/`. The development server proxies `/api` to `http://127.0.0.1:8765`.

## 5. Shared ResearchContext Status

`frontend/src/lib/researchSchema.js` is the canonical frontend normalization layer. Its stable fields are:

```text
market_state
market_snapshot
drivers
risks
events
macro_themes
asset_view
watch_next
sources
```

It accepts current and legacy report fields, derives missing drivers and risks when possible, and returns `EMPTY_RESEARCH_CONTEXT` for missing data.

Current consumers:

- Macro Analysis receives a ViewModel derived from ResearchContext.
- MarketAgent receives ResearchContext through `agentContext.js`.
- Dashboard and Event Feed still use existing `reportDerivedData.js` models and can migrate incrementally.

`agentContext.js` is now a compatibility adapter. It preserves canonical ResearchContext fields and adds UI aliases such as `report_time`, `top_signals`, `total_events`, `dominant_theme`, and `top_sector`.

The FastAPI backend maintains a Python counterpart in `market_news_report/agent_api/context_loader.py`. The JavaScript and Python implementations target the same v1 shape but are separate implementations and may drift unless covered by shared fixtures.

## 6. Macro Analysis Status

Macro Analysis uses the following data flow:

```text
Selected report
  -> buildResearchContext(report)
  -> macroModelFromResearch(context)
  -> MacroStrategyAnalysis.jsx
```

The active page structure is:

1. Market Regime.
2. Macro Themes.
3. Asset Transmission.
4. Risk Monitor.
5. What Investors Watch Next.

The ViewModel consumes `market_state`, `drivers`, `macro_themes`, `asset_view`, `risks`, and `watch_next`. It does not call the old macro parsing helpers in `reportDerivedData.js`. `pageArchitecture.js` still imports `reportDerivedData.js` for Dashboard and Event Feed.

## 7. MarketAgent Status

Implemented frontend capabilities:

- Structured AgentRequest v1.
- Structured ResearchResponse normalization.
- Research Workspace rather than chat bubbles.
- Suggested company, sector, and macro questions.
- Session storage for the active query and result.
- Analyst View with stance, confidence, analysis type, and time horizon.
- Executive Summary, Key Drivers, Market Impact, Risk Factors, Watch Next, and Evidence Register.
- Evidence ID linking from drivers and risks.
- Structured local mock fallback.
- Context retrieval for company, sector, macro, and market-summary questions.

The retrieval layer produces:

```json
{
  "relevant_events": [],
  "relevant_drivers": [],
  "relevant_risks": [],
  "relevant_themes": [],
  "relevance_score": 0
}
```

The retrieved context is currently used by the frontend mock fallback. The FastAPI request remains the four-field AgentRequest contract and does not receive frontend context.

Implemented backend capabilities:

- Provider-neutral Agent Core.
- Compact context formatter.
- JSON-only institutional research prompt.
- Strict ResearchResponse validator.
- Mock LLM client.
- DeepSeek OpenAI-compatible client.
- Provider factory controlled by `MARKET_AGENT_PROVIDER`.
- FastAPI request and response schemas.
- Latest-report context loader.

See `docs/AGENT_ARCHITECTURE.md` for the full call chain and integration gaps.

## 8. Completed Milestones

The current code supports the following milestones:

1. News collection, deduplication, event clustering, and scoring.
2. DeepSeek-compatible structured report generation.
3. Strict JSON validation and UTF-8 persistence.
4. Pre-market, close, latest, and historical report storage.
5. Five-page Market Intelligence frontend.
6. Decision-layer Dashboard and factual Event Feed separation.
7. Frontend ResearchContext v1.
8. MarketAgent ResearchContext compatibility adapter.
9. Macro Analysis migration to ResearchContext.
10. Sell-side Macro Strategy ViewModel and presentation.
11. AgentRequest and ResearchResponse contracts.
12. Structured MarketAgent Research Workspace.
13. Structured mock response and evidence linking.
14. Frontend Context Retrieval Layer.
15. Provider-neutral Python Agent Core.
16. FastAPI Agent API and Mock integration.
17. Provider factory and DeepSeek client.
18. Static Vite and GitHub Pages output model.

## 9. Known Gaps and Risks

### 9.1 Agent API startup is split

`python main.py --agent-api` starts the legacy `ThreadingHTTPServer` in `market_news_report/market_agent.py`. That service returns `{ "answer": "string" }` and bypasses Agent Core, FastAPI, provider selection, and ResearchResponse validation.

The new service must currently be started as an ASGI app, for example:

```powershell
uvicorn market_news_report.agent_api.app:app --host 127.0.0.1 --port 8765
```

### 9.2 Retrieval is not in the real backend inference path

Frontend retrieval narrows the context for local fallback only. FastAPI loads the full normalized latest context, and `context_formatter.py` applies fixed item limits without question-aware ranking.

### 9.3 Historical Agent context is not implemented

The backend loader always reads `reports/latest.json`. It accepts `latest` or the identifier computed from that report, but cannot resolve an arbitrary historical report ID.

### 9.4 ResearchContext is implemented twice

Frontend and backend normalization may drift because JavaScript and Python maintain separate transformations.

### 9.5 DeepSeek startup configuration is eager

The FastAPI module creates its provider client during module import. Selecting `deepseek` without a valid API key prevents application startup rather than producing a request-time configuration response.

### 9.6 Generated site assets are not currently clean

At the time of this review, the working tree contained staged, unstaged, deleted, and untracked hashed build assets from different builds. `site/index.html` and the committed asset hashes must be kept synchronized before committing.

## 10. Current Git Snapshot

At the time of review:

- Branch: `codex/site-agent-demo`
- HEAD: `1ae44db` (`2.2`)
- The branch is two commits ahead of `origin/codex/v2-main` by ancestry comparison.
- No upstream was shown for `codex/site-agent-demo`.
- The working tree was not clean.
- `frontend/src/lib/agentRetrieval.js` was untracked.
- `frontend/src/lib/marketAgentClient.js` had an unstaged modification.
- MarketAgent page and CSS files had both staged and unstaged changes.
- Generated manifests and hashed `site/assets` were in a mixed staged/worktree state.

This section is intentionally a point-in-time snapshot and should be refreshed after the next commit or branch change.

## 11. Recommended Next Steps

Recommended sequence:

1. Make `main.py --agent-api` launch the FastAPI application and retire or clearly deprecate the legacy string-response server.
2. Add question-aware retrieval to the backend after context loading and before prompt construction.
3. Preserve frontend retrieval for offline mock fallback.
4. Add shared report fixtures that compare frontend and backend ResearchContext v1 output.
5. Add Agent Contract tests for all analysis types, invalid report IDs, malformed model JSON, confidence bounds, and evidence references.
6. Extend the context loader to safely resolve historical report IDs.
7. Perform a real DeepSeek end-to-end smoke test without committing credentials.
8. Add a controlled low-relevance fallback and explicit limitation messaging.
9. Reconcile staged and unstaged files, then regenerate one consistent static build.
10. Keep Dashboard, Event Feed, Macro Analysis, MarketAgent, and Reports responsibilities separate during further migration.
