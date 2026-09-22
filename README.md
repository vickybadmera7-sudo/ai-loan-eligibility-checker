# LoanWise — AI Loan Eligibility Checker

An AI-powered BFSI web platform for instant financial decisioning: loan eligibility, credit score analysis, EMI planning, and personalized financial guidance — built as a capstone project for the AI Specialist (BFSI) track.

**Live demo:** https://6ab25aa8e361861925c7d053--cute-fenglisu-f4734a.netlify.app/loan-eligibility

## Modules

| Module | What it does |
|---|---|
| **Loan Eligibility Checker** | Runs applicant details through a transparent rule engine (age, income, FOIR, credit score) and returns a pass / conditional / fail verdict with a computed borrowing ceiling. |
| **Credit Score Analyzer** | Estimates a 300–900 score from five weighted factors (payment history, utilization, credit age, credit mix, inquiries) and identifies the single biggest lever to improve it. |
| **EMI Calculator** | Live reducing-balance EMI calculation with a year-by-year amortization breakdown, updating as inputs change. |
| **AI Financial Tips** | Builds a short financial profile (income, expenses, debt, savings, goal) and returns prioritized, specific guidance. |

Every module pairs its rule-based / formula-based result with a short **Claude AI insight** that explains the number in plain language.

## Tech stack

- HTML5, CSS3 (custom properties, no framework), vanilla JavaScript
- Anthropic Claude API for AI-generated insights
- Google Sheets (via Google Apps Script) for submission logging
- Deployable as a static site (Netlify / Vercel)

## Project structure

```
loanwise/
├── index.html                 Landing page / dashboard
├── loan-eligibility.html
├── credit-score.html
├── emi-calculator.html
├── financial-tips.html
├── css/
│   └── styles.css             Design tokens, glassmorphism components, layout
├── js/
│   ├── main.js                Shared nav / footer behaviour
│   ├── api.js                 Connector to the Apps Script backend
│   ├── loan.js                Loan eligibility rule engine
│   ├── credit.js              Credit score weighting model
│   ├── emi.js                 EMI formula + amortization schedule
│   └── tips.js                Financial profile + tip generation
├── apps-script/
│   └── Code.gs                Backend: proxies Claude API, logs to Sheets
└── README.md
```

## Why the backend is a Google Apps Script, not client-side calls

The Claude API key and the Google Sheet ID never appear in this repository or in the browser. `apps-script/Code.gs` runs server-side inside Google's infrastructure, holds both secrets in **Script Properties**, and exposes a single POST endpoint that the frontend calls for two actions: `ai_insight` and `log_submission`. This keeps the project genuinely deployable to a public GitHub repo without leaking credentials — a plain client-side `fetch` straight to the Anthropic API would expose the key to anyone who opens dev tools.

## Setup

### 1. Google Sheet + Apps Script backend

1. Create a new Google Sheet. Copy its ID from the URL (the long string between `/d/` and `/edit`).
2. Open **Extensions → Apps Script**, delete the placeholder code, and paste in the contents of `apps-script/Code.gs`.
3. Go to **Project Settings → Script Properties** and add:
   - `CLAUDE_API_KEY` — your Anthropic API key
   - `SHEET_ID` — the Sheet ID from step 1
4. **Deploy → New deployment → Web app.** Set "Execute as" to *Me* and "Who has access" to *Anyone*. Deploy and copy the `/exec` URL.

### 2. Connect the frontend

Open `js/api.js` and set:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
```

Without this, every module still works fully — calculations run locally and each AI panel shows a rule-based fallback insight instead of a Claude-generated one.

### 3. Run locally

No build step. Open `index.html` in a browser, or serve the folder with any static server (e.g. the VS Code "Live Server" extension, or `npx serve`).

### 4. Deploy

Push this folder to a GitHub repository, then connect it to **Netlify** or **Vercel** as a static site (no build command needed, publish directory = repo root).

## Notes on scope

- Rule thresholds in `loan.js` (`LOAN_RULES`) and weightings in `credit.js` (`CREDIT_WEIGHTS`) are intentionally exposed as named constants rather than hardcoded inline, so lending policy can be adjusted without touching the calculation logic.
- All figures produced by this tool are estimates for planning purposes only and are not a lending decision or an official credit bureau score.

## Roadmap

- User authentication and saved profile history
- Backend-side ML model for eligibility scoring, replacing the rule engine as more data accumulates
- Exportable PDF summary per module
