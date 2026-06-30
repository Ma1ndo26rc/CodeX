import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(frontendRoot, "..");
const reportsDir = path.join(projectRoot, "reports");
const publicDataDir = path.join(frontendRoot, "public", "data");
const generatedDataDir = path.join(frontendRoot, "src", "generated");
const sourceAnalysisPath = path.join(reportsDir, "market_analysis.json");
const sourceLatestPath = path.join(reportsDir, "latest.json");
const sourceTrendsPath = path.join(reportsDir, "market_trends.json");
const sourceHistoryPath = path.join(reportsDir, "market_history.json");
const sourceReportHistoryDir = path.join(reportsDir, "history");
const targetAnalysisPath = path.join(publicDataDir, "market_analysis.json");
const targetLatestPath = path.join(publicDataDir, "latest.json");
const targetTrendsPath = path.join(publicDataDir, "market_trends.json");
const targetHistoryPath = path.join(publicDataDir, "market_history.json");
const targetReportHistoryDir = path.join(publicDataDir, "history");
const targetReportHistoryIndexPath = path.join(publicDataDir, "history_index.json");
const targetAssetsDir = path.join(publicDataDir, "assets");
const sourceAssetsDir = path.join(reportsDir, "assets");
const generatedAnalysisPath = path.join(generatedDataDir, "market_analysis.json");
const generatedLatestPath = path.join(generatedDataDir, "latest.json");
const generatedTrendsPath = path.join(generatedDataDir, "market_trends.json");
const generatedHistoryPath = path.join(generatedDataDir, "market_history.json");
const generatedReportHistoryIndexPath = path.join(generatedDataDir, "history_index.json");
const generatedManifestPath = path.join(generatedDataDir, "manifest.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function listLatest(ext) {
  if (!fs.existsSync(reportsDir)) return null;
  return fs
    .readdirSync(reportsDir)
    .filter((name) => name.startsWith("US_STOCK_DAILY_") && name.endsWith(ext))
    .map((name) => {
      const fullPath = path.join(reportsDir, name);
      return { name, fullPath, mtime: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime)[0] ?? null;
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  ensureDir(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function normalizeAssetPath(value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  const normalized = value.replaceAll("\\", "/");
  const marker = "reports/assets/";
  const index = normalized.indexOf(marker);
  if (index >= 0) return `data/assets/${normalized.slice(index + marker.length)}`;
  if (normalized.startsWith("assets/")) return `data/${normalized}`;
  return normalized;
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function archiveDateFromName(name) {
  const historyDate = name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
  if (historyDate) return historyDate[1];
  const dailyDate = name.match(/^US_STOCK_DAILY_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.json$/);
  if (dailyDate) return `${dailyDate[1]}-${dailyDate[2]}-${dailyDate[3]} ${dailyDate[4]}:${dailyDate[5]}:${dailyDate[6]}`;
  const analysisDate = name.match(/^market_analysis_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.json$/);
  if (analysisDate) return `${analysisDate[1]}-${analysisDate[2]}-${analysisDate[3]} ${analysisDate[4]}:${analysisDate[5]}:${analysisDate[6]}`;
  return name.replace(/\.json$/i, "");
}

function summarizeReport(filePath, name, targetName = name) {
  const report = readJsonIfExists(filePath, {});
  const events = Array.isArray(report.key_events) ? report.key_events : [];
  const newsEvents = Array.isArray(report.news_events) ? report.news_events : [];
  const date = archiveDateFromName(name);
  const topEvents = [...events, ...newsEvents]
    .filter((event) => event && event.title)
    .sort((a, b) => Number(b.final_score ?? b.market_impact_score ?? 0) - Number(a.final_score ?? a.market_impact_score ?? 0))
    .slice(0, 5)
    .map((event) => ({
      title: event.title,
      title_zh: event.translations?.zh?.title ?? "",
      sector: event.sector ?? "",
      market_impact_score: event.market_impact_score ?? 0,
      sentiment_score: event.sentiment_score ?? 0,
      final_score: event.final_score ?? event.market_impact_score ?? 0,
    }));
  return {
    date,
    file: `history/${targetName}`,
    dynamic_headline: report.dynamic_headline ?? "",
    dynamic_headline_zh: report.translations?.zh?.dynamic_headline ?? "",
    market_summary: report.market_summary ?? "",
    market_summary_zh: report.translations?.zh?.market_summary ?? "",
    event_count: events.length || newsEvents.length,
    avg_impact: topEvents.length
      ? topEvents.reduce((sum, event) => sum + Number(event.market_impact_score ?? 0), 0) / topEvents.length
      : 0,
    top_events: topEvents,
  };
}

function syncReportHistory() {
  const fallbackIndex = readJsonIfExists(generatedReportHistoryIndexPath, { reports: [] });
  const legacyReports = fs.existsSync(reportsDir)
    ? fs
        .readdirSync(reportsDir)
        .filter((name) => /^US_STOCK_DAILY_\d{8}_\d{6}\.json$/.test(name))
        .map((name) => ({ sourcePath: path.join(reportsDir, name), sourceName: name, targetName: name }))
    : [];
  const historyReports = fs.existsSync(sourceReportHistoryDir)
    ? fs
        .readdirSync(sourceReportHistoryDir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => ({ sourcePath: path.join(sourceReportHistoryDir, name), sourceName: name, targetName: name }))
    : [];
  const archiveSources = [...historyReports, ...legacyReports]
    .filter((entry, index, rows) => rows.findIndex((row) => row.targetName === entry.targetName) === index)
    .sort((a, b) => b.sourceName.localeCompare(a.sourceName));

  if (!archiveSources.length) {
    fs.writeFileSync(targetReportHistoryIndexPath, JSON.stringify(fallbackIndex, null, 2), "utf8");
    return fallbackIndex;
  }

  ensureDir(targetReportHistoryDir);
  const summaries = archiveSources
    .map(({ sourcePath, sourceName, targetName }) => {
      const targetPath = path.join(targetReportHistoryDir, targetName);
      fs.copyFileSync(sourcePath, targetPath);
      return summarizeReport(sourcePath, sourceName, targetName);
    });
  const timestampDays = new Set(
    summaries
      .filter((report) => /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(report.date))
      .map((report) => report.date.slice(0, 10)),
  );
  const reports = summaries
    .filter((report) => /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(report.date) || !timestampDays.has(report.date))
    .sort((a, b) => Date.parse(b.date.replace(" ", "T")) - Date.parse(a.date.replace(" ", "T")));
  const index = {
    generated_at: new Date().toISOString(),
    reports,
  };
  fs.writeFileSync(targetReportHistoryIndexPath, JSON.stringify(index, null, 2), "utf8");
  fs.writeFileSync(generatedReportHistoryIndexPath, JSON.stringify(index, null, 2), "utf8");
  return index;
}

ensureDir(publicDataDir);
ensureDir(generatedDataDir);
copyDir(sourceAssetsDir, targetAssetsDir);
const hasLocalReportAssets = fs.existsSync(sourceAssetsDir);

let analysis = {
  market_summary: "No report data available yet. Run python main.py to generate market_analysis.json.",
  index_performance_summary: "",
  macro_outlook: "",
  risk_and_sentiment: "",
  market_data: { items: [] },
  key_events: [],
};

analysis = readJsonIfExists(
  sourceLatestPath,
  readJsonIfExists(sourceAnalysisPath, readJsonIfExists(generatedLatestPath, readJsonIfExists(generatedAnalysisPath, analysis))),
);

analysis.key_events = (analysis.key_events ?? []).map((event) => ({
  ...event,
  image_paths: hasLocalReportAssets ? (event.image_paths ?? []).map(normalizeAssetPath) : [],
}));

fs.writeFileSync(targetAnalysisPath, JSON.stringify(analysis, null, 2), "utf8");
fs.writeFileSync(targetLatestPath, JSON.stringify(analysis, null, 2), "utf8");
fs.writeFileSync(generatedAnalysisPath, JSON.stringify(analysis, null, 2), "utf8");
fs.writeFileSync(generatedLatestPath, JSON.stringify(analysis, null, 2), "utf8");

const trends = readJsonIfExists(sourceTrendsPath, readJsonIfExists(generatedTrendsPath, { as_of: null, range: "1mo", interval: "1d", series: [] }));
const history = readJsonIfExists(sourceHistoryPath, readJsonIfExists(generatedHistoryPath, { updated_at: null, series: {} }));

fs.writeFileSync(targetTrendsPath, JSON.stringify(trends, null, 2), "utf8");
fs.writeFileSync(generatedTrendsPath, JSON.stringify(trends, null, 2), "utf8");
fs.writeFileSync(targetHistoryPath, JSON.stringify(history, null, 2), "utf8");
fs.writeFileSync(generatedHistoryPath, JSON.stringify(history, null, 2), "utf8");
const reportHistoryIndex = syncReportHistory();

const latestMarkdown = listLatest(".md");
const latestPdf = listLatest(".pdf");
const latestJson = listLatest(".json");
const manifest = {
  generated_at: new Date().toISOString(),
  reports: {
    markdown: latestMarkdown ? `../reports/${latestMarkdown.name}` : null,
    pdf: latestPdf ? `../reports/${latestPdf.name}` : null,
    json: latestJson ? `../reports/${latestJson.name}` : null,
    latest_json: "../reports/latest.json",
    standard_json: "../reports/market_analysis.json",
    history_count: reportHistoryIndex.reports?.length ?? 0,
  },
  assets: {
    market_event_overview: fs.existsSync(path.join(targetAssetsDir, "market_event_overview.png"))
      ? "data/assets/market_event_overview.png"
      : null,
  },
};
const deployManifest = fs.existsSync(reportsDir) ? manifest : readJsonIfExists(generatedManifestPath, manifest);

fs.writeFileSync(path.join(publicDataDir, "manifest.json"), JSON.stringify(deployManifest, null, 2), "utf8");
fs.writeFileSync(generatedManifestPath, JSON.stringify(deployManifest, null, 2), "utf8");

console.log(`Synced report data to ${publicDataDir}`);
