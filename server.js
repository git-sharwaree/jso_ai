require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════════════════════
//  AGENT TOOLS
// ════════════════════════════════════════════════════════════════

// ── TOOL 1: Profile Fetcher ──────────────────────────────────────
// Production: SELECT * FROM candidate_profiles WHERE user_id = $1
// Prototype:  receives profile from form input
function tool_fetchCandidateProfile(candidateProfile) {
  const hasProfile = candidateProfile &&
    Object.values(candidateProfile).some(v => v?.trim?.());

  if (!hasProfile) {
    return {
      success: false,
      context: 'CANDIDATE PROFILE: Not provided — transcript-only analysis.',
      profileProvided: false
    };
  }

  return {
    success: true,
    profileProvided: true,
    context: `
CANDIDATE PRE-SESSION PROFILE (sourced from JSO · Supabase):
- ATS Score       : ${candidateProfile.atsScore || 'Not provided'}
- Experience Level: ${candidateProfile.experienceLevel || 'Not provided'}
- Target Role     : ${candidateProfile.targetRole || 'Not provided'}
- Known Skill Gaps: ${candidateProfile.skillGaps || 'Not provided'}
- Background      : ${candidateProfile.background || 'Not provided'}
- Previous Notes  : ${candidateProfile.previousNotes || 'None on record'}

PROFILE ALIGNMENT INSTRUCTIONS:
Evaluate whether the HR consultant:
1. Addressed the candidate's known skill gaps
2. Calibrated advice to the candidate's actual experience level
3. Covered the target role relevantly
4. Built on or ignored previous consultation notes
Flag in profile_alignment.notes if profile signals were IGNORED.`
  };
}

// ── TOOL 2: Session History Checker ─────────────────────────────
// Production: SELECT * FROM consultation_audits
//             WHERE consultant = $1 ORDER BY date DESC LIMIT 5
// Prototype:  receives simulated history from client
function tool_checkSessionHistory(consultantName, sessionHistory) {
  if (!sessionHistory || sessionHistory.length === 0) {
    return {
      success: false,
      context: 'SESSION HISTORY: No previous sessions on record for this consultant.',
      patterns: [],
      biasRecurring: false,
      avgScore: null
    };
  }

  const allIssues = sessionHistory.flatMap(s => s.issues  || []);
  const allBias   = sessionHistory.flatMap(s => s.biasFlags || []);
  const avgScore  = Math.round(
    sessionHistory.reduce((a, s) => a + (s.avgScore || 0), 0) / sessionHistory.length
  );

  const recurring = [...new Set(
    allIssues.filter(issue =>
      allIssues.filter(i => i === issue).length >= 2
    )
  )];

  return {
    success: true,
    biasRecurring: allBias.length >= 2,
    avgScore,
    patterns: recurring,
    context: `
CONSULTANT SESSION HISTORY (last ${sessionHistory.length} sessions):
- Average Quality Score : ${avgScore}/100
- Sessions Reviewed     : ${sessionHistory.length}
- Recurring Issues      : ${recurring.length > 0 ? recurring.join(', ') : 'None detected'}
- Bias Flag History     : ${allBias.length >= 2
    ? `⚠ Bias flagged in ${allBias.length} previous sessions — escalate if repeated`
    : 'Clean'}

HISTORY INSTRUCTIONS:
If recurring issues match problems found in this transcript, flag them
as patterns not isolated incidents. Escalate those coaching suggestions
to High priority.`
  };
}

