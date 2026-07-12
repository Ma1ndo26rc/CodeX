# AI Market Analyst Agent Demo

独立前端原型，只读取现有 CodeX 报告数据，不修改或依赖现有页面实现。

## 数据适配

- 优先尝试读取 `../site/data/market_context.json`
- 以当前 `reports/latest.json` 的市场摘要、驱动因素、风险与宏观主题制作内置演示快照
- 后续可将 `run()` 替换为对 `VITE_MARKET_AGENT_API_URL` 的 POST 请求，保持研究报告 UI 不变

## 本地运行

```bash
npm install
npm run dev
```

该 Demo 不包含 API Key、数据库、用户系统或新的数据 pipeline。
