# AGENTS.md

## Project Context
This project inherits product direction, engineering decisions, and design preferences from the previous CodeX US stock AI news system.

Read before working:
- `docs/project_memory.md`
- `docs/decision_log.md`

## User Preferences
- Preserve the multi-page Market Intelligence structure.
- Keep the current light Bloomberg / Financial Times style.
- Avoid card-heavy dashboard redesigns.
- Dashboard is a decision layer, not a news feed.
- Event Feed is the factual information layer.
- Macro Analysis should read like a sell-side market brief, not an event list or economics dashboard.
- Keep information density high, but do not crowd the first screen with low-value widgets.
- Use DeepSeek-compatible OpenAI API settings by default.
- Do not hard-code API keys.
- Preserve GitHub Pages static deployment compatibility.

## Development Rules
- Prefer incremental changes over full rewrites.
- Do not rewrite architecture without explaining tradeoffs.
- Do not merge pages with different responsibilities.
- Do not reintroduce the old dark-sidebar UI.
- Do not put news thumbnails on Dashboard; images belong in Event Feed.
- Keep JSON backward compatibility when changing schemas.
- Missing data must show a clear empty or fallback state, never a blank page.
- Run the frontend build after UI/data changes when possible.
- Keep auto-generated reports out of feature PRs unless the task is deployment automation.

