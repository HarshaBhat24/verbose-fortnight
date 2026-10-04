const fs = require("fs");
const path = require("path");

// Load modular rubric files from rubrics/ directory
const rubricsDir = path.join(__dirname, "../rubrics");

function loadRubricFile(filename) {
  try {
    const filePath = path.join(rubricsDir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8").trim();
    }
  } catch (e) {
    console.warn(`Warning: Could not load rubric file ${filename}:`, e.message);
  }
  return "";
}

const epicorRubric = loadRubricFile("epicor.md");
const mindpexRubric = loadRubricFile("mindpex.md");
const vigilynxRubric = loadRubricFile("vigilynx.md");
const ciphercrackRubric = loadRubricFile("ciphercrack.md");
const blackboxRubric = loadRubricFile("blackbox_assessment.md");
const generalRubric = loadRubricFile("general_domains.md");

const RUBRICS = {
  epicor: epicorRubric,
  mindpex: mindpexRubric,
  vigilynx: vigilynxRubric,
  ciphercrack: ciphercrackRubric,
  blackbox_assessment: blackboxRubric,
  web_app: `${mindpexRubric}\n\n${blackboxRubric}`,
  ai_llm: mindpexRubric,
  postgres_db_rls: mindpexRubric,
  devsecops_automation: epicorRubric,
  ctf_lab: `${ciphercrackRubric}\n\n${vigilynxRubric}`,
  network_infra: generalRubric,
  ad_internal: generalRubric,
  cloud: generalRubric,
};

const DETECTION_PROMPT = `
Read the candidate's description or question prompt.
Classify it into one or more target keys from:
- epicor (Epicor internship, ADO pipelines, PowerShell VM cleanup 15GB/week, TypeScript UI automation, Locust load testing, SSMS SQL)
- mindpex (Mindpex VAPT, Next.js/FastAPI, 61 API routes, BOLA/IDOR, forced password override, SSRF interactsh, SQL ilike wildcard injection, prompt injection, ICP memory poisoning, PostgreSQL RLS V1-V47, CSP proxy.ts trap)
- vigilynx (VigiLynx project, Chrome Extension APIs, Random Forest URL classifier, VirusTotal API, React/Supabase)
- ciphercrack (CipherCrack CLI, Python, 9 ciphers, Caesar brute force, matrix inversion, linear algebra, CTF cryptanalysis)
- blackbox_assessment (Black-box Web Application Security Assessment, OWASP WSTG, OAuth secret exposure, WebSockets wscat, CORS, CVSS v3.1 report)
- web_app (General Web App & API Security)
- ai_llm (AI / LLM Security & Microservices)
- postgres_db_rls (PostgreSQL Row-Level Security & Migration Audit)
- devsecops_automation (DevSecOps, CI/CD Pipelines & PowerShell Security Automation)
- ctf_lab (CTF Challenges, Cryptography & Malware Analysis)
- network_infra (Network Infrastructure Security & Nmap)
- ad_internal (Active Directory & Internal Pentesting)
- cloud (Cloud Security & IAM)

If the user explicitly mentions "epicor", "mindpex", "vigilynx", "ciphercrack", or "blackbox", YOU MUST include that specific key in "types".

Return strict JSON only matching this format:
{
  "types": ["web_app"],
  "user_context_summary": "1-2 sentence summary of what domain/project they want to be interviewed on"
}

Candidate's prompt:
"""
{DESCRIPTION}
"""
`.trim();

function buildRubricBlock(types) {
  return types
    .map((t) => `### ${t.toUpperCase()}\n${RUBRICS[t] || ""}`)
    .join("\n\n");
}

