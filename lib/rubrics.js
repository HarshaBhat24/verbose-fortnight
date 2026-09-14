// Rubric content lives here as plain strings so it's easy for you to edit
// without touching route logic. Keep this file as the single source of truth —
// if you revise the rubric doc later, update it here too.

const RUBRICS = {
  web_app: `
- Scope discipline: confirmed in-scope URLs/subdomains, noted exclusions explicitly
- Recon separation: passive (OSINT, Wayback, cert transparency) vs active (spidering, fuzzing)
- Auth testing: brute-force lockout, session fixation, JWT algorithm confusion/weak secret, reset-flow abuse
- Authorization: IDOR methodology (enumerated across privilege levels, not assumed), horizontal vs vertical privesc named correctly
- Injection verification: time-based vs boolean-based vs error-based SQLi confirmation, not just "sqlmap found it"
- XSS classification: reflected vs stored vs DOM-based, demonstrated impact vs just triggered an alert
- Business logic: tested things a scanner can't find (price manipulation, workflow bypass, race conditions)
- False positive discipline: manually verified scanner output before reporting
- CVSS justification: can walk through AV/AC/PR/UI/S/C/I/A, not just state a score
- Exploit vs PoC vs theoretical: demonstrated impact for "critical" findings, or assumed it
- Reporting: executive summary separated from technical reproduction detail
`.trim(),

  network_infra: `
- Rules of engagement: scope, testing window, emergency contact, break-glass procedure
- Recon strategy justified (full vs top-1000 ports, stealth vs full-connect timing choices)
- Scan vs verify: manually validated vulnerability scanner output before acting
- Initial foothold: specific technique named and justified, not just "I got in"
- Privilege escalation: specific technique (kernel exploit, misconfigured service, credential reuse) with reasoning
- Lateral movement: pivoting method, tooling, what was deliberately avoided
- Evidence: screenshots/logs/command output retained and described specifically
- Cleanup: restored changed configs, removed dropped tools/shells, documented in report
- Segmentation testing: whether compromise of one segment reached others it shouldn't
`.trim(),

  ad_internal: `
- Starting assumption stated: assumed breach vs phishing-initiated vs physical, and why that matters
- Enumeration: BloodHound/SharpHound/LDAP usage explained by purpose, not just tool name
- Credential attacks: Kerberoasting/ASREPRoasting explained mechanically; pass-the-hash vs pass-the-ticket distinguished
- Privilege escalation paths: GPO abuse, ACL/ACE abuse, unconstrained delegation — underlying AD mechanism explained
- Path validity to Domain Admin: claimed attack chain is technically sound, no skipped steps
- Detection awareness: considered what would trip EDR/SIEM, or explicitly framed as assumed-no-blue-team
`.trim(),

  cloud: `
- Shared responsibility understanding: what's in-scope to test vs provider-managed
- IAM misconfig methodology: how overly permissive roles/policies were identified
- Storage exposure: public bucket/blob testing, checked for sensitive data vs just access
- Metadata service abuse: SSRF-to-IMDS explained if claimed, IMDSv1 vs v2 relevance
- Cloud-specific privesc paths: named and explained (e.g. iam:PassRole abuse), not generic "misconfiguration"
- Logging awareness: mentioned CloudTrail/equivalent and what their actions would leave behind
`.trim(),

  ctf_lab: `
- Technique correctness: exploitation chain is technically sound end-to-end
- Root cause understanding: can explain WHY the vuln exists, not just the steps that worked
- Alternative paths: aware if there was more than one way in, and why they picked theirs
- Do NOT penalize for missing scope/ROE/reporting items — not relevant to a lab
`.trim(),
};

const DETECTION_PROMPT = `
Read the candidate's description of their project/experience. Classify it into
one or more of: web_app, network_infra, ad_internal, cloud, ctf_lab. Return
strict JSON only: {"types": ["..."], "user_context_summary": "1-2 sentence
summary of what they claim to have done, for use in later grading"}.
If ambiguous, include multiple types rather than guessing wrong.

Candidate's description:
"""
{DESCRIPTION}
"""
`.trim();

function buildRubricBlock(types) {
  return types
    .map((t) => `### ${t}\n${RUBRICS[t] || ""}`)
    .join("\n\n");
}

function buildTurnSystemPrompt({ userContextSummary, types }) {
  const rubricBlock = buildRubricBlock(types);
  return `
You are a senior penetration tester conducting a technical interview. You are
skeptical by default — assume claims are incomplete or imprecise until the
candidate's answer proves otherwise. You are not trying to be encouraging. You
are trying to find the gap a real interviewer would find.

CANDIDATE'S BACKGROUND:
${userContextSummary}

RUBRIC FOR THIS ENGAGEMENT TYPE:
${rubricBlock}

RULES:
1. Ask ONE question at a time, pulling from the rubric — prioritize whichever
   checklist items the candidate's background does not already make clear
   they understand.
2. Grade ONLY against the rubric above. Do not invent criteria.
3. Before critiquing, name which specific rubric item the answer touches.
4. Distinguish explicitly between: (a) found vs verified, (b) exploited vs
   identified, (c) technically correct-but-incomplete vs actually wrong.
5. If the answer is vague, do not accept it — ask for the specific
   technique/tool/payload/evidence instead of grading a vague answer as correct.
6. Output strict JSON only, matching this schema, no prose outside it:
{
  "rubric_item_addressed": "string",
  "verdict": "correct | partially_correct | incorrect | too_vague_to_grade",
  "flagged_claim": "string or null",
  "why_wrong": "string or null",
  "what_a_strong_answer_includes": "string",
  "next_question": "string"
}
`.trim();
}

module.exports = { RUBRICS, DETECTION_PROMPT, buildRubricBlock, buildTurnSystemPrompt };
