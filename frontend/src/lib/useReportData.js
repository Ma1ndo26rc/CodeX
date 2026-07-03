import { useEffect, useState } from "react";

const EMPTY_HISTORY = { reports: [] };

export function useReportData() {
  const [reportSelection, setReportSelection] = useState("latest");
  const [data, setData] = useState({
    analysis: null,
    manifest: null,
    marketHistory: null,
    marketTrends: null,
    reportHistory: EMPTY_HISTORY,
    loading: true,
    reportLoading: false,
    reportError: "",
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    const fetchJson = async (name) => {
      const response = await fetch(`./data/${name}.json`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      return response.json();
    };

    const load = async () => {
      setData((current) => ({ ...current, reportLoading: true, reportError: "" }));
      try {
        const reportPromise = reportSelection === "latest"
          ? fetchJson("latest").catch(() => fetchJson("market_analysis"))
          : fetchJson(reportSelection);
        const [analysis, manifest, marketHistory, marketTrends, reportHistory] = await Promise.all([
          reportPromise,
          fetchJson("manifest").catch(() => null),
          fetchJson("market_history").catch(() => ({ updated_at: null, series: {} })),
          fetchJson("market_trends").catch(() => ({ as_of: null, series: [] })),
          fetchJson("history_index").catch(() => EMPTY_HISTORY),
        ]);
        setData({
          analysis,
          manifest,
          marketHistory,
          marketTrends,
          reportHistory,
          loading: false,
          reportLoading: false,
          reportError: "",
          error: "",
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          setData((current) => ({
            ...current,
            analysis: null,
            loading: false,
            reportLoading: false,
            reportError: error.message,
          }));
        }
      }
    };

    load();
    return () => controller.abort();
  }, [reportSelection]);

  return { ...data, reportSelection, setReportSelection };
}
