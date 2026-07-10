import { Bitcoin, Bot, BriefcaseBusiness, Cpu, Factory, Flame, Landmark, Newspaper, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

const SOURCE_BRANDS = [
  ["reuters", "Reuters", "R", "#f26f21"],
  ["cnbc", "CNBC", "C", "#005594"],
  ["bloomberg", "Bloomberg", "B", "#111111"],
  ["yahoo", "Yahoo Finance", "Y", "#6001d2"],
  ["marketwatch", "MarketWatch", "M", "#0b6e4f"],
  ["barron", "Barron's", "B", "#b21f2d"],
  ["wall street journal", "WSJ", "W", "#333333"],
  ["wsj", "WSJ", "W", "#333333"],
  ["marketbeat", "MarketBeat", "M", "#176b87"],
];

const THEMES = [
  [/fed|rate|policy/i, "FED", Landmark],
  [/inflation|cpi/i, "INFLATION", TrendingUp],
  [/labor|jobs|payroll|nfp/i, "LABOR", BriefcaseBusiness],
  [/semiconductor|chip/i, "CHIPS", Cpu],
  [/\bai\b|artificial intelligence/i, "AI", Bot],
  [/crypto|bitcoin/i, "CRYPTO", Bitcoin],
  [/energy|oil|gas/i, "ENERGY", Flame],
  [/technology|tech/i, "TECH", Cpu],
  [/company|earnings|corporate/i, "COMPANY", Factory],
  [/macro/i, "MACRO", TrendingUp],
];

export default function NewsThumbnail({ item, src, alt = "", source, ticker, sector, category, eventType, suppressImage = false }) {
  const imageUrl = suppressImage ? "" : imageFrom(item) || stringValue(src);
  const sourceName = sourceValue(source ?? item?.primary_source ?? item?.source ?? item?.publisher);
  const tickerValue = stringValue(ticker ?? item?.ticker ?? item?.symbol ?? item?.tickers?.[0] ?? item?.related_tickers?.[0]);
  const themeText = [sector, category, eventType, item?.sector, item?.category, item?.event_type].filter(Boolean).join(" ");
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [imageUrl]);

  return (
    <div className={`pa-news-thumbnail ${!imageUrl || failed ? "is-placeholder" : ""}`}>
      {imageUrl && !failed
        ? <img src={imageUrl} alt={alt} loading="lazy" onError={() => setFailed(true)} />
        : <ThumbnailFallback source={sourceName} ticker={tickerValue} themeText={themeText} />}
    </div>
  );
}

function ThumbnailFallback({ source, ticker, themeText }) {
  if (source) {
    const brand = SOURCE_BRANDS.find(([key]) => source.toLowerCase().includes(key));
    const [, label, initial, color] = brand ?? ["", source, source[0]?.toUpperCase() || "N", "#647076"];
    return <div className="thumbnail-brand" style={{ "--thumbnail-brand": color }}><b>{initial}</b><span>{label}</span></div>;
  }
  if (ticker) return <div className="thumbnail-ticker"><b>{ticker.slice(0, 6).toUpperCase()}</b><span>TICKER</span></div>;
  const theme = THEMES.find(([pattern]) => pattern.test(themeText));
  if (theme) {
    const [, label, Icon] = theme;
    return <div className="thumbnail-theme"><Icon size={16} /><span>{label}</span></div>;
  }
  return <div className="thumbnail-generic"><Newspaper size={16} /><span>NEWS</span></div>;
}

function imageFrom(item) {
  if (!item || typeof item !== "object") return "";
  for (const field of ["image", "image_url", "thumbnail", "thumbnail_url", "urlToImage", "media_url", "og_image"]) {
    const value = item[field];
    const result = typeof value === "object" && value ? stringValue(value.url ?? value.src) : stringValue(value);
    if (result) return result;
  }
  for (const field of ["image_urls", "image_paths", "images"]) {
    const value = Array.isArray(item[field]) ? item[field][0] : item[field];
    const result = typeof value === "object" && value ? stringValue(value.url ?? value.src) : stringValue(value);
    if (result) return result;
  }
  return "";
}

function sourceValue(value) {
  if (value && typeof value === "object") return stringValue(value.name ?? value.title ?? value.publisher ?? value.label);
  const result = stringValue(value);
  return result === "[object Object]" ? "" : result;
}

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}
