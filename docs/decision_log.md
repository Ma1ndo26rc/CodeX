# Decision Log

## 2026-06: Project Storage Convention

Decision:

- Main generated project files should live under `E:\CodeX_File`.

Reason:

- The user wanted a stable default location for generated and future project files.

Implication:

- Future agents should check whether the active workspace is the current project root before editing.
- If the active workspace is not `E:\CodeX_File`, confirm or migrate carefully.

## 2026-06: DeepSeek API Direction

Decision:

- Use DeepSeek through OpenAI-compatible API environment variables.

Required variables:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL=https://api.deepseek.com/v1`
- `OPENAI_MODEL=deepseek-chat`

Rejected:

- Hard-coded API keys.
- Frontend direct API-key usage.

## 2026-06: Structured JSON First

Decision:

- LLM should generate structured JSON, not final Markdown.
- Markdown and website rendering should read validated JSON.

Reason:

- The model sometimes returned old Markdown format and ignored new fields such as `market_impact_score`, `sentiment_score`, `why_it_matters`, and `affected_markets`.

Implementation expectation:

- Parse JSON.
- Strip code fences.
- Fill missing fields.
- Normalize types.
- Save canonical JSON before rendering.

Canonical files:

- `reports/latest.json`
- `reports/market_analysis.json`
- `reports/premarket.json`
- `reports/close.json`

## 2026-06: Reports Should Not Overwrite All History

Decision:

- Keep latest report files and historical dated files.

Report structure:

- `reports/latest.json`
- `reports/premarket.json`
- `reports/close.json`
- `reports/market_analysis.json`
- `reports/history/YYYY-MM-DD-premarket.json`
- `reports/history/YYYY-MM-DD-close.json`
- `reports/history_index.json`

Reason:

- The user requested non-overwriting reports and historical browsing.

## 2026-06: Charts Reduced in Importance

Decision:

- Charts are useful, but too many charts make reports feel less analytical and too dense visually.

Reason:

- User feedback: generated charts were too many and information density was poor.

Implication:

- Prefer richer commentary, investment explanation, and curated summary over excessive chart output.

## 2026-06: Source Quality and Event Scoring

Decision:

- News should be sorted by market importance, not crawl order.

Final Score formula:

- `0.45 * Impact Score`
- `0.20 * Macro Weight`
- `0.15 * Source Quality`
- `0.10 * Cross-source Frequency`
- `0.10 * Freshness`

Priority levels:

- Critical
- High
- Medium
- Low

Reason:

- More news should improve event recognition and ranking quality, not become a low-value feed.

## 2026-06: Event Clustering

Decision:

- Multiple articles about the same market event should merge into event cards.

Cluster criteria:

- Similar title semantics.
- Same ticker/entity.
- Same theme/sector.
- Same 24-hour window.
- Entity overlap such as OpenAI, Fed, Iran, NVIDIA, Oracle, Micron.

Reason:

- CNBC/Yahoo/MarketWatch coverage of the same event should not produce duplicate top stories.

## 2026-06: Dashboard Is a Decision Layer

Decision:

- Dashboard is not a news website and not a generic admin dashboard.

Dashboard responsibility:

- Answer: "What is happening now and should I care?"

Allowed:

- Hero.
- Market Snapshot.
- Today at a Glance.
- Top Signals.
- Lightweight Agent/Macro entry strip.

Rejected:

- Raw news feed on Dashboard.
- Macro explanations on Dashboard.
- News thumbnails on Dashboard.
- Two-column Top Signals.
- Right-side 35% panel squeezing the main reading flow.
- Excessive widgets to maximize density.

## 2026-06: Page Architecture v2

Decision:

- Preserve strict page separation.

Pages:

- Dashboard: decision layer.
- Event Feed: information layer.
- Macro Analysis: explanation layer.
- Market Agent: AI analysis workspace.
- Reports: historical layer.

Reason:

- Avoid duplication and unclear page responsibilities.

## 2026-06: Market Data Navigation Replaced

Decision:

- Replace top navigation `Market Data` with `Market Agent`.

Navigation order:

- Dashboard
- Event Feed
- Macro Analysis
- Market Agent
- Reports

Reason:

- The product direction shifted toward decision intelligence and lightweight report-based Q&A.

## 2026-06: Market Agent Scope

Decision:

- Add a lightweight Market Agent page, not a full ChatGPT clone.

