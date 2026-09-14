// Primary = Gemini 2.5 Pro (free tier, best reasoning quality, low RPD — fine for
//           single-user interview prep volume).
// Fallback = Groq (fast, so it won't also risk a Vercel timeout the way a second
//           heavy reasoning model would).
//
// Both paths force JSON output so a weaker/faster model still returns something
// the frontend can render reliably, instead of freeform text you have to parse.

const GEMINI_MODEL = "gemini-2.5-pro-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGemini(systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text);
}

async function callGroq(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no content");
  return JSON.parse(text);
}

/**
 * Tries Gemini first (quality), falls back to Groq (speed/reliability) on
 * any failure — rate limit, timeout, malformed JSON, missing key, etc.
 * Returns { data, modelUsed } so the frontend/logs can show which model graded.
 */
async function generateWithFallback(systemPrompt, userPrompt) {
  try {
    const data = await callGemini(systemPrompt, userPrompt);
    return { data, modelUsed: "gemini-2.5-pro" };
  } catch (geminiErr) {
    try {
      const data = await callGroq(systemPrompt, userPrompt);
      return { data, modelUsed: "groq-llama-3.3-70b", primaryError: String(geminiErr.message) };
    } catch (groqErr) {
      throw new Error(
        `Both models failed. Gemini: ${geminiErr.message} | Groq: ${groqErr.message}`
      );
    }
  }
}

module.exports = { generateWithFallback };
