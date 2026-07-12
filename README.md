# CodeX v2 — AI-powered Equity Research Platform

CodeX v2 是一个面向美股研究的 AI Market Intelligence 与 Equity Research 平台。系统将新闻采集、事件聚类、市场数据、结构化 LLM 分析和专业研究界面组合成一套可自动生成、验证并发布的市场研究工作流。

产品目标不是展示尽可能多的新闻，而是帮助用户快速回答：

- 当前市场环境是什么？
- 哪些事件真正影响美股？
- 宏观变化如何传导到资产和行业？
- 针对公司、行业或宏观问题，研究结论和证据是什么？

## v2 产品架构

前端保留五个职责明确的页面：

### Dashboard

Dashboard 是市场决策层，回答“现在发生了什么，是否值得关注”。

主要展示：

- Market Snapshot
- Today at a Glance
- 按决策相关性排序的 Top Signals
- 市场叙事和关键驱动因素
- Macro Strategy 与 MarketAgent 入口

Dashboard 不承担新闻流或长篇宏观解释职责。

### Event Feed

Event Feed 是事实信息层，用于浏览和检索当前报告中的市场事件。

支持：

- 标题、摘要、来源、Ticker、行业和主题搜索
- 行业、主题、来源、情绪和影响等级筛选
- 新闻来源、发布时间和原文链接
- 从具体事件进入 MarketAgent 研究

### Macro Strategy Analysis

Macro Strategy Analysis 是 sell-side 风格的宏观策略研究页，重点解释市场环境及资产传导，而不是罗列经济指标。

当前结构：

1. Market Regime
2. Macro Themes
3. Asset Transmission
4. Risk Monitor
5. What Investors Watch Next

### MarketAgent

MarketAgent 是 AI Equity Research Workspace，不是聊天机器人。

用户可以提出公司、行业、宏观或市场总结问题，系统以结构化研究报告形式返回：

- Analyst View：Stance、Confidence、Analysis Type、Time Horizon
- Executive Summary
- Key Drivers
- Market Impact
- Risk Factors
- What To Watch
- Evidence Register
- Limitations

MarketAgent 支持建议问题、sessionStorage、前端相关性检索、结构化 mock fallback 和真实后端 API。

### Reports

Reports 页面用于浏览历史报告、报告类型、事件数量、平均影响分数和原始 JSON 文档。

## ResearchContext

`frontend/src/lib/researchSchema.js` 将当前及旧版报告数据转换为统一 ResearchContext v1：

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

当前使用关系：

- Macro Strategy Analysis 使用 ResearchContext 派生页面 ViewModel。
- MarketAgent 通过兼容 adapter 使用 ResearchContext。
- Dashboard 和 Event Feed 保留现有派生模型，可逐步迁移。
- 缺失数据返回完整的 `EMPTY_RESEARCH_CONTEXT`，避免空白页面。

## MarketAgent Backend

MarketAgent 后端分为 FastAPI、Agent Core 和 Provider 三层：

```text
Frontend AgentRequest
  -> FastAPI /api/market-agent
  -> report_id Context Loader
  -> Agent Core
  -> Mock or DeepSeek Provider
  -> ResearchResponse Validator
  -> Structured ResearchResponse
```

### AgentRequest v1

```json
{
  "question": "Why did NVIDIA fall today?",
  "report_id": "latest",
  "analysis_type": "company",
  "context_version": "v1"
}
```

支持的 `analysis_type`：

- `company`
- `sector`
- `macro`
- `market_summary`

### FastAPI Agent

FastAPI 应用位于：

```text
market_news_report/agent_api/app.py
```

本地启动结构化 Agent API：

```powershell
cd E:\CodeX_File
$env:MARKET_AGENT_PROVIDER="mock"
uvicorn market_news_report.agent_api.app:app --host 127.0.0.1 --port 8765
```

接口：

```text
GET  /health
POST /api/market-agent
```

开发环境中，Vite 将 `/api` 代理到 `http://127.0.0.1:8765`。

`python main.py --agent-api` 作为 deprecated 兼容别名保留，但现在会转发到同一个 FastAPI ASGI 应用，并输出迁移提示。新脚本和部署配置应直接使用上面的 uvicorn 命令：

```powershell
python main.py --agent-api --agent-host 127.0.0.1 --agent-port 8765
```

旧版 `ThreadingHTTPServer` 实现仍保留在代码库中用于兼容审计，但不再由 `main.py --agent-api` 启动。