// ── TOOL 3: Fallback Detector ────────────────────────────────────
// NEW: Scans transcript for moments where HR didn't know an answer.
// Detects two cases:
//   Case A — HR attempted a lookup (positive signal)
//   Case B — HR gave an honest redirect (also positive, but needs coaching)
//   Case C — HR deflected, gave vague answer, or went silent (concern)
// Returns structured context that Gemini uses to evaluate fallback quality.
function tool_detectFallbackMoments(transcript) {
  const lines = transcript.toLowerCase();

  // Phrases that suggest HR attempted to look something up
  const lookupPhrases = [
    "let me check", "let me look", "i'll find out", "i can look that up",
    "i'll get back", "let me refer", "checking", "one moment"
  ];

  // Phrases that suggest HR gave an honest redirect (good behaviour)
  const redirectPhrases = [
    "outside my", "not my area", "recommend speaking to",
    "better placed", "technical recruiter", "i don't specialise",
    "i'm not the best", "i'd suggest checking", "not sure about that"
  ];

  // Phrases that suggest HR deflected without helping (concern)
  const deflectPhrases = [
    "i don't know", "no idea", "can't say", "not sure",
    "don't have that information", "i'll have to skip that"
  ];

  const hasLookup   = lookupPhrases.some(p  => lines.includes(p));
  const hasRedirect = redirectPhrases.some(p => lines.includes(p));
  const hasDeflect  = deflectPhrases.some(p  => lines.includes(p));

  // Only flag deflection if there's no accompanying redirect
  const deflectWithoutRedirect = hasDeflect && !hasRedirect;

  let fallbackContext = '\nFALLBACK HANDLING DETECTED:\n';

  if (!hasLookup && !hasRedirect && !hasDeflect) {
    fallbackContext += '- No fallback moments detected — HR appeared confident throughout.\n';
    fallbackContext += '  If gaps exist in transcript, check whether HR avoided the topic entirely.\n';
  }
  if (hasLookup) {
    fallbackContext += '- ✓ HR attempted to look up information (positive signal — shows diligence).\n';
    fallbackContext += '  In coaching_suggestions, recommend building a pre-session knowledge brief.\n';
  }
  if (hasRedirect) {
    fallbackContext += '- ✓ HR redirected honestly when outside their expertise (correct behaviour).\n';
    fallbackContext += '  In coaching_suggestions, suggest HR always pairs a redirect with a next step.\n';
  }
  if (deflectWithoutRedirect) {
    fallbackContext += '- ⚠ HR deflected without providing a redirect or next step (concern).\n';
    fallbackContext += '  In coaching_suggestions, flag this as High priority — candidate left without guidance.\n';
  }

  fallbackContext += `
FALLBACK INSTRUCTION:
Do NOT penalise HR for not knowing something. Evaluate HOW they handled it.
Redirect + honesty = good. Deflect + silence = concern. Lookup attempt = positive.
This is critical for Part C Workers — agent must support HR, not punish knowledge gaps.`;

  return {
    hasLookup,
    hasRedirect,
    hasDeflect: deflectWithoutRedirect,
    context: fallbackContext
  };
}

// ── TOOL 4: Conflict of Interest Detector ───────────────────────
// Scans for signals that the HR may have a conflict of interest.
// Part C Governance: how conflicts of interest are handled.
// These are signals only — not accusations. Flagged for human review.
function tool_detectConflictSignals(transcript, roleContext) {
  const lines = transcript.toLowerCase();

  const signals = [];

  // Signal 1: Session unusually short (word count proxy)
  const wordCount = transcript.split(/\s+/).length;
  if (wordCount < 150) {
    signals.push({
      type: 'Unusually Short Session',
      detail: `Session contains only ~${wordCount} words. Standard consultations run longer. May indicate disengagement or a pre-decided outcome.`
    });
  }

  // Signal 2: HR pushing toward or away from a specific agency/company
  const agencyPush = ['our agency', 'we can place you', 'i can refer you directly',
    'skip the platform', 'contact me directly', 'bypass'];
  if (agencyPush.some(p => lines.includes(p))) {
    signals.push({
      type: 'Potential Agency Conflict',
      detail: 'HR may be directing candidate toward a specific agency outside the JSO platform process.'
    });
  }

  // Signal 3: Overly negative framing without evidence
  const negativePatterns = ['you are not ready', 'probably not suitable',
    'unlikely to get', 'waste of time', 'overqualified for everything'];
  if (negativePatterns.some(p => lines.includes(p))) {
    signals.push({
      type: 'Unjustified Negative Framing',
      detail: 'HR used discouraging language without evidence-based reasoning. May indicate bias or conflict.'
    });
  }

  return {
    hasSignals: signals.length > 0,
    signals,
    context: signals.length > 0
      ? `\nCONFLICT OF INTEREST SIGNALS DETECTED:\n` +
        signals.map(s => `- [${s.type}]: ${s.detail}`).join('\n') +
        `\nINSTRUCTION: Include these in conflict_signals output field. These are advisory flags for Super Admin review — not accusations.`
      : '\nCONFLICT OF INTEREST: No signals detected in this session.'
  };
}

