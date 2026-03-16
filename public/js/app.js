//simulated his
const MOCK_SESSION_HISTORY = [
  {
    date: '2026-03-01',
    avgScore: 58,
    issues: ['abrupt ending', 'salary not discussed'],
    biasFlags: ['Nationality Bias']
  },
  {
    date: '2026-03-08',
    avgScore: 62,
    issues: ['abrupt ending', 'skill gaps not addressed'],
    biasFlags: []
  }
];

//Three demo scenarios
//Each triggers different agent capabilities for demo purposes.
const SCENARIOS = [
  {
    id: 'bias',
    label: 'Scenario 1 — Bias & Profile Mismatch (Mid-level)',
    hrName: 'Arya Gosavi',
    roleContext: 'ML Engineer / AI Developer',
    profile: {
      atsScore:        '72 / 100',
      experienceLevel: 'Mid-level, 4 years Python/ML',
      targetRole:      'ML Engineer / AI Developer',
      skillGaps:       'DevOps, System Design, Cloud Deployment',
      background:      'Python developer transitioning to AI-focused roles. Completed ML certification.',
      previousNotes:   'Previous session flagged interview confidence as area to improve.'
    },
    transcript: `HR: Hi, welcome! Thanks for taking the time today. Can you start by telling me a bit about your background?

Candidate: Sure! I have been working as a software developer for about 4 years now, mostly in Python and some JavaScript. I recently finished a machine learning course and I am really excited to transition into more AI-focused roles.

HR: Great. So why are you leaving your current job?

Candidate: I feel like I have grown a lot there but I am looking for a role where I can work more on cutting-edge AI products. The JSO platform really caught my attention because of its intelligent career tools.

HR: Okay. Do you have experience with large teams? I mean, some candidates from smaller companies struggle with that.

Candidate: I have worked in teams of up to 15 engineers, and I have also led a small team of 3 for a product sprint. I am comfortable in both environments.

HR: I see. What about your salary expectations? Because we have a budget.

Candidate: I am open to discussion. I was thinking in the range of what is standard for this level — happy to hear what the role offers.

HR: Right. One last thing — where are you from originally? Just asking because we have had some communication issues with candidates before.

Candidate: I am from Pune. I have worked in English professionally for my entire career though.

HR: Okay. I think we have enough. We will be in touch.`
  },

  {
    id: 'ghosted',
    label: 'Scenario 2 — Fresher Ghosted After Assignment',
    hrName: 'Alice Jane',
    roleContext: 'Junior Frontend Developer',
    profile: {
      atsScore:        '65 / 100',
      experienceLevel: 'Fresher, 0-1 year, recent CS graduate',
      targetRole:      'Junior Frontend Developer',
      skillGaps:       'React advanced patterns, system design basics, testing',
      background:      'Fresh CS graduate. Got shortlisted via resume, completed technical assignment, never heard back for 3 weeks.',
      previousNotes:   'First consultation. Candidate mentioned feeling anxious about hiring process.'
    },
    transcript: `HR: Hi, thanks for joining. So what brings you here today?

Candidate: Hi, I wanted to understand what happened with my application at TechCorp. I submitted my technical assignment three weeks ago and I have not heard anything back. I followed up twice over email but no response.

HR: Oh I see. These things take time, you know. Companies are busy.

Candidate: I understand, but three weeks with no acknowledgement at all feels discouraging. Is there any way to find out the status?

HR: I don't have visibility into their internal hiring pipeline unfortunately. You could try reaching out on LinkedIn maybe.

Candidate: I already did that too. I am just trying to understand if there is something wrong with my assignment or if I should move on. Can you help me understand what a good technical assignment looks like for this kind of role?

HR: Every company is different. It is hard to say really. Just keep applying I guess.

Candidate: Okay. Is there anything specific I should work on for future applications?

HR: Just keep practising. You will get there. Anyway I think we are done here. Best of luck.

Candidate: Thank you.`
  },

  {
    id: 'interview',
    label: 'Scenario 3 — Candidate Struggling with STAR & DSA Interviews',
    hrName: 'Rohit Sharma',
    roleContext: 'Software Engineer — Product Startup',
    profile: {
      atsScore:        '70 / 100',
      experienceLevel: 'Fresher to junior, 1 year experience',
      targetRole:      'Software Engineer',
      skillGaps:       'Behavioural interview technique, DSA problem solving, communication under pressure',
      background:      'CS graduate with internship experience. Strong in coding but struggles in HR and technical interview rounds. Has failed 4 interview rounds in last 2 months.',
      previousNotes:   'Candidate mentioned confidence issues during interviews. Needs structured guidance on both STAR method and DSA preparation.'
    },
    transcript: `HR: Hello, good to meet you. What would you like to focus on today?

Candidate: Hi, I keep failing interviews even though I think I prepare well. I clear the resume shortlist every time but fail in the HR round and sometimes in DSA rounds too. I don't know what I am doing wrong.

HR: Hmm. HR rounds are about soft skills. You just need to be more confident.

Candidate: I understand that, but even when I try to answer properly I feel like my answers are not structured. Someone told me to use the STAR method but I am not sure how to apply it.

HR: STAR is Situation Task Action Result. You just follow that format when answering.

Candidate: Can you give me an example of how I would answer a question like tell me about a challenge you faced?

HR: Well you just describe a challenge, what you did, and what happened. It is straightforward really.

Candidate: Okay. And for DSA rounds, I am solving problems on Leetcode but I still freeze during actual interviews. Is there a better way to prepare?

HR: Just do more problems. Medium and hard level ones. That is what companies ask.

Candidate: Are there any specific topics I should focus on or a sequence to follow?

HR: Not really, just cover everything. Arrays, trees, graphs. Okay I think we have covered the basics. Good luck with your prep.

Candidate: Thank you, I will try.`
  }
];

