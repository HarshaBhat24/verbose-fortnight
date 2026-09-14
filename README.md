# Pentest Interview Prep

Stateless technical interview simulator for Penetration Testing, VAPT, Active Directory, Cloud, and CTF prep. Primary model: Gemini 2.5 Pro (free), fallback: Groq (free).

No database required — your frontend holds session state in client memory and re-sends history on each turn.

---

## 🚀 Quick Start (Local Setup)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Keys
Create a `.env` file in the root directory (or copy from `.env.example`):
```bash
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```
> **Get Free Keys:**
> - **Gemini API Key:** [Google AI Studio](https://aistudio.google.com/) (free tier)
> - **Groq API Key:** [Console Groq](https://console.groq.com/) (free tier)

### 3. Run Locally
```bash
npm run dev
```
Open your browser at **`http://localhost:3000`**.

---

## 📁 Repository Structure

```
├── public/
│   ├── index.html        # Single-page frontend application
│   ├── style.css         # Dark cybersecurity UI theme
│   └── app.js            # In-memory stateless flow & API client
├── api/
│   └── interview/
│       ├── start.js      # POST { description } -> classifies scope & returns first question
│       └── turn.js       # POST { types, userContextSummary, history, latestAnswer } -> grade & next question
├── lib/
│   ├── rubrics.js        # Rubric definitions & turn prompt templates
│   ├── modelClient.js    # Gemini 2.5 Pro primary / Groq fallback model handler
│   └── http.js           # CORS & HTTP response helpers
├── server.js             # Local Express runner for dev environment
├── vercel.json           # Vercel serverless function configuration
└── package.json
```

---

## ☁️ Deploying to Vercel

1. Push your repository to GitHub.
2. Import the repository into the **Vercel Dashboard**.
3. Under **Project Settings → Environment Variables**, add:
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
4. Click **Deploy**. Vercel will automatically serve the frontend from `public/` and route API calls to `api/interview/`.

---

## 📝 API Endpoints

### `POST /api/interview/start`
- **Request Body:** `{ "description": "Conducted a web app pentest..." }`
- **Response:** `{ "types": ["web_app"], "userContextSummary": "...", "firstTurn": { "next_question": "..." }, "modelUsed": "gemini-2.5-pro" }`

### `POST /api/interview/turn`
- **Request Body:**
  ```json
  {
    "types": ["web_app"],
    "userContextSummary": "...",
    "history": [
      { "question": "...", "answer": "..." }
    ],
    "latestAnswer": "Candidate response..."
  }
  ```
- **Response:** `{ "result": { "rubric_item_addressed": "...", "verdict": "correct", "why_wrong": null, "what_a_strong_answer_includes": "...", "next_question": "..." }, "modelUsed": "gemini-2.5-pro" }`