// ── TOOL 5: Bias Validator ───────────────────────────────────────
// Grounds every Gemini-generated bias flag to actual transcript text.
// Removes hallucinated flags. Part C Community — fair, evidence-based.
function tool_validateBiasFlags(biasFlags, transcript) {
  if (!biasFlags || biasFlags.length === 0) {
    return { validated: [], removed: 0, hallucinated: [] };
  }

  const transcriptLower = transcript.toLowerCase();
  const validated    = [];
  const hallucinated = [];

  biasFlags.forEach(flag => {
    const excerptClean = (flag.excerpt || '').toLowerCase().trim();
    const checkPhrase  = excerptClean.slice(0, 30);
    const directMatch  = excerptClean.length > 0 &&
                         transcriptLower.includes(checkPhrase);

    if (directMatch) {
      validated.push(flag);
    } else {
      const words       = excerptClean.split(/\s+/).filter(w => w.length > 4);
      const wordMatches = words.filter(w => transcriptLower.includes(w)).length;
      wordMatches >= 2 ? validated.push(flag) : hallucinated.push(flag);
    }
  });

  return {
    validated,
    removed: hallucinated.length,
    hallucinated: hallucinated.map(f => f.type)
  };
}

// ── TOOL 6: Output Schema Validator ─────────────────────────────
// Ensures JSON is complete and internally consistent.
// Catches score-bias contradictions before reaching the client.
function tool_validateOutput(parsed) {
  const issues = [];
  const scoreKeys = ['tone','professionalism','candidate_engagement','clarity','candidate_experience'];

  scoreKeys.forEach(key => {
    const val = parsed.scores?.[key]?.value;
    if (val === undefined || val < 0 || val > 100) {
      issues.push(`Score out of range: ${key}`);
      if (parsed.scores?.[key]) parsed.scores[key].value = 50;
    }
  });

  // Contradiction: high scores + bias flags
  const avgScore = scoreKeys.reduce((a, k) =>
    a + (parsed.scores?.[k]?.value || 0), 0) / scoreKeys.length;
  if (avgScore > 80 && parsed.bias_flags?.length > 0) {
    issues.push('Score-bias contradiction — professionalism adjusted');
    if (parsed.scores?.professionalism?.value > 75) {
      parsed.scores.professionalism.value = 70;
      parsed.scores.professionalism.description += ' (adjusted: bias flags present)';
    }
  }

  // Ensure required fields
  if (!parsed.overall_verdict)  parsed.overall_verdict  = 'Needs Improvement';
  if (!parsed.overall_summary)  parsed.overall_summary  = 'Analysis completed.';
  if (!Array.isArray(parsed.strengths))             parsed.strengths = [];
  if (!Array.isArray(parsed.concerns))              parsed.concerns  = [];
  if (!Array.isArray(parsed.coaching_suggestions))  parsed.coaching_suggestions = [];
  if (!Array.isArray(parsed.candidate_experience_notes)) parsed.candidate_experience_notes = [];
  if (!Array.isArray(parsed.engagement_suggestions))     parsed.engagement_suggestions = [];
  if (!Array.isArray(parsed.conflict_signals))           parsed.conflict_signals = [];

  parsed.bias_clean = !parsed.bias_flags || parsed.bias_flags.length === 0;

  return { parsed, issues };
}

