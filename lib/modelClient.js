// High-Precision Model Client for Gemini & Groq
// Priority 1 (High-End Pro & Flagship Models): gemini-3.1-pro-preview, gemini-pro-latest, openai/gpt-oss-120b, qwen/qwen3.8-27b
// Priority 2 (Literal Last Resort Fallback): gemini-3.6-flash, gemini-3.7-flash, gemini-2.5-flash, openai/gpt-oss-20b

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanAndParseJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("AI response was empty or non-string");
  }

  let cleaned = rawText.trim();

  // Strip markdown code block wrapping if present (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Extract JSON object or array if surrounded by additional text
  const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) {
    cleaned = match[0];
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    try {
      // Attempt fallback sanitization (remove trailing commas and invalid control chars)
      const sanitized = cleaned
        .replace(/,\s*([\}\]])/g, "$1")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
      return JSON.parse(sanitized);
    } catch (secondErr) {
      console.error("[JSON Parse Failure] Raw text was:", rawText);
      throw new Error(
        `Failed to parse AI response as JSON (${err.message}). Raw output: ${rawText.slice(0, 120)}...`
      );
    }
  }
}

// ==================== GEMINI API ====================
async function callGeminiSingle(model, systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(`${url}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000), // 15s timeout for high-end reasoning models
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
    throw new Error(`Gemini (${model}) ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini (${model}) returned no content`);
  return cleanAndParseJson(text);
}

// ==================== GROQ API ====================
async function callGroqSingle(model, systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const url = "https://api.groq.com/openai/v1/chat/completions";

  // Groq requires the word 'json' in system or user prompt when response_format is json_object
  const safeSystemPrompt = systemPrompt.toLowerCase().includes("json")
    ? systemPrompt
    : `${systemPrompt}\nReturn output strictly formatted as valid JSON.`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(15000), // 15s timeout for 120B / 27B models
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: safeSystemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq (${model}) ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq (${model}) returned no content`);
  return cleanAndParseJson(text);
}


// Primary execution function: Tries High-End Pro & Flagship models FIRST
// Flash models are demoted to a LITERAL LAST RESORT
async function generateWithFallback(systemPrompt, userPrompt) {
  // 1. High-End Pro & Flagship Candidates (Tried in exact order)
  const highEndCandidates = [
    { provider: "gemini", model: "gemini-3.1-pro-preview" },
    { provider: "gemini", model: "gemini-pro-latest" },
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "groq", model: "qwen/qwen3.8-27b" },
    { provider: "groq", model: "groq/compound" },
  ];

  // 2. Literal Last Resort Flash Candidates (Tried ONLY if all Pro / 120B models fail)
  const lastResortCandidates = [
    { provider: "gemini", model: "gemini-3.6-flash" },
    { provider: "gemini", model: "gemini-3.7-flash" },
    { provider: "gemini", model: "gemini-2.5-flash" },
    { provider: "groq", model: "openai/gpt-oss-20b" },
  ];

  const allCandidates = [...highEndCandidates, ...lastResortCandidates];
  let errors = [];

  for (const candidate of allCandidates) {
    const { provider, model } = candidate;
    try {
      if (provider === "gemini" && process.env.GEMINI_API_KEY) {
        console.log(`[ModelClient] Attempting High-End model (${provider}:${model})...`);
        const data = await callGeminiSingle(model, systemPrompt, userPrompt);
        console.log(`[ModelClient] SUCCESS using ${provider}:${model}`);
        return { data, modelUsed: model };
      } else if (provider === "groq" && process.env.GROQ_API_KEY) {
        console.log(`[ModelClient] Attempting High-End model (${provider}:${model})...`);
        const data = await callGroqSingle(model, systemPrompt, userPrompt);
        console.log(`[ModelClient] SUCCESS using ${provider}:${model}`);
        return { data, modelUsed: model };
      }
    } catch (err) {
      console.log(`[ModelClient] ${provider}:${model} failed (${err.message.slice(0, 80)}). Fallback to next...`);
      errors.push(`${provider}:${model} (${err.message})`);
      // Fast fail on 404, 429 rate limits, or unsupported model -> try next candidate immediately
      continue;
    }
  }


  throw new Error(`All models failed.\nErrors:\n` + errors.join("\n"));
}

module.exports = { generateWithFallback };





