# Project Memory

## 1. Project Goal

The project is a US stock market AI news intelligence system. Its target is to generate and publish market briefs that help users understand what is moving US equities and why it matters.

The product direction has evolved from a simple RSS news summarizer into a multi-layer Market Intelligence Dashboard:

- Collect US market news from Yahoo Finance RSS, CNBC RSS, Google News keyword searches, and broader financial sources when available.
- Detect and cluster market-moving events.
- Score events by impact, sentiment, source quality, freshness, macro relevance, and cross-source confirmation.
- Generate structured JSON analysis using a DeepSeek-compatible LLM endpoint.
- Render a static website with a professional financial-terminal feel.
- Publish updated reports and site output through GitHub Actions and GitHub Pages.

The intended user experience is not "read all news." The intended experience is:

1. Quickly understand today's market regime.
2. Identify the highest-impact signals.
3. Browse factual event/news details only when needed.
4. Read macro interpretation as an investor-facing research brief.
5. Ask a lightweight Market Agent questions based on the latest report.
6. Review past reports through the archive/history system.

## 2. Technical Architecture

### Backend

Primary backend language: Python.

Core responsibilities:

- Fetch news from RSS and news search sources.
- Normalize article metadata.
- Deduplicate and cluster articles into market events.
- Score events.
- Call DeepSeek using OpenAI-compatible API settings.
- Validate LLM output into a strict JSON structure.
- Save reports into `reports/`.
- Generate chart/image/report assets where enabled.
- Support Markdown, JSON, and PDF report output.

Expected API environment variables:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

Default DeepSeek settings:

- `OPENAI_BASE_URL=https://api.deepseek.com/v1`
- `OPENAI_MODEL=deepseek-chat`

Local `.env` is allowed for development, but `.env` must not be committed.

### Frontend

Primary frontend stack:

- React
- Vite
- Tailwind CSS or project CSS utilities
- Static deployment through GitHub Pages

Current frontend direction:

- Light Bloomberg / Financial Times / institutional terminal style.
- Multi-page architecture.
- High signal-to-noise ratio.
- Decision-first Dashboard.
- Event-driven data model.

### Data Flow

Raw News -> Event Extraction -> Event Clustering -> Event Scoring -> Structured JSON -> Page Routing -> Static Site Build

Canonical report files:

- `reports/latest.json`
- `reports/premarket.json`
- `reports/close.json`
- `reports/market_analysis.json`
- `reports/source_diagnostics.json`
- `reports/history/YYYY-MM-DD-premarket.json`
- `reports/history/YYYY-MM-DD-close.json`
- `reports/history_index.json`

Static site output:

- `site/`
- root `index.html` may redirect to `site/` depending on Pages setup.

## 3. Completed Content

The prior project work completed or partially completed the following:

- Python news pipeline for daily US stock market AI reports.
- RSS/news source collection from Yahoo Finance, CNBC, Google News, and additional finance sources.
- Recent 24-hour filtering.
- LLM-based structured JSON generation.
- JSON validation and default-field repair.
- Markdown report rendering from validated JSON instead of raw model output.
- Report charts including impact, sentiment, sector distribution, and event-type distribution, though later feedback reduced emphasis on too many charts.
- SMTP email support.
- Schedule/cron support.
- Markdown-to-PDF conversion.
- News source display using actual source names instead of generic labels.
- Market data integration targets such as SPY, QQQ, VIX, and 10Y yield.
- Frontend React/Vite site.
- GitHub Pages deployment simplification.
- GitHub Actions scheduled automation for generating reports and building the static site.
- Pre-market and market-close dual report mode.
- History index for static archive browsing.
- Language toggle support.
- Chinese UI support and conditional Chinese content display from JSON translations.
- Event Feed / News List enhancements.
- Market Agent lightweight page and Dashboard entry card.
- News image fallback handling.
- Macro Analysis redesigned toward sell-side research brief style.

## 4. Current Design Preference

### Overall Visual Style

Use a light institutional market-intelligence style:

- White background.
- Subtle grid texture.
- Black bold headings.
- Orange accent.
- Clean borders.
- Minimal shadows.
- High-density but curated financial-terminal feel.