// ════════════════════════════════════════════════════════════════
//  ORCHESTRATOR
//  Decides which tools to call, combines outputs, calls Gemini,
//  then validates the response. This is the agent loop.
// ════════════════════════════════════════════════════════════════
async function orchestrate(transcript, consultantName, role, candidateProfile, sessionHistory, apiKey) {

  const agentLog = [];
  const log = (step, detail) => agentLog.push({
    step, detail, timestamp: new Date().toISOString()
  });

  log('ORCHESTRATOR_START', 'Agent initialised — beginning tool selection and execution');

  // ── Tool 1: Fetch candidate profile ──────────────────────────
  log('TOOL_CALL', 'tool_fetchCandidateProfile — retrieving candidate context');
  const profileResult = tool_fetchCandidateProfile(candidateProfile);
  log('TOOL_RESULT', `Profile: ${profileResult.profileProvided ? 'loaded successfully' : 'not provided — transcript-only mode'}`);

  // ── Tool 2: Check session history (conditional) ───────────────
  let historyResult = { success: false, context: '', patterns: [], biasRecurring: false };
  if (consultantName !== 'Anonymous' && sessionHistory?.length > 0) {
    log('TOOL_CALL', 'tool_checkSessionHistory — scanning for recurring patterns');
    historyResult = tool_checkSessionHistory(consultantName, sessionHistory);
    log('TOOL_RESULT', `History: ${sessionHistory.length} sessions loaded, avg score ${historyResult.avgScore}, recurring: ${historyResult.patterns.join(', ') || 'none'}`);
  } else {
    log('TOOL_SKIP', 'tool_checkSessionHistory — skipped: no consultant name or history provided');
  }

  // ── Tool 3: Detect fallback moments ──────────────────────────
  log('TOOL_CALL', 'tool_detectFallbackMoments — scanning for knowledge gap handling');
  const fallbackResult = tool_detectFallbackMoments(transcript);
  log('TOOL_RESULT', `Fallback: lookup=${fallbackResult.hasLookup}, redirect=${fallbackResult.hasRedirect}, deflect=${fallbackResult.hasDeflect}`);

  // ── Tool 4: Detect conflict of interest signals ───────────────
  log('TOOL_CALL', 'tool_detectConflictSignals — scanning for conflict indicators');
  const conflictResult = tool_detectConflictSignals(transcript, role);
  log('TOOL_RESULT', `Conflict signals: ${conflictResult.hasSignals ? conflictResult.signals.map(s=>s.type).join(', ') : 'none detected'}`);

  // ── Build enriched prompt from all tool outputs ───────────────
  log('PROMPT_BUILD', 'Assembling enriched prompt from all tool outputs');

  const prompt = `You are an HR consultation quality analyst for JSO (Job Search Optimiser) by AariyaTech Corp.
The orchestration system has already run pre-analysis tools and provided context below.
Your job is to reason across all context and return structured coaching feedback.

HR Consultant  : ${consultantName}
Role Discussed : ${role}
Timestamp      : ${new Date().toISOString()}

${profileResult.context}
${historyResult.context}
${fallbackResult.context}
${conflictResult.context}

TRANSCRIPT:
${transcript}

Return ONLY valid JSON. No markdown, no preamble, nothing outside the JSON.

{
  "overall_verdict": "Good or Needs Improvement or Poor",
  "overall_summary": "2-3 sentence summary of consultation quality",
  "profile_alignment": {
    "gaps_addressed": true,
    "notes": "one sentence on whether consultant used candidate profile effectively"
  },
  "scores": {
    "tone":                 { "value": 0, "description": "one sentence" },
    "professionalism":      { "value": 0, "description": "one sentence" },
    "candidate_engagement": { "value": 0, "description": "one sentence" },
    "clarity":              { "value": 0, "description": "one sentence" },
    "candidate_experience": { "value": 0, "description": "one sentence" }
  },
  "strengths": ["observed strength"],
  "concerns":  ["observed concern"],
  "bias_flags": [
    {
      "type":        "bias category",
      "excerpt":     "exact short quote from transcript",
      "explanation": "why this is a fairness concern"
    }
  ],
  "bias_clean": true,
  "recurring_pattern": false,
  "fallback_handling": {
    "verdict": "Good or Needs Improvement or Poor",
    "notes": "one sentence — how did the HR handle moments they did not know the answer?"
  },
  "conflict_signals": [
    {
      "type":   "signal type",
      "detail": "what was observed and why it is flagged for review"
    }
  ],
  "engagement_suggestions": [
    "specific suggestion on how HR can improve candidate engagement — e.g. use open-ended questions"
  ],
  "coaching_suggestions": [
    { "text": "specific actionable coaching suggestion", "priority": "High or Medium or Low" }
  ],
  "candidate_experience_notes": ["note from candidate perspective"]
}

ETHICAL GUIDELINES — follow strictly:
1. Coaching feedback only — never a punitive verdict. This supports HR professionals, not surveils them.
2. Bias flags must quote directly from the transcript. No invented excerpts.
3. Bias categories: nationality, gender, age, socioeconomic, accent or language assumptions.
4. Scores: 85-100 excellent · 70-84 good · 50-69 needs improvement · below 50 poor.
5. Fallback handling: reward honesty and redirects. Only flag deflection without follow-up.
6. Conflict signals are advisory flags for Super Admin review — not accusations.
7. Engagement suggestions: focus on question quality, follow-up, session pacing, and active listening.
8. If recurring_pattern is true (history shows same issues), escalate those to High priority.
9. Coaching suggestions: constructive, empathetic, growth-oriented — never punitive.
10. Set bias_clean true only when bias_flags is empty.`;

  // ── Call OpenRouter (bypasses regional free tier blocks) ────────
  // OpenRouter proxies multiple models including Gemini — free tier,
  // no regional restrictions, uses OpenAI-compatible message format.
  log('LLM_CALL', 'Sending enriched prompt to OpenRouter → gemini-2.0-flash-exp');

  const geminiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://jso-hr-agent.vercel.app',
      'X-Title': 'JSO HR Consultation Monitoring Agent'
    },
    body: JSON.stringify({
      model: 'openrouter/auto',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.2
    })
  });

  if (!geminiRes.ok) {
    const errData = await geminiRes.json();
    throw new Error(errData?.error?.message || `OpenRouter error: ${geminiRes.status}`);
  }

  const geminiData = await geminiRes.json();
  let raw = geminiData?.choices?.[0]?.message?.content || '';
  raw = raw.replace(/```json|```/g, '').trim();

  log('LLM_RESPONSE', 'OpenRouter response received — parsing JSON');

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw new Error('Failed to parse Gemini JSON response. Please retry.'); }

  // ── Tool 5: Validate bias flags ───────────────────────────────
  log('TOOL_CALL', 'tool_validateBiasFlags — grounding flags to transcript evidence');
  const biasValidation = tool_validateBiasFlags(parsed.bias_flags, transcript);
  parsed.bias_flags = biasValidation.validated;
  log('TOOL_RESULT', biasValidation.removed > 0
    ? `Removed ${biasValidation.removed} hallucinated flag(s): ${biasValidation.hallucinated.join(', ')}`
    : `All ${biasValidation.validated.length} flag(s) grounded to transcript`);

  // ── Merge conflict signals from Tool 4 into output ────────────
  // Tool 4 ran rule-based detection — merge with Gemini's analysis
  if (conflictResult.hasSignals) {
    const existingTypes = (parsed.conflict_signals || []).map(s => s.type);
    conflictResult.signals.forEach(sig => {
      if (!existingTypes.includes(sig.type)) {
        parsed.conflict_signals = parsed.conflict_signals || [];
        parsed.conflict_signals.push(sig);
      }
    });
    log('TOOL_RESULT', `Conflict signals merged: ${conflictResult.signals.map(s=>s.type).join(', ')}`);
  }

  // ── Tool 6: Validate output schema ───────────────────────────
  log('TOOL_CALL', 'tool_validateOutput — checking schema and score consistency');
  const validation = tool_validateOutput(parsed);
  parsed = validation.parsed;
  log('TOOL_RESULT', validation.issues.length > 0
    ? `Issues corrected: ${validation.issues.join(' | ')}`
    : 'Schema valid — no contradictions detected');

  // ── Attach audit metadata ─────────────────────────────────────
  parsed._audit = {
    sessionId          : 'JSO-' + Date.now().toString(36).toUpperCase(),
    analysedAt         : new Date().toISOString(),
    model              : 'google/gemini-2.0-flash-exp:free (OpenRouter)',
    wordCount          : transcript.split(/\s+/).length,
    consultant         : consultantName,
    role               : role,
    profileProvided    : profileResult.profileProvided,
    historyProvided    : historyResult.success,
    fallbackDetected   : fallbackResult.hasLookup || fallbackResult.hasRedirect || fallbackResult.hasDeflect,
    conflictSignals    : conflictResult.signals.length,
    biasFlagsValidated : biasValidation.validated.length,
    biasFlagsRemoved   : biasValidation.removed,
    validationIssues   : validation.issues,
    dataRetained       : false,
    ethicalLayerActive : true,
    agentLog           : agentLog
  };

  log('ORCHESTRATOR_END', `Complete — session ${parsed._audit.sessionId}`);
  return parsed;
}