Agent behavior:

- Build compact context from current report.
- Provide suggested questions.
- Use `VITE_MARKET_AGENT_API_URL` if configured.
- Fall back to context-based mock response if not configured.

Rejected:

- Putting API key in frontend.
- Generic chat-app styling.

## 2026-06: News Images

Decision:

- Images belong in Event Feed, not Dashboard.

Rules:

- Use thumbnail if valid image metadata exists.
- If image is missing, use a compact fallback.
- No broken image icons.
- No large blank placeholder.
- No repeated unrelated stock image for different stories.

Fallback priority:

1. Source logo or source initials.
2. Company/ticker badge.
3. Theme badge.
4. Generic compact NEWS badge.

## 2026-06: Translation Strategy

Decision:

- UI can follow language mode.
- News title/summary may show Chinese only when JSON contains Chinese fields.
- Do not perform frontend machine translation.

Preferred fields:

- `title_zh`
- `summary_zh`
- `translated_title`
- `translated_summary`
- `zh_title`
- `zh_summary`
- nested `translations.zh`

Do not translate:

- Source.
- Ticker.
- Company canonical name.
- URL.
- Institution names unless already translated in JSON.

## 2026-06: Page Header Sizing

Decision:

- Ordinary page titles: around 44px.
- Dashboard title: around 54px.
- Reduce excess top whitespace.

Reason:

- Macro Analysis became visually oppressive when page titles were too large.

## 2026-06: GitHub Pages Deployment Simplification

Decision:

- Remove or disable separate `deploy.yml` using `actions/deploy-pages`.
- Use `daily-news.yml` to generate reports, build `site/`, commit, and push.
- GitHub Pages serves the committed static output.

Reason:

- Avoid two competing deployment systems.

Current preferred behavior:

- `daily-news.yml` handles schedule/manual trigger.
- It commits `reports/` and `site/`.
- Pages uses static branch deployment.

## 2026-06: Auto-Generated Reports in PRs

Decision:

- Feature PRs should not include large auto-generated report conflicts.

Ignore/remove from normal PRs:

- `reports/history/`
- `reports/assets/images/`
- `reports/*.png`
- `reports/*.jpg`
- most generated JSON archives

Allow Actions to update:

- `reports/latest.json`
- `reports/market_analysis.json`
- `reports/source_diagnostics.json`
- `reports/market_history.json`
- `reports/market_snapshot.json`
- `reports/market_trends.json`

Reason:

- Avoid noisy PR conflicts from generated report data.

## 2026-06: Dual Report Mode

Decision:

- Generate both Pre-Market Brief and Market Close Brief.

Schedules:

- Pre-market: `30 12 * * 1-5` UTC.
- Market close: `0 22 * * 1-5` UTC.

Report files:

- `reports/premarket.json`
- `reports/close.json`
- `reports/latest.json`
- `reports/history/YYYY-MM-DD-premarket.json`
- `reports/history/YYYY-MM-DD-close.json`

## 2026-07: Macro Analysis V3 Direction

Decision:

- Macro Analysis should be a sell-side research brief, not an indicator dashboard.

Preferred structure:

1. Current Market Regime.
2. Today's Macro Themes.
3. Market Impact / Asset View.
4. Upcoming Catalysts / What Investors Watch Next.

Rejected:

- Macro Scorecard table as primary UI.
- Macro Drivers grid with repeated metrics.
- Arrow-based Macro Transmission flow diagrams.
- Large numbers of cards.

Reason:

- User wants something investors open daily to understand market implications, not an economics lesson.

## 2026-07: Macro Analysis V3.1 Content Direction

Decision:

- Keep Macro Analysis layout, but deepen the content.

Required content upgrades:

- Add `Key Takeaway` to Current Market Regime.
- Themes should include:
  - Current View
  - What Changed
  - Why It Matters
  - Market Impact
  - Watch Next
- Theme classification should be investment-oriented:
  - Fed Policy & Rate Path
  - Growth & Labor Market
  - AI & Technology Leadership
  - Earnings & Valuation
- Market Impact should include:
  - US Equities view and reason
  - Rates view and reason
  - Sector positive/negative impact
- Upcoming Catalysts should become:
  - Macro Data
  - Policy
  - Company Events

Prompt rule:

- Do not summarize news.
- Answer what changed, why it matters, how it affects assets, and what investors should watch next.
- Tone should be institutional equity research.