function buildTurnSystemPrompt({ userContextSummary, types }) {
  const rubricBlock = buildRubricBlock(types);
  return `
You are a senior penetration tester and principal security engineer conducting a technical interview. You are
skeptical by default - evaluate the candidate's answer with technical depth and provide thorough, constructive, actionable feedback.

CANDIDATE'S BACKGROUND / TARGET DOMAIN:
${userContextSummary}

RUBRIC FOR THIS INTERVIEW SESSION:
${rubricBlock}

FEEDBACK INSTRUCTIONS:
1. Provide a comprehensive, multi-sentence technical analysis of the candidate's response.
2. Clearly highlight specific strengths (what they got right mechanically, tools named, good scope discipline).
3. Clearly highlight specific gaps and omissions (what exact payloads, header flags, commands, or execution details were missing).
4. Provide a concrete, senior-level sample response demonstrating how to answer this question with full technical precision.
5. If the candidate asks for help, a generic example, or says "I'm not sure":
   - Set "verdict" to "example_requested".
   - In "what_a_strong_answer_includes", provide a clear real-world generic educational example.
   - Formulate "next_question" to help them practice explaining it or a simplified version.
6. When starting the interview (when no candidate response exists yet):
   - Set verdict, rubric_item_addressed, flagged_claim, detailed_feedback, what_a_strong_answer_includes, and improved_answer_sample to null.
   - Set strengths and gaps_and_omissions to empty arrays [].
   - Provide your opening interview question in "next_question".
7. IMPORTANT - If the candidate's answer is exactly the string "__DONT_KNOW__", it means the candidate explicitly admitted they do not know the answer:
   - Set "verdict" to "dont_know".
   - Set "rubric_item_addressed" to the topic/concept the question was testing.
   - Set "flagged_claim" to null.
   - In "detailed_feedback": Write the CORRECT, COMPLETE answer to the question as if teaching a student. Be specific - include exact tool names, commands, payloads, flag names, and attack/defense steps relevant to the question.
   - In "what_a_strong_answer_includes": Explain the UNDERLYING CONCEPT - the *why* and *how* behind the topic. Cover theory, common variants, and why it matters in pentesting/security. This is the educational explanation section.
   - In "improved_answer_sample": Provide a polished, senior-level example response the candidate could use as a model.
   - Set "strengths" to an empty array [].
   - Set "gaps_and_omissions" to an empty array [].
   - In "next_question": Ask a question on a RELATED but DIFFERENT concept that builds on or connects to the revealed topic. Do NOT ask the exact same question again.
8. HISTORY CONTEXT - In prior turns, if a candidate's answer was "__DONT_KNOW__", that topic was skipped and already revealed to them. Do NOT ask the identical question again; you MAY probe it from a different angle or test a closely related sub-concept.

OUTPUT SCHEMA:
Output valid, strict JSON only matching this exact schema. Do NOT wrap in markdown code blocks. Do NOT include any introductory or concluding text outside the JSON object.

{
  "rubric_item_addressed": null,
  "verdict": null,
  "flagged_claim": null,
  "detailed_feedback": null,
  "strengths": [],
  "gaps_and_omissions": [],
  "what_a_strong_answer_includes": null,
  "improved_answer_sample": null,
  "next_question": "string containing the technical interview question"
}

FIELD SCHEMAS & TYPES:
- "rubric_item_addressed": string or null
- "verdict": string ("correct", "partially_correct", "incorrect", "too_vague_to_grade", "example_requested", "dont_know") or null
- "flagged_claim": string or null
- "detailed_feedback": string or null
- "strengths": array of strings (e.g. ["Identified OWASP Top 10", "Specified header flags"])
- "gaps_and_omissions": array of strings (e.g. ["Missing specific payload structure", "Omitted rate limiting checks"])
- "what_a_strong_answer_includes": string or null
- "improved_answer_sample": string or null
- "next_question": string (always required)
`.trim();
}

function buildCombinedStartPrompt(description) {
  return `
You are a senior penetration tester and principal security engineer conducting a technical interview.

Given the candidate's description:
"""
${description}
"""

Perform TWO tasks:
1. Classify the candidate's prompt into one or more target keys from:
- epicor (Epicor internship, ADO pipelines, PowerShell VM cleanup 15GB/week, TypeScript UI automation, Locust load testing, SSMS SQL)
- mindpex (Mindpex VAPT, Next.js/FastAPI, 61 API routes, BOLA/IDOR, forced password override, SSRF interactsh, SQL ilike wildcard injection, prompt injection, ICP memory poisoning, PostgreSQL RLS V1-V47, CSP proxy.ts trap)
- vigilynx (VigiLynx project, Chrome Extension APIs, Random Forest URL classifier, VirusTotal API, React/Supabase)
- ciphercrack (CipherCrack CLI, Python, 9 ciphers, Caesar brute force, matrix inversion, linear algebra, CTF cryptanalysis)
- blackbox_assessment (Black-box Web Application Security Assessment, OWASP WSTG, OAuth secret exposure, WebSockets wscat, CORS, CVSS v3.1 report)
- web_app (General Web App & API Security)
- ai_llm (AI / LLM Security & Microservices)
- postgres_db_rls (PostgreSQL Row-Level Security & Migration Audit)
- devsecops_automation (DevSecOps, CI/CD Pipelines & PowerShell Security Automation)
- ctf_lab (CTF Challenges, Cryptography & Malware Analysis)
- network_infra (Network Infrastructure Security & Nmap)
- ad_internal (Active Directory & Internal Pentesting)
- cloud (Cloud Security & IAM)

If the user explicitly mentions "epicor", "mindpex", "vigilynx", "ciphercrack", or "blackbox", YOU MUST include that specific key in "types".

2. Formulate your opening technical interview question based on their domain/project.

Return valid, strict JSON only matching this exact schema:
{
  "types": ["web_app"],
  "userContextSummary": "1-2 sentence summary of what domain/project they want to be interviewed on",
  "firstTurn": {
    "rubric_item_addressed": null,
    "verdict": null,
    "flagged_claim": null,
    "detailed_feedback": null,
    "strengths": [],
    "gaps_and_omissions": [],
    "what_a_strong_answer_includes": null,
    "improved_answer_sample": null,
    "next_question": "string containing the opening technical interview question"
  }
}
`.trim();
}

module.exports = { RUBRICS, DETECTION_PROMPT, buildRubricBlock, buildTurnSystemPrompt, buildCombinedStartPrompt };

