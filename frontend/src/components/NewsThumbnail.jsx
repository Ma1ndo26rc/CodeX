import { Newspaper } from "lucide-react";
import { useEffect, useState } from "react";

export default function NewsThumbnail({ src, alt = "", source = "" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <div className={`pa-news-thumbnail ${!src || failed ? "is-placeholder" : ""}`}>
      {src && !failed
        ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
        : <div className="pa-thumbnail-fallback"><span>{sourceInitial(source)}</span><Newspaper size={14} aria-hidden="true" /><small>No image</small></div>}
    </div>
  );
}

function sourceInitial(source) {
  const value = String(source || "").trim();
  return value ? value[0].toUpperCase() : "M";
}