### Agent Core

`market_news_report/agent/` 提供与 HTTP 和模型供应商无关的核心流程：

- 校验 AgentRequest
- 压缩 MarketResearchContext
- 构造 JSON-only research prompt
- 调用 `LLMClient.generate(prompt)`
- 验证 ResearchResponse JSON
- 返回明确的 Provider、解析和验证错误

### DeepSeek Provider

真实模型客户端使用 DeepSeek OpenAI-compatible API。Agent Service 不依赖 DeepSeek SDK 细节。

配置：

```env
MARKET_AGENT_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_SECONDS=30
```

默认 Provider 是 `mock`，可在没有真实 API Key 的情况下验证完整 FastAPI 调用链。

## 报告生成 Pipeline

主流程位于 `market_news_report/pipeline.py`：

```text
新闻抓取
  -> 去重和标准化
  -> 事件聚类与评分
  -> 市场数据
  -> DeepSeek-compatible 结构化分析
  -> JSON Schema 与 UTF-8 校验
  -> latest / premarket / close / history
  -> Markdown / PDF / 静态网站
```

主要报告文件：

```text
reports/latest.json
reports/premarket.json
reports/close.json
reports/market_analysis.json
reports/source_diagnostics.json
reports/history_index.json
reports/history/
```

报告 JSON 在写入前后执行严格校验，包括 JSON parse、UTF-8 编码、Unicode 字符检查和序列化 round trip。

## 项目结构

```text
E:/CodeX_File
|-- main.py
|-- market_news_report/
|   |-- agent/
|   `-- agent_api/
|-- frontend/
|   |-- scripts/sync-report-data.mjs
|   `-- src/
|-- reports/
|-- site/
|-- docs/
|-- tests/
`-- .github/workflows/daily-news.yml
```

## 本地安装

需要：

- Python 3.11+
- Node.js 20+

安装 Python 依赖：

```powershell
cd E:\CodeX_File
python -m pip install -r requirements.txt
```

安装前端依赖：

```powershell
cd E:\CodeX_File\frontend
npm install
```

## 环境配置

复制 `.env.example` 为本地 `.env`，不要提交 `.env` 或真实 API Key。

报告生成使用 OpenAI-compatible 配置：

```env
OPENAI_API_KEY=your_deepseek_api_key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

MarketAgent Provider 使用独立配置：

```env
MARKET_AGENT_PROVIDER=mock
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_SECONDS=30
```

## 生成市场报告

```powershell
cd E:\CodeX_File
python main.py --report-type premarket
python main.py --report-type close
```

## 前端开发与构建

开发预览：

```powershell
cd E:\CodeX_File\frontend
npm run dev
```

生产构建：

```powershell
cd E:\CodeX_File\frontend
npm run build
```

构建流程会先将 `reports/` 同步到前端静态数据目录，再将 Vite 输出写入 `site/`。

## 发布前验证

前端：

```powershell
cd E:\CodeX_File\frontend
npm ci
npm run build
```

Python：

```powershell
cd E:\CodeX_File
python -m unittest discover -s tests -p "test_*.py"
python -m compileall -q main.py market_news_report tests
```

Agent API：

```powershell
$env:MARKET_AGENT_PROVIDER="mock"
uvicorn market_news_report.agent_api.app:app --host 127.0.0.1 --port 8765
```

至少验证 `/health` 和四种 `analysis_type` 的 `/api/market-agent` 请求。

## 自动化与 GitHub Pages

`.github/workflows/daily-news.yml` 在工作日生成盘前和收盘报告、构建 `site/`，并提交受控的报告和静态站点文件。

GitHub Pages 当前使用分支静态部署：

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

根目录 `index.html` 负责进入 `site/`，`.nojekyll` 用于关闭 Jekyll 处理。

## 文档

- `docs/PROJECT_STATUS.md`：当前项目状态、里程碑和已知缺口。
- `docs/AGENT_ARCHITECTURE.md`：MarketAgent 完整调用链与 Contract。
- `docs/project_memory.md`：产品方向与长期背景。
- `docs/decision_log.md`：重要产品和工程决策。

## 安全原则

- 不在前端保存 API Key。
- 不提交 `.env`。
- 不在代码中硬编码 DeepSeek Key。
- LLM 输出必须通过 JSON 与 ResearchResponse 验证。
- 缺少证据时降低置信度并返回 limitations。
- MarketAgent 输出是研究辅助信息，不构成投资建议。
