const { handlePreflight, sendJson } = require("../../lib/http");
const { DETECTION_PROMPT, buildTurnSystemPrompt } = require("../../lib/rubrics");
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

  const detectionPrompt = DETECTION_PROMPT.replace("{DESCRIPTION}", description.trim());

  try {
    // Detection call — no rubric needed yet, just classification.
    const { data: detection, modelUsed } = await generateWithFallback(
      "You are a precise classifier. Output strict JSON only.",
      detectionPrompt
    );

    const types = Array.isArray(detection.types) && detection.types.length
      ? detection.types
      : ["web_app"]; // safe default rather than failing the request
    const userContextSummary = detection.user_context_summary || description.trim().slice(0, 300);

    // Kick off the actual interview with one opening question.
    const systemPrompt = buildTurnSystemPrompt({ userContextSummary, types });
    const { data: firstTurn } = await generateWithFallback(
      systemPrompt,
      "This is the start of the interview. There is no prior answer to grade yet — just ask your first question. Set verdict-related fields to null."
    );

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
