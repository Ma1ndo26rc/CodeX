import { useEffect, useState } from "react";

export function useReportData() {
  const [data, setData] = useState({
    analysis: null,
    manifest: null,
    marketHistory: null,
    marketTrends: null,
    reportHistory: null,
    loading: true,
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const fetchJson = async (name) => {
          const response = await fetch(`./data/${name}.json`, { signal: controller.signal });
          if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
          return response.json();
        };
        const analysis = await fetchJson("latest").catch(() => fetchJson("market_analysis"));
        const [manifest, marketHistory, marketTrends, reportHistory] = await Promise.all([
          fetchJson("manifest"),
          fetchJson("market_history"),
          fetchJson("market_trends"),
          fetchJson("history_index").catch(() => ({ reports: [] })),
        ]);
        setData({ analysis, manifest, marketHistory, marketTrends, reportHistory, loading: false, error: "" });
      } catch (error) {
        if (error.name !== "AbortError") setData((current) => ({ ...current, loading: false, error: error.message }));
      }
    };
    load();
    return () => controller.abort();
  }, []);

  return data;
}
