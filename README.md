# US Stock Daily AI News Report

一个用于生成每日美股市场 AI 新闻分析报告的工程化项目。后端负责抓取新闻、调用 DeepSeek/OpenAI 兼容接口、生成结构化 JSON/Markdown/PDF；前端提供 Bloomberg Terminal / Daily Terminal 风格的 React Dashboard。

默认本地工作目录：`E:/CodeX_File`

## Core Features

- 抓取最近 24 小时美股相关新闻。
- 支持 Yahoo Finance、CNBC、MarketWatch、Nasdaq、Google News 等来源。
- 使用 DeepSeek/OpenAI 兼容接口生成结构化市场分析。
- 通过事件聚类、来源质量、影响分、情绪分和新鲜度排序新闻。
- 输出 Markdown、JSON、PDF。
- 静态网站由 React + Vite + Tailwind CSS 构建，输出到 `site/`。
- 支持 GitHub Actions 定时自动更新，GitHub Pages 自动发布。

## Project Structure

```text
E:/CodeX_File
├─ main.py
├─ market_news_report/
│  ├─ fetchers.py
│  ├─ llm.py
│  ├─ analysis_schema.py
│  ├─ report.py
│  ├─ pdf_exporter.py
│  ├─ market_data.py
│  ├─ media.py
│  ├─ pipeline.py
│  └─ site_generator.py
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ tailwind.config.js
│  ├─ scripts/sync-report-data.mjs
│  └─ src/
├─ reports/
├─ site/
└─ .github/workflows/
```

## Local Setup

```bash
cd /d E:\CodeX_File
pip install -r requirements.txt
```

```bash
cd /d E:\CodeX_File\frontend
npm install
```

## Model Configuration

本地运行可在 `.env` 中配置：

```env
OPENAI_API_KEY=your_deepseek_api_key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

说明：

- `.env` 不应提交到 Git。
- GitHub Actions 中优先读取 GitHub Secrets / workflow 环境变量。
- 如果未配置 API Key，系统会使用 fallback 逻辑生成基础报告。

## Generate Daily Report

```bash
cd /d E:\CodeX_File
python main.py
```

每次运行会生成或更新：

```text
reports/latest.json
reports/market_analysis.json
reports/source_diagnostics.json
reports/history/YYYY-MM-DD.json
reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.md
reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.json
reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.pdf
site/
```

`latest.json` 和 `market_analysis.json` 保存最新标准 JSON；`history/YYYY-MM-DD.json` 保存每日历史快照。

## Frontend Website

开发预览：

```bash
cd /d E:\CodeX_File\frontend
npm run dev
```

构建静态网站：

```bash
cd /d E:\CodeX_File\frontend
npm run build
```

构建产物输出到：

```text
E:/CodeX_File/site/
```

前端数据读取顺序：

1. `site/data/latest.json`
2. 如果不存在，回退到 `site/data/market_analysis.json`

## Automated Deployment / 自动更新

本项目通过 GitHub Actions 实现云端自动更新，本地电脑不需要开机。

工作流文件：

```text
.github/workflows/daily-news.yml
```

自动流程：

1. 按计划或手动触发 workflow。
2. 在 GitHub Actions 的 `ubuntu-latest` 环境中安装 Python 3.11 和 Node.js 20。
3. 安装 Python 和前端依赖。
4. 运行 `python main.py` 抓取新闻、调用 DeepSeek API、生成报告 JSON/Markdown/PDF。
5. 运行 `npm run build` 构建 React 静态网站到 `site/`。
6. 自动提交并推送 `reports/` 和 `site/` 到 `main` 分支。
7. 现有 Pages workflow 会读取 `site/` 并发布网站。

默认定时：

```text
30 21 * * 1-5
```

这是 UTC 时间，约等于美股常规交易日收盘后运行。

### Required GitHub Secret

在 GitHub 仓库中配置：

```text
OPENAI_API_KEY
```

Actions 中使用的模型配置：

```text
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

### GitHub Pages Settings

推荐设置：

- Source: GitHub Actions
- 发布目录由 `.github/workflows/deploy.yml` 上传，路径为 `site/`

如果不用 Actions 发布，也可以选择从 `main` 分支的 `/site` 目录发布。

### Manual Workflow Test

手动触发方式：

1. 打开 GitHub 仓库。
2. 进入 `Actions`。
3. 选择 `Daily Market News Update`。
4. 点击 `Run workflow`。
5. 运行结束后检查 `reports/latest.json`、`reports/history/YYYY-MM-DD.json` 和 `site/data/latest.json` 是否更新。

## Stability Notes

- 单个新闻源失败不会中断整个报告生成。
- 抓取失败会记录到 `reports/source_diagnostics.json`。
- DeepSeek 主摘要调用失败时，会输出明确错误日志，并使用 fallback 逻辑生成可用报告。
- 如果没有生成内容变化，GitHub Actions 不会提交空 commit，也不会因此失败。
