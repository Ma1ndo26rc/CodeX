# US Stock Daily AI News Report

这是一个面向美股市场的每日新闻自动化系统，输出 Markdown + JSON 双格式日报。

默认工作目录和默认报告输出目录都指向 `E:/CodeX_File`。

## 功能

- 抓取最近 24 小时新闻
- 数据源：Yahoo Finance RSS、CNBC RSS、Google News RSS
- 去重、分类、情绪分析
- LLM 可选增强总结
- 输出日报文件：`US_STOCK_DAILY_YYYYMMDD.md` 和同名 JSON
- 支持 SMTP 邮件发送
- 支持定时任务

## 目录结构

```text
E:/CodeX_File/
  main.py
  run_daily.cmd
  requirements.txt
  .env.example
  README.md
  market_news_report/
    config.py
    emailer.py
    fetchers.py
    llm.py
    models.py
    pipeline.py
    processing.py
    report.py
    scheduler.py
```

## 使用

1. 安装依赖

```bash
pip install -r requirements.txt
```

2. 配置环境变量

把 `.env.example` 复制成 `.env`，然后填写密钥和邮箱信息。

3. 单次运行

```bash
python main.py
```

默认报告会输出到 `E:/CodeX_File/reports`。

4. 定时运行

```bash
python main.py --schedule --hour 8 --minute 0
```

或者直接双击 `run_daily.cmd` 作为快捷入口。

## 说明

- 如果未配置 `OPENAI_API_KEY`，系统会使用本地规则和简单统计生成报告。
- 目前 `Index Performance Summary` 还是预留位，后续可以接真实行情 API。
