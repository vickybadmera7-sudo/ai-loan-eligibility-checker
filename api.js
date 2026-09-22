/**
 * api.js
 * Single connector to the project's backend: a Google Apps Script Web App
 * (see /apps-script/Code.gs) that does two jobs:
 *   1. Calls the Anthropic Claude API server-side and returns the insight
 *      text — so the API key lives only in Apps Script's Script Properties,
 *      never in this client-side code or in the GitHub repo.
 *   2. Appends each submission to a Google Sheet for record-keeping.
 *
 * Set APPS_SCRIPT_URL below to your deployed Web App URL once you've
 * followed the setup steps in apps-script/Code.gs and README.md.
 */

const LoanWiseAPI = (() => {
  // TODO: replace with your deployed Apps Script Web App URL
  // e.g. "https://script.google.com/macros/s/AKfycb.../exec"
  const APPS_SCRIPT_URL = "";

  const isConfigured = () => Boolean(APPS_SCRIPT_URL);

  /**
   * Ask Claude for a short, plain-language insight based on structured
   * inputs and a computed result. Falls back to a local, rule-based
   * message if no backend is configured yet, so every tool still works
   * out of the box before Claude AI is wired up.
   */
  async function getAIInsight({ tool, inputs, result, fallback }) {
    if (!isConfigured()) {
      return { text: fallback, source: "local" };
    }

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "ai_insight", tool, inputs, result }),
      });

      if (!response.ok) throw new Error(`Backend returned ${response.status}`);

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      return { text: data.text, source: "claude" };
    } catch (err) {
      console.error("LoanWiseAPI.getAIInsight failed:", err);
      return { text: fallback, source: "local", error: true };
    }
  }

  /**
   * Log a tool submission to Google Sheets. Silent no-op if the backend
   * isn't configured — never blocks the user-facing calculation.
   */
  async function logSubmission({ tool, inputs, result }) {
    if (!isConfigured()) return { logged: false };

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "log_submission",
          tool,
          inputs,
          result,
          timestamp: new Date().toISOString(),
        }),
      });
      return { logged: true };
    } catch (err) {
      console.error("LoanWiseAPI.logSubmission failed:", err);
      return { logged: false, error: true };
    }
  }

  return { isConfigured, getAIInsight, logSubmission };
})();