// ════════════════════════════════════════════════════════════════
//  API ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({
    status   : 'ok',
    agent    : 'JSO HR Consultation Monitoring Agent',
    version  : '3.0.0 — Agentic',
    tools    : [
      'tool_fetchCandidateProfile',
      'tool_checkSessionHistory',
      'tool_detectFallbackMoments',
      'tool_detectConflictSignals',
      'tool_validateBiasFlags',
      'tool_validateOutput'
    ],
    timestamp: new Date().toISOString()
  });
});

app.post('/api/analyse', async (req, res) => {
  const { transcript, hrName, roleContext, candidateProfile, sessionHistory } = req.body;

  if (!transcript || transcript.trim().length < 50) {
    return res.status(400).json({
      error: 'Transcript too short. Please provide a meaningful consultation transcript.'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(500).json({
      error: 'Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.'
    });
  }

  try {
    const result = await orchestrate(
      transcript,
      hrName?.trim()     || 'Anonymous',
      roleContext?.trim() || 'Unspecified',
      candidateProfile,
      sessionHistory,
      apiKey
    );
    return res.json({ success: true, result });

  } catch (err) {
    console.error('[AgentAI] Orchestration error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ JSO HR Monitoring Agent v3.0 → http://localhost:${PORT}`);
  console.log(`   6 tools: profile · history · fallback · conflict · bias · schema`);
  console.log(`   POST /api/analyse  |  GET /api/health\n`);
});

module.exports = app;
