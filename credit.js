/**
 * credit.js — Credit Score Analyzer
 *
 * Estimates a CIBIL-style score (300–900) from weighted factors, following
 * the widely cited weighting used by Indian credit bureaus: payment
 * history dominates, followed by utilization, credit age, mix, and inquiries.
 */

const CREDIT_WEIGHTS = {
  paymentHistory: 0.35,
  utilization: 0.30,
  creditAge: 0.15,
  creditMix: 0.10,
  inquiries: 0.10,
};

function scorePaymentHistory(missedPayments12mo) {
  if (missedPayments12mo === 0) return 100;
  if (missedPayments12mo <= 1) return 75;
  if (missedPayments12mo <= 3) return 45;
  return 15;
}

function scoreUtilization(utilizationPct) {
  if (utilizationPct <= 10) return 100;
  if (utilizationPct <= 30) return 85;
  if (utilizationPct <= 50) return 60;
  if (utilizationPct <= 75) return 35;
  return 15;
}

function scoreCreditAge(years) {
  if (years >= 7) return 100;
  if (years >= 4) return 80;
  if (years >= 2) return 55;
  if (years >= 1) return 35;
  return 15;
}

function scoreCreditMix(activeAccountTypes) {
  if (activeAccountTypes >= 3) return 100;
  if (activeAccountTypes === 2) return 75;
  if (activeAccountTypes === 1) return 50;
  return 20;
}

function scoreInquiries(inquiries6mo) {
  if (inquiries6mo === 0) return 100;
  if (inquiries6mo <= 1) return 80;
  if (inquiries6mo <= 3) return 50;
  return 20;
}

function analyzeCreditScore(input) {
  const sub = {
    paymentHistory: scorePaymentHistory(input.missedPayments12mo),
    utilization: scoreUtilization(input.utilizationPct),
    creditAge: scoreCreditAge(input.creditAgeYears),
    creditMix: scoreCreditMix(input.activeAccountTypes),
    inquiries: scoreInquiries(input.inquiries6mo),
  };

  const weighted =
    sub.paymentHistory * CREDIT_WEIGHTS.paymentHistory +
    sub.utilization * CREDIT_WEIGHTS.utilization +
    sub.creditAge * CREDIT_WEIGHTS.creditAge +
    sub.creditMix * CREDIT_WEIGHTS.creditMix +
    sub.inquiries * CREDIT_WEIGHTS.inquiries;

  // Map weighted 0-100 score onto 300-900 CIBIL-style range
  const estimatedScore = Math.round(300 + (weighted / 100) * 600);

  let band, cls;
  if (estimatedScore >= 750) { band = "Excellent"; cls = "pass"; }
  else if (estimatedScore >= 650) { band = "Good"; cls = "pass"; }
  else if (estimatedScore >= 550) { band = "Fair"; cls = "warn"; }
  else { band = "Poor"; cls = "fail"; }

  // Identify the weakest factor to surface as the top lever
  const factorLabels = {
    paymentHistory: "on-time payment history",
    utilization: "credit utilization",
    creditAge: "credit history length",
    creditMix: "mix of credit account types",
    inquiries: "recent credit inquiries",
  };
  const weakest = Object.entries(sub).sort((a, b) => a[1] - b[1])[0][0];

  return {
    estimatedScore,
    band,
    cls,
    subscores: sub,
    weakestFactor: factorLabels[weakest],
  };
}

function localFallbackCreditInsight(input, result) {
  return `Your estimated score of ${result.estimatedScore} falls in the "${result.band}" band. The single biggest lever to move it is your ${result.weakestFactor} — improving that factor alone tends to have the largest effect on score movement over the next few reporting cycles.`;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("credit-form");
  if (!form) return;

  const resultPanel = document.getElementById("credit-result");
  const aiBody = document.getElementById("credit-ai-body");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const input = {
      missedPayments12mo: Number(form.missedPayments12mo.value),
      utilizationPct: Number(form.utilizationPct.value),
      creditAgeYears: Number(form.creditAgeYears.value),
      activeAccountTypes: Number(form.activeAccountTypes.value),
      inquiries6mo: Number(form.inquiries6mo.value),
    };

    const result = analyzeCreditScore(input);
    renderCreditResult(result);

    resultPanel.classList.add("visible");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    LoanWiseAPI.logSubmission({ tool: "credit-score", inputs: input, result });

    aiBody.textContent = "Asking Claude to break down what's driving this score…";
    aiBody.classList.add("loading");

    const insight = await LoanWiseAPI.getAIInsight({
      tool: "credit-score",
      inputs: input,
      result,
      fallback: localFallbackCreditInsight(input, result),
    });

    aiBody.textContent = insight.text;
    aiBody.classList.remove("loading");
  });
});

function renderCreditResult(result) {
  document.getElementById("credit-verdict").className = `verdict ${result.cls}`;
  document.getElementById("credit-verdict").textContent = result.band;

  document.getElementById("credit-score-num").textContent = result.estimatedScore;
  document.getElementById("credit-bar-fill").style.width = `${Math.min(((result.estimatedScore - 300) / 600) * 100, 100)}%`;
  document.getElementById("credit-weakest").textContent = result.weakestFactor;

  const table = document.getElementById("credit-breakdown");
  table.innerHTML = "";
  const labels = {
    paymentHistory: "Payment history (35%)",
    utilization: "Utilization (30%)",
    creditAge: "Credit age (15%)",
    creditMix: "Credit mix (10%)",
    inquiries: "Inquiries (10%)",
  };
  Object.entries(result.subscores).forEach(([key, val]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="font-family: var(--font-body); color: var(--text-secondary);">${labels[key]}</td><td>${val}/100</td>`;
    table.appendChild(tr);
  });
}
