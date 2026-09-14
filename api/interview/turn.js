const { handlePreflight, sendJson } = require("../../lib/http");
const { buildTurnSystemPrompt } = require("../../lib/rubrics");
const { generateWithFallback } = require("../../lib/modelClient");

// POST body:
// {
//   types: ["web_app"],
//   userContextSummary: "...",
//   history: [ { question: "...", answer: "..." }, ... ],  // prior turns, for context
//   latestAnswer: "the candidate's answer to the most recent question"
// }
// Returns: { critique_and_next: {...schema from rubrics.js...}, modelUsed }
//
// Still stateless — the full history is passed in every time and used only to
// build this one prompt. Nothing is written to disk/DB.

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "POST only" });
  }

  const { types, userContextSummary, history, latestAnswer } = req.body || {};

  if (!Array.isArray(types) || !types.length) {
    return sendJson(res, 400, { error: "Missing 'types' from /start response." });
  }
  if (!userContextSummary) {
    return sendJson(res, 400, { error: "Missing 'userContextSummary' from /start response." });
  }
  if (!latestAnswer || typeof latestAnswer !== "string") {
    return sendJson(res, 400, { error: "Missing 'latestAnswer'." });
  }

  const systemPrompt = buildTurnSystemPrompt({ userContextSummary, types });

  const historyText = (history || [])
    .map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`)
    .join("\n\n");

  const userPrompt = `
PRIOR TURNS IN THIS INTERVIEW:
${historyText || "(none yet)"}

CANDIDATE'S LATEST ANSWER TO GRADE:
"""
${latestAnswer.trim()}
"""

Grade this answer per the rules and schema in your system prompt, then ask the next question.
`.trim();

  try {
    const { data, modelUsed } = await generateWithFallback(systemPrompt, userPrompt);
    return sendJson(res, 200, { result: data, modelUsed });
  } catch (err) {
    return sendJson(res, 502, { error: err.message });
  }
};
