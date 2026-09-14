// Precision Model Client for Gemini & Groq
// Primary: Gemini Pro Models (gemini-2.5-pro, gemini-3.8-pro, gemini-3.6-pro)
// Fallback: Groq Models from User's Account (openai/gpt-oss-120b, qwen/qwen3.8-27b, qwen/qwen3.6-27b, groq/compound)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== GEMINI API ====================
async function callGeminiSingle(model, systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(`${url}?key=${apiKey}`, {
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
    throw new Error(`Gemini (${model}) ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini (${model}) returned no content`);
  return JSON.parse(text);
}

async function callGeminiWithRetries(systemPrompt, userPrompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const userSpecifiedModel = process.env.GEMINI_MODEL || "gemini-2.5-pro";
  const geminiCandidates = Array.from(
    new Set([
      userSpecifiedModel,
      "gemini-3.8-pro",
      "gemini-3.7-pro",
      "gemini-3.6-pro",
      "gemini-2.5-pro",
    ])
  );

  let lastErr = null;
  for (const model of geminiCandidates) {
    const backoffs = [3000, 5000, 8000, 12000];

    for (let attempt = 0; attempt <= backoffs.length; attempt++) {
      try {
        const data = await callGeminiSingle(model, systemPrompt, userPrompt);
        return { data, modelUsed: model };
      } catch (err) {
        lastErr = err;
        const isTransient =
          err.message.includes("503") ||
          err.message.includes("429") ||
          err.message.includes("high demand") ||
          err.message.includes("UNAVAILABLE");

        if (isTransient && attempt < backoffs.length) {
          console.log(
            `[Gemini] ${model} transient error. Retrying in ${
              backoffs[attempt] / 1000
            }s...`
          );
          await sleep(backoffs[attempt]);
          continue;
        }
        break;
      }
    }
  }

  throw lastErr || new Error("All Gemini Pro models failed");
}

// ==================== GROQ API (Exact Models from User Account) ====================
async function callGroqSingle(model, systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const url = "https://api.groq.com/openai/v1/chat/completions";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
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
  return JSON.parse(text);
}

async function callGroqWithRetries(systemPrompt, userPrompt) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const userSpecifiedModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  // Exact model slugs from user's Groq dashboard
  const groqCandidates = Array.from(
    new Set([
      userSpecifiedModel,
      "openai/gpt-oss-120b",
      "qwen/qwen3.8-27b",
      "qwen/qwen3.6-27b",
      "groq/compound",
      "openai/gpt-oss-20b",
    ])
  );

  let lastErr = null;
  for (const model of groqCandidates) {
    const backoffs = [3000, 5000, 8000];

    for (let attempt = 0; attempt <= backoffs.length; attempt++) {
      try {
        const data = await callGroqSingle(model, systemPrompt, userPrompt);
        return { data, modelUsed: model };
      } catch (err) {
        lastErr = err;
        const isTransient =
          err.message.includes("503") ||
          err.message.includes("429") ||
          err.message.includes("rate_limit_exceeded");

        if (isTransient && attempt < backoffs.length) {
          console.log(
            `[Groq] ${model} transient error. Retrying in ${
              backoffs[attempt] / 1000
            }s...`
          );
          await sleep(backoffs[attempt]);
          continue;
        }

        // If 404/400 (model not found / slug mismatch), try next model in user's list
        break;
      }
    }
  }

  throw lastErr || new Error("All Groq models failed");
}

async function generateWithFallback(systemPrompt, userPrompt) {
  try {
    const result = await callGeminiWithRetries(systemPrompt, userPrompt);
    return result;
  } catch (geminiErr) {
    try {
      const result = await callGroqWithRetries(systemPrompt, userPrompt);
      return { ...result, primaryError: String(geminiErr.message) };
    } catch (groqErr) {
      throw new Error(
        `Both providers failed.\nGemini: ${geminiErr.message}\nGroq: ${groqErr.message}`
      );
    }
  }
}

module.exports = { generateWithFallback };
