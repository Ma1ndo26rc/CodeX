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
const sourceTrendsPath = path.join(reportsDir, "market_trends.json");
const sourceHistoryPath = path.join(reportsDir, "market_history.json");
const targetAnalysisPath = path.join(publicDataDir, "market_analysis.json");
const targetTrendsPath = path.join(publicDataDir, "market_trends.json");
const targetHistoryPath = path.join(publicDataDir, "market_history.json");
const targetAssetsDir = path.join(publicDataDir, "assets");
const sourceAssetsDir = path.join(reportsDir, "assets");
const generatedAnalysisPath = path.join(generatedDataDir, "market_analysis.json");
const generatedTrendsPath = path.join(generatedDataDir, "market_trends.json");
const generatedHistoryPath = path.join(generatedDataDir, "market_history.json");
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

analysis = readJsonIfExists(sourceAnalysisPath, readJsonIfExists(generatedAnalysisPath, analysis));

analysis.key_events = (analysis.key_events ?? []).map((event) => ({
  ...event,
  image_paths: hasLocalReportAssets ? (event.image_paths ?? []).map(normalizeAssetPath) : [],
}));

fs.writeFileSync(targetAnalysisPath, JSON.stringify(analysis, null, 2), "utf8");
fs.writeFileSync(generatedAnalysisPath, JSON.stringify(analysis, null, 2), "utf8");

const trends = readJsonIfExists(sourceTrendsPath, readJsonIfExists(generatedTrendsPath, { as_of: null, range: "1mo", interval: "1d", series: [] }));
const history = readJsonIfExists(sourceHistoryPath, readJsonIfExists(generatedHistoryPath, { updated_at: null, series: {} }));

fs.writeFileSync(targetTrendsPath, JSON.stringify(trends, null, 2), "utf8");
fs.writeFileSync(generatedTrendsPath, JSON.stringify(trends, null, 2), "utf8");
fs.writeFileSync(targetHistoryPath, JSON.stringify(history, null, 2), "utf8");
fs.writeFileSync(generatedHistoryPath, JSON.stringify(history, null, 2), "utf8");

const latestMarkdown = listLatest(".md");
const latestPdf = listLatest(".pdf");
const latestJson = listLatest(".json");
const manifest = {
  generated_at: new Date().toISOString(),
  reports: {
    markdown: latestMarkdown ? `../reports/${latestMarkdown.name}` : null,
    pdf: latestPdf ? `../reports/${latestPdf.name}` : null,
    json: latestJson ? `../reports/${latestJson.name}` : null,
    standard_json: "../reports/market_analysis.json",
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