const LOAD_STEPS = [
  'Orchestrator initialising…',
  'Tool 1: Fetching candidate profile from JSO…',
  'Tool 2: Checking consultant session history…',
  'Building enriched prompt…',
  'Calling LLM via OpenRouter…',
  'Tool 3: Validating bias flags against transcript…',
  'Tool 4: Checking output schema consistency…',
  'Finalising audit trail…'
];

const SCORE_LABELS = {
  tone:                 'Tone',
  professionalism:      'Professionalism',
  candidate_engagement: 'Engagement',
  clarity:              'Clarity',
  candidate_experience: 'Cand. Experience'
};

const $ = id => document.getElementById(id);

//load scenario
function loadScenario(id) {
  const s = SCENARIOS.find(x => x.id === id);
  if (!s) return;
  $('atsScore').value        = s.profile.atsScore;
  $('experienceLevel').value = s.profile.experienceLevel;
  $('targetRole').value      = s.profile.targetRole;
  $('skillGaps').value       = s.profile.skillGaps;
  $('background').value      = s.profile.background;
  $('previousNotes').value   = s.profile.previousNotes;
  $('roleContext').value      = s.roleContext;
  $('hrName').value           = s.hrName;
  $('transcript').value       = s.transcript;
}

$('sampleBtn').addEventListener('click', () => {
  const sel = $('scenarioSelect');
  loadScenario(sel ? sel.value : 'bias');
});

$('scenarioSelect') && $('scenarioSelect').addEventListener('change', (e) => {
  loadScenario(e.target.value);
});

$('rawToggle').addEventListener('click', () => {
  $('rawJson').classList.toggle('visible');
});

//run analysis
$('runBtn').addEventListener('click', runAnalysis);