Reference feel:

- Bloomberg Terminal
- Financial Times
- Goldman Sachs / Morgan Stanley strategy brief
- Apple Stocks
- Stripe Dashboard
- Linear

Avoid:

- Generic admin dashboard templates.
- Bootstrap-like visual treatment.
- Heavy gradients.
- Thick shadows.
- Purple default AI-dashboard aesthetics.
- Old dark sidebar layout.

### Page Architecture

The application should enforce five separate page responsibilities:

1. Dashboard: decision layer.
2. Event Feed: factual information layer.
3. Macro Analysis: explanation/research layer.
4. Market Agent: lightweight AI analysis workspace.
5. Reports: historical/archive layer.

Pages should not duplicate the same analysis.

### Dashboard

Dashboard answers:

"What is happening now and should I care?"

Dashboard should include:

- Page hero: `WHAT IS HAPPENING NOW?`
- Compact premium Market Snapshot strip.
- Today at a Glance with only 4-6 meaningful metrics.
- Single-column Top Signals.
- Lightweight Market Agent and Macro Brief entry strip.

Dashboard should not include:

- Raw news feed.
- Long macro explanations.
- News thumbnails.
- Clusters as primary UI.
- Forced right-side panels that squeeze Top Signals.

### Event Feed / News Feed

Event Feed is for factual browsing:

- Chronological or score-sorted event/news list.
- Thumbnail support.
- Source, time, sector, impact, summary, original article link.
- No macro interpretation.
- No repeated `why_it_matters` content if that belongs elsewhere.

Images belong here, not on Dashboard.

### Macro Analysis

Macro Analysis should feel like a sell-side market brief.

It should answer:

1. What environment is the market in?
2. What are today's most important macro/investment themes?
3. How do those themes affect assets?
4. What should investors watch next?

Preferred Macro Analysis structure:

1. Current Market Regime.
2. Today's Macro Themes.
3. Asset / Market Impact.
4. What Investors Watch Next.

Macro Analysis should avoid:

- Too many independent cards.
- Economic-indicator dashboards.
- Arrow-flow diagrams.
- Repeating raw news summaries.
- Large scorecard tables.

Macro themes should be investment-oriented, for example:

- Fed Policy & Rate Path.
- Growth & Labor Market.
- AI & Technology Leadership.
- Earnings & Valuation.

Each theme should contain:

- Current View.
- What Changed.
- Why It Matters.
- Market Impact.
- Watch Next.

### Market Agent

Market Agent is a lightweight assistant based on current report data.

It should:

- Read a compact context derived from the latest report.
- Provide suggested questions.
- Work without exposing API keys in frontend.
- Return a mock/context-based response if no API endpoint is configured.
- Be styled like a financial intelligence workspace, not a generic chat app.

### Reports

Reports page is for:

- Downloading full reports.
- Browsing archives.
- Comparing historical brief types.
- Loading `history_index.json`.

## 5. User-Rejected Approaches

The user explicitly pushed back on the following:

- Dashboard becoming too dense with many widgets.
- Two-column Top Signals layout that squeezed reading flow.
- Right-side 35% Dashboard sidebar with Agent/Macro cards.
- Dashboard showing news thumbnails.
- Treating the app like a news website.
- Treating the app like a generic admin dashboard.
- Flat RSS-style news list as the primary homepage.
- Large numbers of charts that reduce report readability.
- Repetitive AI-generated content such as "No event summary available."
- Placeholder image logic that shows unrelated repeated images or broken/ugly image boxes.
- Source labels such as `Source 1`, `Source 2` instead of real source names.
- Macro Analysis as an economic indicator dashboard.
- Macro Analysis with many cards, scorecards, or arrow transmission diagrams.
- Macro driver cards repeating the same paragraph.
- Page headers that are too large and push content below the fold.
- Frontend hard-translation of news when no Chinese fields exist.
- Rewriting the whole UI when the request is an incremental design correction.
- Reintroducing the old dark layout.
- GitHub Pages deployment through a separate `deploy.yml` using `actions/deploy-pages` after simplifying to static branch deployment.

## 6. Key File Paths

