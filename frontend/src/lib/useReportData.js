import analysis from "../generated/market_analysis.json";
import marketHistory from "../generated/market_history.json";
import marketTrends from "../generated/market_trends.json";
import manifest from "../generated/manifest.json";

export function useReportData() {
  return {
    analysis,
    manifest,
    marketHistory,
    marketTrends,
    loading: false,
    error: "",
  };
}