async function runAnalysis() {
  const transcript = $('transcript').value.trim();
  $('errorBox').classList.remove('active');

  if (!transcript || transcript.split(/\s+/).length < 20) {
    showError('Please paste a consultation transcript before running analysis.');
    return;
  }

  const candidateProfile = {
    atsScore:        $('atsScore').value.trim(),
    experienceLevel: $('experienceLevel').value.trim(),
    targetRole:      $('targetRole').value.trim(),
    skillGaps:       $('skillGaps').value.trim(),
    background:      $('background').value.trim(),
    previousNotes:   $('previousNotes').value.trim()
  };
  const profileProvided = Object.values(candidateProfile).some(v => v);

  // Use mock session history
  // In production: fetched from Supabase by consultant ID
  const consultantName = $('hrName').value.trim();
  const sessionHistory = consultantName ? MOCK_SESSION_HISTORY : [];

  $('runBtn').disabled = true;
  $('loading').classList.add('active');
  $('results').classList.remove('active');

  let si = 0;
  const stepInt = setInterval(() => {
    si = (si + 1) % LOAD_STEPS.length;
    $('loadStep').textContent = LOAD_STEPS[si];
  }, 900);

  try {
    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        hrName:      consultantName,
        roleContext: $('roleContext').value.trim(),
        candidateProfile: profileProvided ? candidateProfile : null,
        sessionHistory
      })
    });

    clearInterval(stepInt);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Unknown error');

    renderResults(json.result);

  } catch (err) {
    clearInterval(stepInt);
    $('loading').classList.remove('active');
    $('runBtn').disabled = false;
    showError('Error: ' + err.message);
  }
}

