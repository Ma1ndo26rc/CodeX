export async function askMarketAgent({ question, context }) {
  const prompt = String(question || "").trim();
  if (!prompt) throw new Error("Enter a market question before sending.");

  const endpoint = import.meta.env.VITE_MARKET_AGENT_API_URL;
  if (!endpoint) return buildMockResponse(prompt, context);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: prompt, context }),
    });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
    const payload = await response.json();
    const answer = payload.answer ?? payload.message ?? payload.output;
    if (!answer) throw new Error("API response did not contain an answer.");
    return String(answer);
  } catch (error) {
    throw new Error(`Market Agent request failed: ${error.message}`);
  }
}

function buildMockResponse(question, context = {}) {
  if (!context.has_data) {
    return "Agent API is not configured and no report data is currently available. Generate or load a market report, then ask again.";
  }

  const events = context.key_events ?? [];
  const top = context.top_signals ?? events.slice(0, 3);
  const lowerQuestion = question.toLowerCase();
  const lead = top[0];
  const negative = events.filter((event) => event.sentiment_score < -0.1).slice(0, 3);
  const aiEvents = events.filter((event) => /\bai\b|openai|nvidia|semiconductor/i.test(`${event.title} ${event.summary}`));

  if (lowerQuestion.includes("risk")) {
    return `Agent API is not configured yet. Based on the current report, market sentiment is ${context.market_sentiment}. ${context.risk_and_sentiment || "Risk is concentrated in the highest-impact negative events."} Key downside signals include ${titles(negative.length ? negative : top)}.`;
  }
  if (lowerQuestion.includes("sector")) {
    return `Agent API is not configured yet. The highest event concentration is in ${context.top_sector}. The dominant theme is ${context.dominant_theme}, with the leading signal being ${lead?.title || "unavailable"}.`;
  }
  if (lowerQuestion.includes("ai")) {
    return `Agent API is not configured yet. ${aiEvents.length ? `The report contains ${aiEvents.length} AI-related signals: ${titles(aiEvents.slice(0, 4))}.` : "The current top events do not contain a strongly confirmed AI-specific signal."}`;
  }
  if (lowerQuestion.includes("5-bullet") || lowerQuestion.includes("brief")) {
    return top.slice(0, 5).map((event, index) => `${index + 1}. ${event.title} (impact ${Math.round(event.impact_score)}, sentiment ${signed(event.sentiment_score)})`).join("\n");
  }
  if (lowerQuestion.includes("watch") || lowerQuestion.includes("next")) {
    return `Agent API is not configured yet. Watch for confirmation or reversal in these high-impact events: ${titles(top)}. Current macro context: ${context.macro_outlook || "not available"}`;
  }
  return `Agent API is not configured yet. Based on the current report, the dominant theme is ${context.dominant_theme}, the top sector is ${context.top_sector}, and the leading signal is ${lead?.title || "unavailable"}. ${lead?.summary || context.market_summary || "No additional summary is available."}`;
}

function titles(events) {
  return events.map((event) => event.title).filter(Boolean).join("; ") || "no confirmed events";
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}`;
}
