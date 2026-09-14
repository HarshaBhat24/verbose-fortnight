// Resilient Multi-Provider & Multi-Model Client
// Gemini Primary: High quality models (gemini-3.8-flash, gemini-3.6-flash, gemini-2.5-pro, gemini-2.5-flash)
// Groq Secondary: Active Groq models (llama-3.3-70b-versatile, llama-3.1-8b-instant, deepseek-r1-distill-llama-70b, qwen-2.5-coder-32b)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function callGeminiWithFallbacks(systemPrompt, userPrompt) {
  const userSpecifiedModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  // Strict high quality candidates down to gemini-2.5-flash as the minimum floor
  const geminiCandidates = Array.from(
    new Set([
      userSpecifiedModel,
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ])
  );

  let lastErr = null;

  for (const model of geminiCandidates) {
    // Retry up to 2 times for 503 (high demand) / 429 (rate limit) transient errors
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const data = await callGeminiSingle(model, systemPrompt, userPrompt);
        return { data, modelUsed: model };
      } catch (err) {
        lastErr = err;
        const isTransient = err.message.includes("503") || err.message.includes("429");
        if (isTransient && attempt === 1) {
          await sleep(1500); // Backoff before retry
          continue;
        }
        break; // Move to next model candidate if 404/decommissioned or 2nd attempt failed
      }
    }
  }

  throw lastErr || new Error("All Gemini model candidates failed");
}

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

async function callGroqWithFallbacks(systemPrompt, userPrompt) {
  const userSpecifiedModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const groqCandidates = Array.from(
    new Set([
      userSpecifiedModel,
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "deepseek-r1-distill-llama-70b",
      "qwen-2.5-coder-32b",
    ])
  );

  let lastErr = null;

  for (const model of groqCandidates) {
    try {
      const data = await callGroqSingle(model, systemPrompt, userPrompt);
      return { data, modelUsed: model };
    } catch (err) {
      lastErr = err;
      if (err.message.includes("404") || err.message.includes("400") || err.message.includes("model_decommissioned")) {
        continue; // Model slug decommissioned or unavailable on current key -> try next active model
      }
      break;
    }
  }

  throw lastErr || new Error("All Groq model candidates failed");
}

async function generateWithFallback(systemPrompt, userPrompt) {
  try {
    const result = await callGeminiWithFallbacks(systemPrompt, userPrompt);
    return result;
  } catch (geminiErr) {
    try {
      const result = await callGroqWithFallbacks(systemPrompt, userPrompt);
      return { ...result, primaryError: String(geminiErr.message) };
    } catch (groqErr) {
      throw new Error(
        `Both providers failed.\nGemini: ${geminiErr.message}\nGroq: ${groqErr.message}`
      );
    }
  }
}

module.exports = { generateWithFallback };
