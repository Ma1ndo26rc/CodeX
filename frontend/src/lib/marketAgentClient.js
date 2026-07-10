export async function askMarketAgent({ question, context }) {
  const prompt = String(question || "").trim();
  if (!prompt) throw new Error("Enter a market question before sending.");

  const endpoint = import.meta.env.VITE_MARKET_AGENT_API_URL || "/api/market-agent";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: prompt }),
    });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
    const payload = await response.json();
    const answer = payload.answer ?? payload.message ?? payload.output;
    if (!answer) throw new Error("API response did not contain an answer.");
    return String(answer);
  } catch (error) {
    return buildMockResponse(prompt, context, error);
  }
}

function buildMockResponse(question, context = {}, error) {
  if (!context.has_data) {
    return "Local report fallback: the Agent API is unavailable and no report data is currently loaded. Load a market report, then ask again.";
  }

  const events = context.key_events ?? [];
  const top = context.top_signals ?? events.slice(0, 3);
  const lowerQuestion = question.toLowerCase();
  const lead = top[0];
  const negative = events.filter((event) => event.sentiment_score < -0.1).slice(0, 3);
  const aiEvents = events.filter((event) => /\bai\b|openai|nvidia|semiconductor/i.test(`${event.title} ${event.summary}`));
  const watch = top.slice(0, 3).map((event) => event.title).filter(Boolean);
  const fallbackNote = error?.message ? `Local report fallback: API unavailable (${error.message}).` : "Local report fallback: API unavailable.";

  if (lowerQuestion.includes("risk")) {
    return structuredAnswer({
      note: fallbackNote,
      direct: `The biggest risks are ${titles(negative.length ? negative : top)}.`,
      drivers: context.risk_and_sentiment || "Risk is concentrated in the highest-impact negative events in the current report.",
      implication: `Market sentiment is ${context.market_sentiment}; positioning should be read as report-based context, not a buy/sell recommendation.`,
      watch: watch.length ? watch : ["market breadth", "rates", "next macro catalyst"],
    });
  }
  if (lowerQuestion.includes("sector")) {
    return structuredAnswer({
      note: fallbackNote,
      direct: `The report points to ${context.top_sector} as the highest-concentration sector exposure.`,
      drivers: `The dominant theme is ${context.dominant_theme}; the leading signal is ${lead?.title || "unavailable"}.`,
      implication: "Sector impact should be interpreted through event concentration and sentiment, not as a recommendation.",
      watch: watch.length ? watch : ["sector breadth", "earnings guidance", "rates"],
    });
  }
  if (lowerQuestion.includes("ai")) {
    return structuredAnswer({
      note: fallbackNote,
      direct: aiEvents.length
        ? `The report contains ${aiEvents.length} AI-related signal(s): ${titles(aiEvents.slice(0, 4))}.`
        : "The current report does not provide enough evidence to say AI stocks fell for a confirmed AI-specific reason.",
      drivers: aiEvents.length ? summaries(aiEvents.slice(0, 3)) : "Available context is insufficient; the fallback will not infer causes that are not in the report.",
      implication: aiEvents.length ? "AI leadership remains an important equity-market transmission channel in this report." : "Treat the AI-stock question as low confidence until the report includes clearer AI-specific evidence.",
      watch: aiEvents.length ? aiEvents.slice(0, 3).map((event) => event.title) : watch,
    });
  }
  if (lowerQuestion.includes("5-bullet") || lowerQuestion.includes("brief")) {
    return `${fallbackNote}\n\n${top.slice(0, 5).map((event, index) => `${index + 1}. ${event.title} (impact ${Math.round(event.impact_score)}, sentiment ${signed(event.sentiment_score)})`).join("\n")}`;
  }
  if (lowerQuestion.includes("watch") || lowerQuestion.includes("next")) {
    return structuredAnswer({
      note: fallbackNote,
      direct: `Investors should watch confirmation or reversal in: ${titles(top)}.`,
      drivers: context.macro_outlook || "Macro context is not available in the loaded report.",
      implication: "The next catalyst matters because it can confirm whether today's events are durable or only noise.",
      watch: watch.length ? watch : ["macro data", "policy communication", "earnings guidance"],
    });
  }
  return structuredAnswer({
    note: fallbackNote,
    direct: context.market_summary || `The dominant theme is ${context.dominant_theme}, led by ${lead?.title || "the top-ranked event"}.`,
    drivers: lead?.summary || context.risk_and_sentiment || "The report does not provide a more detailed driver explanation.",
    implication: `Top sector: ${context.top_sector}. Market sentiment: ${context.market_sentiment}.`,
    watch: watch.length ? watch : ["top events", "macro data", "earnings updates"],
  });
}

function titles(events) {
  return events.map((event) => event.title).filter(Boolean).join("; ") || "no confirmed events";
}

function summaries(events) {
  return events.map((event) => event.summary || event.title).filter(Boolean).join(" ");
}

function structuredAnswer({ note, direct, drivers, implication, watch }) {
  return [
    note,
    "",
    `Direct answer: ${direct}`,
    "",
    `Key drivers: ${drivers}`,
    "",
    `Market implication: ${implication}`,
    "",
    `What to watch next: ${(watch ?? []).filter(Boolean).join("; ") || "no specific catalyst available in the report"}.`,
  ].join("\n");
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}`;
}