Previously used main project root:

- `E:\CodeX_File`

Important backend paths:

- `main.py`
- `market_news_report/config.py`
- `market_news_report/fetchers.py`
- `market_news_report/processing.py`
- `market_news_report/pipeline.py`
- `market_news_report/llm.py`
- `market_news_report/analysis_schema.py`
- `market_news_report/report.py`
- `market_news_report/charts.py`
- `market_news_report/media.py`
- `market_news_report/market_data.py`
- `market_news_report/site_generator.py`

Important frontend paths:

- `frontend/package.json`
- `frontend/vite.config.js`
- `frontend/src/App.jsx`
- `frontend/src/main.jsx`
- `frontend/src/index.css`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/NewsList.jsx`
- `frontend/src/pages/MacroAnalysis.jsx`
- `frontend/src/pages/MarketAgent.jsx`
- `frontend/src/pages/Reports.jsx`
- `frontend/src/components/PageHeader.jsx`
- `frontend/src/components/EmptyState.jsx`
- `frontend/src/components/NewsThumbnail.jsx`
- `frontend/src/components/MarketTicker.jsx`
- `frontend/src/components/IndexTrendCharts.jsx`
- `frontend/src/lib/useReportData.js`
- `frontend/src/lib/reportDerivedData.js`
- `frontend/src/lib/i18n.jsx`
- `frontend/src/lib/localizedText.js`
- `frontend/src/lib/agentContext.js`
- `frontend/src/lib/marketAgentClient.js`
- `frontend/scripts/sync-report-data.mjs`

Deployment/config paths:

- `.github/workflows/daily-news.yml`
- `.gitignore`
- `.nojekyll`
- `index.html`
- `site/index.html`
- `README.md`

Report/data paths:

- `reports/latest.json`
- `reports/premarket.json`
- `reports/close.json`
- `reports/market_analysis.json`
- `reports/source_diagnostics.json`
- `reports/history_index.json`
- `reports/history/`
- `reports/assets/`

## 7. Deployment Method

Preferred deployment model:

- GitHub Actions generates data and site output.
- GitHub Pages serves static files from the repository.
- Avoid a separate Pages deploy workflow using `actions/deploy-pages`.

Current intended GitHub Actions behavior:

- Workflow file: `.github/workflows/daily-news.yml`
- Supports manual `workflow_dispatch`.
- Runs scheduled jobs on weekdays.
- Installs Python 3.11 and Node.js 20.
- Installs Python dependencies.
- Runs the Python main program to generate reports.
- Builds the frontend.
- Writes static output to `site/`.
- Commits and pushes `reports/` and `site/` updates to `main`.

Dual report schedule:

- Pre-market brief: `30 12 * * 1-5` UTC.
- Market close brief: `0 22 * * 1-5` UTC.

Report type:

- `REPORT_TYPE=premarket` for pre-market.
- `REPORT_TYPE=close` for market close.

GitHub Pages setting:

- Use static branch deployment.
- Depending on the latest setup, Pages may use `main / root` with root `index.html` redirecting to `site/`, or `main / site` if configured that way.
- The simplified direction after the latest deployment changes was `main / root` with root `index.html` redirecting to `site/`.

Required GitHub Secrets:

- `OPENAI_API_KEY`
- Optional: `PAGES_PUSH_TOKEN` if GitHub Pages needs a token-triggered push/update flow.

## 8. Follow-Up Plan

Priority next steps:

1. Complete Macro Analysis V3.1 content-depth upgrade.
2. Extend backend schema with `macro_analysis.market_regime.key_takeaway`, investment-oriented `themes`, `asset_view`, and `watch_next`.
3. Update LLM prompt so Macro Analysis is institutional equity research, not news summary.
4. Ensure old report JSON still loads with fallback fields.
5. Verify frontend build.
6. Run one dry-run report generation if API keys and network are available.
7. Confirm GitHub Actions workflow still commits only intended generated data.
8. Confirm GitHub Pages loads the built site rather than README.
9. Improve report history browsing if archive UX needs refinement.
10. Add a backend Market Agent endpoint later if the lightweight frontend mock needs real LLM Q&A.

