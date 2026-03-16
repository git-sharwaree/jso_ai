# JSO HR Consultation Monitoring Agent
### AariyaTech Corp — Phase 2: Agentic Career Intelligence

An AI-powered agent that monitors HR consultation quality by analysing transcripts for tone, professionalism, candidate engagement, bias detection, and coaching recommendations — built with ethical AI principles at its core.

---

## Project Structure

```
agentai/
├── public/
│   ├── index.html        # Frontend UI
│   ├── css/
│   │   └── style.css     # Styles
│   └── js/
│       └── app.js        # Frontend logic (calls our backend)
├── server.js             # Express backend — proxies Gemini API securely
├── .env                  # API key (never committed to git)
├── .env.example          # Template for .env
├── vercel.json           # Vercel deployment config
├── package.json
└── README.md
```

---

## Setup (Local)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_key_here
```
Get a free key at: https://aistudio.google.com/app/apikey

### 3. Run locally
```bash
npm start
# or for development with auto-reload:
npm run dev
```

Open: http://localhost:3000

---

## Deploy to Vercel

### Option A: CLI
```bash
npm install -g vercel
vercel
```
When prompted, set the environment variable:
```
GEMINI_API_KEY=your_key_here
```

### Option B: Vercel Dashboard
1. Push this folder to a GitHub repo
2. Import the repo on vercel.com
3. Add `GEMINI_API_KEY` in Project Settings → Environment Variables
4. Deploy

---

## How It Works

```
User pastes transcript
        ↓
Frontend (public/js/app.js)
        ↓  POST /api/analyse
Backend (server.js)
        ↓  Gemini API call (key stays server-side)
Gemini 2.0 Flash
        ↓  Structured JSON response
Backend parses + attaches audit metadata
        ↓
Frontend renders dashboard
```

## Agent Output (Structured JSON)
- `overall_verdict` — Good / Needs Improvement / Poor
- `scores` — 5 dimensions scored 0–100 (Tone, Professionalism, Engagement, Clarity, Candidate Experience)
- `strengths` — observed positive behaviours
- `concerns` — areas needing attention
- `bias_flags` — detected bias with type, excerpt, and explanation
- `coaching_suggestions` — actionable, prioritised recommendations
- `candidate_experience_notes` — candidate perspective analysis
- `_audit` — session metadata for transparency

## Ethical AI Design Principles
- **Non-punitive**: Agent output is coaching material, never a performance verdict
- **Transparent**: Every analysis includes a full audit log with session ID and timestamps
- **No data retention**: Transcripts are processed in-memory only — nothing stored
- **Bias-aware**: Actively scans for nationality, gender, age, and socioeconomic bias
- **Human-in-the-loop**: All results are advisory — human review required before any action
- **Fair to HR professionals**: Scores calibrated to reward quality, not penalise style

---

Built for JSO Phase 2 Technical Assignment · AariyaTech Corp Private Limited
