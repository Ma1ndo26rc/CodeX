import { useEffect, useState } from "react";

export function useReportData() {
  const [data, setData] = useState({ analysis: null, manifest: null, marketHistory: null, marketTrends: null, loading: true, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const names = ["market_analysis", "manifest", "market_history", "market_trends"];
        const responses = await Promise.all(names.map((name) => fetch(`./data/${name}.json`, { signal: controller.signal })));
        const failed = responses.find((response) => !response.ok);
        if (failed) throw new Error(`HTTP ${failed.status}`);
        const [analysis, manifest, marketHistory, marketTrends] = await Promise.all(responses.map((response) => response.json()));
        setData({ analysis, manifest, marketHistory, marketTrends, loading: false, error: "" });
      } catch (error) {
        if (error.name !== "AbortError") setData((current) => ({ ...current, loading: false, error: error.message }));
      }
    };
    load();
    return () => controller.abort();
  }, []);

  return data;
}
