# US Stock Daily AI News Report

一个用于生成“每日美股市场 AI 新闻分析报告”的工程化项目。后端负责抓取新闻、调用 DeepSeek/OpenAI 兼容模型、生成 Markdown/JSON/PDF；前端提供一个类似 Bloomberg Terminal 风格的 React Dashboard。

默认工作目录：`E:/CodeX_File`

## 核心能力

- 抓取最近 24 小时美股相关新闻。
- 支持 Yahoo Finance、CNBC、MarketWatch、Nasdaq、Google News 等来源。
- 使用 DeepSeek/OpenAI 兼容接口生成结构化 JSON 分析。
- 标准分析文件固定输出到 `reports/market_analysis.json`。
- 自动保存历史 Markdown、JSON、PDF，不覆盖旧日报。
- 抓取实时市场快照：`SPY`、`QQQ`、`VIX`、`10Y Yield`。
- 报告展示真实新闻来源名称，例如 Reuters、CNBC、Yahoo Finance。
- 图片只绑定匹配到的原新闻缩略图，匹配不到就不展示。
- 报告按 `Macro / Market / Company` 三层组织关键事件。
- 支持 SMTP 邮件发送。
- 支持定时任务。
- 支持 React + Vite + Tailwind CSS 小网站。

## 项目结构

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
└─ site/
```

## Python 依赖

```bash
cd /d E:\CodeX_File
pip install -r requirements.txt
```

## 模型配置

DeepSeek 示例：

```env
OPENAI_API_KEY=你的 DeepSeek API Key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

可选超时配置：

```env
FETCH_TIMEOUT_SECONDS=12
MARKET_DATA_TIMEOUT_SECONDS=12
```

如果不配置 API Key，系统会使用本地规则生成基础分析报告。

## 生成日报

```bash
cd /d E:\CodeX_File
python main.py
```

每次运行会生成：

- `reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.md`
- `reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.json`
- `reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.pdf`
- `reports/market_analysis.json`
- `reports/market_analysis_YYYYMMDD_HHMMSS.json`
- `reports/source_diagnostics.json`

## 转换 PDF

```bash
python main.py --pdf reports/US_STOCK_DAILY_YYYYMMDD_HHMMSS.md
```

## React 网站

前端技术栈：

- React
- Vite
- Tailwind CSS
- 深色/浅色模式
- 响应式布局
- Bloomberg Terminal 风格信息面板

安装前端依赖：

```bash
cd /d E:\CodeX_File\frontend
npm install
```

开发预览：

```bash
npm run dev
```

构建静态网站：

```bash
npm run build
```

构建结果会输出到：

```text
E:/CodeX_File/site/index.html
```

也可以从 Python 入口生成网站：

```bash
cd /d E:\CodeX_File
python main.py --site
```

说明：`npm run build` 会先执行 `scripts/sync-report-data.mjs`，把最新 `reports/market_analysis.json` 写入前端生成数据，并复制图表/图片到静态资源目录，再构建页面。由于 Chrome 会限制本地 `file://` 页面加载 ES Module，推荐通过本地服务打开：

```bash
run_site.cmd
```

或者手动运行：

```bash
cd /d E:\CodeX_File\frontend
npm run preview -- --host 127.0.0.1 --port 4173
```

## 网站页面

- `Dashboard`：市场摘要、实时行情、关键事件矩阵、下载入口。
- `News List`：新闻事件列表，支持搜索和 Macro/Market/Company 过滤。
- `Macro Analysis`：宏观、市场、公司三层拆分。
- `Market Data`：SPY、QQQ、VIX、10Y Yield 快照和事件影响矩阵。

## 定时任务

```bash
python main.py --schedule --hour 8 --minute 0
```

## 输出逻辑

- 历史日报不会被覆盖。
- `reports/market_analysis.json` 始终保存最新标准 JSON，方便 Markdown、PDF、React 网站读取。
- React 构建产物输出到 `site/`，可直接双击打开 `site/index.html`。