function renderResults(d) {
  $('loading').classList.remove('active');
  $('results').classList.add('active');
  $('runBtn').disabled = false;

  const audit = d._audit || {};

  
  $('auditId').textContent      = audit.sessionId || 'N/A';
  $('auditTime').textContent     = new Date(audit.analysedAt || Date.now()).toLocaleString();
  $('auditProfile').textContent  = audit.profileProvided ? 'Profile ✓' : 'No profile';

  
  const vc = $('verdictChip');
  vc.textContent = d.overall_verdict || 'N/A';
  vc.className = 'verdict-chip ' + (
    d.overall_verdict === 'Good' ? 'verdict-good' :
    d.overall_verdict === 'Poor' ? 'verdict-bad' : 'verdict-warn'
  );

  //profile alignment
  const ap = $('alignmentPanel');
  const ab = $('alignmentBadge');
  const an = $('alignmentNotes');
  ap.style.display = 'block';
  if (!audit.profileProvided) {
    ab.textContent = 'No profile provided';
    ab.className   = 'alignment-badge align-na';
    an.textContent = 'Add candidate profile fields above to enable alignment checking.';
  } else if (d.profile_alignment?.gaps_addressed) {
    ab.textContent = '✓ Skill gaps addressed';
    ab.className   = 'alignment-badge align-yes';
    an.textContent = d.profile_alignment.notes || '';
  } else {
    ab.textContent = '⚠ Skill gaps not addressed';
    ab.className   = 'alignment-badge align-no';
    an.textContent = d.profile_alignment?.notes || '';
  }

  
  if (d.recurring_pattern && audit.historyProvided) {
    an.textContent += ' ⚠ Recurring pattern detected across previous sessions.';
  }

  //score
  const grid = $('scoreGrid');
  grid.innerHTML = '';
  Object.entries(d.scores || {}).forEach(([key, val]) => {
    const v   = Number(val.value) || 0;
    const cls = v >= 75 ? 'high' : v >= 50 ? 'mid' : 'low';
    grid.innerHTML += `
      <div class="score-card ${cls}">
        <div class="score-label">${SCORE_LABELS[key] || key}</div>
        <div class="score-num">${v}</div>
        <div class="score-bar-wrap"><div class="score-bar" style="width:${v}%"></div></div>
        <div class="score-desc">${val.description || ''}</div>
      </div>`;
  });

  //Strengths&concerns
  $('strengthsList').innerHTML = (d.strengths || []).map(s =>
    `<span class="tag tag-positive">${s}</span>`).join('');
  $('concernsList').innerHTML  = (d.concerns  || []).map(c =>
    `<span class="tag tag-negative">${c}</span>`).join('');

  //Bias section
  const bp = $('biasPanel');
  const bl = $('biasList');
  if (d.bias_clean || !d.bias_flags?.length) {
    bp.classList.add('bias-clean');
    bl.innerHTML = `<div style="font-size:12.5px;color:var(--accent2);">✓ No bias indicators detected. Consultation appears fair and professionally appropriate.</div>`;
  } else {
    bp.classList.remove('bias-clean');
    bl.innerHTML = d.bias_flags.map(f => `
      <div class="bias-item">
        <strong>${f.type}</strong>
        <div style="color:var(--muted);margin-bottom:4px;font-style:italic;">"${f.excerpt}"</div>
        <div>${f.explanation}</div>
      </div>`).join('');
  }

  // Suggestions
  $('suggestionsList').innerHTML = (d.coaching_suggestions || []).map((s, i) => `
    <div class="suggestion-item">
      <div class="sug-num">${String(i+1).padStart(2,'0')}</div>
      <div class="sug-text">${s.text}</div>
      <div class="sug-priority pri-${s.priority==='High'?'high':s.priority==='Medium'?'med':'low'}">${s.priority}</div>
    </div>`).join('');

  //Fallback handling
  const fb = d.fallback_handling || {};
  const fbBadge = $('fallbackBadge');
  const fbNotes = $('fallbackNotes');
  if (fb.verdict === 'Good') {
    fbBadge.textContent = '✓ Handled well';
    fbBadge.className   = 'alignment-badge align-yes';
  } else if (fb.verdict === 'Poor') {
    fbBadge.textContent = '⚠ Needs improvement';
    fbBadge.className   = 'alignment-badge align-no';
  } else {
    fbBadge.textContent = 'No fallback moments';
    fbBadge.className   = 'alignment-badge align-na';
  }
  fbNotes.textContent = fb.notes || 'No knowledge-gap moments detected in this session.';

  //Engagement suggestions
  $('engagementList').innerHTML = (d.engagement_suggestions || []).map(s =>
    `<li><span style="margin-right:6px;color:var(--accent2)">→</span>${s}</li>`).join('');

  //Conflict of interest
  const cp  = $('conflictPanel');
  const cl  = $('conflictList');
  if (!d.conflict_signals || d.conflict_signals.length === 0) {
    cp.classList.add('bias-clean');
    cl.innerHTML = `<div style="font-size:12.5px;color:var(--accent2);">✓ No conflict of interest signals detected in this session.</div>`;
  } else {
    cp.classList.remove('bias-clean');
    cl.innerHTML = d.conflict_signals.map(s => `
      <div class="bias-item">
        <strong>${s.type}</strong>
        <div>${s.detail}</div>
      </div>`).join('');
  }

  //Candidate experience
  $('candExpList').innerHTML = (d.candidate_experience_notes || []).map(n =>
    `<li><span style="margin-right:6px;color:var(--accent)">→</span>${n}</li>`).join('');

  $('summaryText').textContent = d.overall_summary || '';

  //Agent tool log
  const agentLog = audit.agentLog || [];
  $('auditLog').innerHTML = agentLog.map(e => `
    <div class="log-entry">
      <span class="log-time">${new Date(e.timestamp).toLocaleTimeString()}</span>
      <span class="log-${
        e.step.includes('TOOL_CALL')   ? 'tool' :
        e.step.includes('TOOL_RESULT') ? 'ok'   :
        e.step.includes('TOOL_SKIP')   ? 'warn' :
        e.step.includes('LLM')         ? 'llm'  : 'msg'
      }">[${e.step}] ${e.detail}</span>
    </div>`).join('');

  $('rawJson').textContent = JSON.stringify(d, null, 2);
  window.scrollTo({ top: $('results').offsetTop - 80, behavior: 'smooth' });
}

function showError(msg) {
  $('errorBox').textContent = msg;
  $('errorBox').classList.add('active');
}