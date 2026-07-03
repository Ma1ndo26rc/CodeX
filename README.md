# US Stock Daily AI News Report

一个自动生成每日美股市场情报的工程化项目。后端抓取并聚合新闻，调用 DeepSeek/OpenAI 兼容接口生成结构化分析；前端使用 React、Vite 和 Tailwind CSS 提供 Bloomberg Terminal / Daily Terminal 风格的网站。

默认本地目录：`E:/CodeX_File`

## Core Features

- 抓取最近 24 小时的美股相关新闻。
- 支持 Yahoo Finance、CNBC、MarketWatch、Nasdaq、Google News 等来源。
- 使用事件聚类、来源质量、影响分、情绪分和新鲜度进行排序。
- 使用 DeepSeek/OpenAI 兼容接口生成结构化市场分析。
- 输出 JSON、Markdown 和 PDF 报告。
- 提供中英文切换、市场数据、新闻列表和往期报告页面。
- 通过 GitHub Actions 定时生成报告并更新静态网站。

## Project Structure

```text
E:/CodeX_File
|-- main.py
|-- market_news_report/
|-- frontend/
|   |-- package.json
|   |-- vite.config.js
|   |-- scripts/sync-report-data.mjs
|   `-- src/
|-- reports/
|   |-- latest.json
|   |-- market_analysis.json
|   |-- source_diagnostics.json
|   `-- history/
|-- site/
|-- index.html
`-- .github/workflows/daily-news.yml
```

## Local Setup

```powershell
cd E:\CodeX_File
pip install -r requirements.txt

cd E:\CodeX_File\frontend
npm install
```

## Model Configuration

本地运行可在 `.env` 中配置：

```env
OPENAI_API_KEY=your_deepseek_api_key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

`.env` 不应提交到 Git。GitHub Actions 从 GitHub Secrets 和 workflow 环境变量读取配置。

## Generate Daily Report

```powershell
cd E:\CodeX_File
python main.py
```

主要输出：

```text
reports/latest.json
reports/market_analysis.json
reports/source_diagnostics.json
reports/market_history.json
reports/market_snapshot.json
reports/market_trends.json
reports/history/YYYY-MM-DD.json
reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.md
reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.json
reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.pdf
```

## Frontend Website

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

Vite 的构建产物固定输出到仓库根目录的 `site/`，其中包含 `site/index.html`、静态资源和报告数据。

## Automated Deployment / 自动更新

项目只保留一个自动化工作流：

```text
.github/workflows/daily-news.yml
```

该工作流负责：

1. 每周一至周五在 `21:30 UTC` 定时运行，也支持手动触发。
2. 安装 Python 3.11、Node.js 20 以及项目依赖。
3. 运行 `python main.py`，更新 `reports/`。
4. 运行 `npm run build`，将前端构建到 `site/`。
5. 验证 `site/index.html` 存在。
6. 提交指定报告、`reports/history/` 和整个 `site/` 到 `main`。

旧的 `.github/workflows/deploy.yml` 已删除。项目不再使用 `actions/upload-pages-artifact` 或 `actions/deploy-pages`。

### Required GitHub Secrets

在 `Settings -> Secrets and variables -> Actions` 中配置：

```text
OPENAI_API_KEY
PAGES_PUSH_TOKEN
```

- `OPENAI_API_KEY`：DeepSeek API Key。
- `PAGES_PUSH_TOKEN`：具有该仓库 `Contents: Read and write` 权限的 fine-grained personal access token。

`PAGES_PUSH_TOKEN` 很重要：GitHub 官方说明，由 workflow 使用内置 `GITHUB_TOKEN` 推送的提交不会触发分支型 Pages 构建。配置 PAT 后，`daily-news.yml` 的推送才能可靠触发 Pages 更新。未配置时 workflow 会回退到 `GITHUB_TOKEN`，报告仍可提交，但 Pages 可能不会自动刷新。

### GitHub Pages Settings

GitHub Pages 的分支发布目录只支持 `/ (root)` 或 `/docs`，不能直接选择 `/site`。本项目保留根目录 `index.html`，它会跳转到 `site/`，因此请设置为：

```text
Settings -> Pages
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

保存后，访问仓库的 Pages 地址会由根入口自动进入 `site/`。根目录 `.nojekyll` 用于关闭 Jekyll 处理。

### Manual Workflow Test

1. 打开 GitHub 仓库的 `Actions` 页面。
2. 选择 `Daily Market News Update`。
3. 点击 `Run workflow`，分支选择 `main`。
4. 等待任务完成，确认产生 `auto: update market news report` 提交。
5. 检查 `reports/latest.json`、`reports/history/YYYY-MM-DD.json` 和 `site/index.html` 是否更新。
6. 等待 GitHub Pages 的分支发布任务完成后刷新网站。

## Stability Notes

- 单个新闻源失败不会中断整个报告生成。
- 抓取结果和错误会记录到 `reports/source_diagnostics.json`。
- LLM 调用失败时会输出明确日志，并使用 fallback 逻辑生成基础报告。
- 没有文件变化时，workflow 不会创建空提交。
- 普通功能分支默认忽略自动生成的历史报告和图片；`daily-news.yml` 会显式提交需要保留的历史数据。
