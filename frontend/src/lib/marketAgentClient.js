import { createAgentRequest, normalizeResearchResponse } from "./marketAgentSchema.js";
import { buildMockResearchResponse } from "./mockResearchResponse.js";

export async function askMarketAgent({ question, context }) {
  const prompt = String(question || "").trim();
  if (!prompt) throw new Error("Enter a market question before sending.");

  const endpoint = import.meta.env.VITE_MARKET_AGENT_API_URL || "/api/market-agent";
  const request = createAgentRequest({ question: prompt, context });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
    const payload = await response.json();
    return normalizeResearchResponse(payload, {
      question: prompt,
      fallback: buildMockResearchResponse(prompt, context),
    });
  } catch (error) {
    return buildMockResearchResponse(prompt, context);
  }
}
