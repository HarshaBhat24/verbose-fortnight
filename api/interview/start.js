const { handlePreflight, sendJson } = require("../../lib/http");
const { buildCombinedStartPrompt } = require("../../lib/rubrics");
const { generateWithFallback } = require("../../lib/modelClient");

// POST body: { description: "I did a black-box web app pentest on..." }
// Returns:    { types, userContextSummary, firstTurn: { next_question, ... } }
//
// Stateless by design: nothing is saved server-side. The frontend must hold
// onto { types, userContextSummary } and the growing history array, and send
// them back on every call to /api/interview/turn.

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "POST only" });
  }

  const { description } = req.body || {};
  if (!description || typeof description !== "string" || description.trim().length < 10) {
    return sendJson(res, 400, { error: "Provide a 'description' of what you did (project/exp/VAPT/lab)." });
  }

  const startPrompt = buildCombinedStartPrompt(description.trim());

  try {
    // Single consolidated LLM call for classification + opening question
    const { data, modelUsed } = await generateWithFallback(
      "You are a precise cybersecurity technical interviewer. Output strict JSON only.",
      startPrompt
    );

    const types = Array.isArray(data.types) && data.types.length
      ? data.types
      : ["web_app"];
    const userContextSummary = data.userContextSummary || data.user_context_summary || description.trim().slice(0, 300);
    const firstTurn = data.firstTurn || {
      rubric_item_addressed: null,
      verdict: null,
      flagged_claim: null,
      detailed_feedback: null,
      strengths: [],
      gaps_and_omissions: [],
      what_a_strong_answer_includes: null,
      improved_answer_sample: null,
      next_question: data.next_question || "Can you walk me through your primary methodology on this target?"
    };

    return sendJson(res, 200, {
      types,
      userContextSummary,
      firstTurn,
      modelUsed,
    });
  } catch (err) {
    return sendJson(res, 502, { error: err.message });
  }
};

