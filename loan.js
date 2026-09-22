/**
 * loan.js — AI Loan Eligibility Checker
 *
 * Rule-based eligibility engine. Rules are transparent and adjustable
 * (see LOAN_RULES) rather than a black box, which matters for a BFSI tool.
 */

const LOAN_RULES = {
  minAge: 21,
  maxAge: 60,
  minMonthlyIncome: 15000, // INR
  maxFOIR: 0.5, // Fixed Obligation to Income Ratio ceiling
  minCreditScore: 650,
  watchCreditScore: 550,
  assumedAnnualRate: 0.11, // used only to size max eligible loan
};

function calculateEMI(principal, annualRatePct, tenureMonths) {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (principal * r * factor) / (factor - 1);
}

function maxEligiblePrincipal(maxAffordableEMI, annualRatePct, tenureMonths) {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return maxAffordableEMI * tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (maxAffordableEMI * (factor - 1)) / (r * factor);
}

function assessLoanEligibility(input) {
  const {
    age,
    employmentType,
    monthlyIncome,
    existingEMIs,
    requestedAmount,
    tenureMonths,
    creditScore,
  } = input;

  const reasons = [];
  let hardFail = false;

  // Age check
  if (age < LOAN_RULES.minAge || age > LOAN_RULES.maxAge) {
    reasons.push({ type: "neg", text: `Age ${age} is outside the ${LOAN_RULES.minAge}–${LOAN_RULES.maxAge} eligible range.` });
    hardFail = true;
  } else {
    reasons.push({ type: "pos", text: `Age ${age} is within the eligible range.` });
  }

  // Income check
  if (monthlyIncome < LOAN_RULES.minMonthlyIncome) {
    reasons.push({ type: "neg", text: `Monthly income is below the ₹${LOAN_RULES.minMonthlyIncome.toLocaleString("en-IN")} minimum.` });
    hardFail = true;
  } else {
    reasons.push({ type: "pos", text: `Monthly income meets the minimum threshold.` });
  }

  // FOIR check
  const proposedEMI = calculateEMI(requestedAmount, LOAN_RULES.assumedAnnualRate * 100, tenureMonths);
  const totalObligation = existingEMIs + proposedEMI;
  const foir = totalObligation / monthlyIncome;

  if (foir > LOAN_RULES.maxFOIR) {
    reasons.push({ type: "neg", text: `Total EMI obligation would be ${(foir * 100).toFixed(0)}% of income — above the ${LOAN_RULES.maxFOIR * 100}% safe limit.` });
  } else {
    reasons.push({ type: "pos", text: `Total EMI obligation is a manageable ${(foir * 100).toFixed(0)}% of income.` });
  }

  // Credit score check
  let creditVerdict = "pos";
  if (creditScore < LOAN_RULES.watchCreditScore) {
    reasons.push({ type: "neg", text: `Credit score of ${creditScore} is in the high-risk band (below ${LOAN_RULES.watchCreditScore}).` });
    creditVerdict = "neg";
    hardFail = true;
  } else if (creditScore < LOAN_RULES.minCreditScore) {
    reasons.push({ type: "neu", text: `Credit score of ${creditScore} is borderline — approval likely needs manual underwriting.` });
    creditVerdict = "neu";
  } else {
    reasons.push({ type: "pos", text: `Credit score of ${creditScore} is in a healthy band.` });
  }

  // Employment stability signal (soft factor)
  if (employmentType === "self-employed") {
    reasons.push({ type: "neu", text: "Self-employed applicants may be asked for 2 years of ITR as additional documentation." });
  }

  // Verdict
  let verdict = "pass";
  if (hardFail || foir > LOAN_RULES.maxFOIR) verdict = "fail";
  else if (creditVerdict === "neu") verdict = "warn";

  // Max eligible amount at this income, assuming safe FOIR headroom
  const affordableEMI = Math.max(monthlyIncome * LOAN_RULES.maxFOIR - existingEMIs, 0);
  const maxEligible = maxEligiblePrincipal(affordableEMI, LOAN_RULES.assumedAnnualRate * 100, tenureMonths);

  return {
    verdict,
    foirPct: Math.round(foir * 100),
    proposedEMI: Math.round(proposedEMI),
    maxEligibleAmount: Math.round(maxEligible),
    reasons,
  };
}

function verdictLabel(v) {
  if (v === "pass") return { label: "Likely Eligible", cls: "pass" };
  if (v === "warn") return { label: "Conditionally Eligible", cls: "warn" };
  return { label: "Not Eligible", cls: "fail" };
}

function localFallbackInsight(input, result) {
  if (result.verdict === "pass") {
    return `Based on your ${input.monthlyIncome.toLocaleString("en-IN")} monthly income and a FOIR of ${result.foirPct}%, you're well within safe lending limits. You could potentially borrow up to ₹${result.maxEligibleAmount.toLocaleString("en-IN")} at similar terms — consider whether the requested amount leaves enough monthly buffer for emergencies.`;
  }
  if (result.verdict === "warn") {
    return `Your application sits in a borderline band, most likely due to credit score or obligation ratio. Lenders may approve this with additional documentation, a co-applicant, or a smaller loan amount closer to ₹${result.maxEligibleAmount.toLocaleString("en-IN")}.`;
  }
  return `This application doesn't currently meet standard eligibility rules. The biggest lever is usually reducing existing EMI obligations or improving credit score before reapplying — a smaller requested amount may also help.`;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loan-form");
  if (!form) return;

  const resultPanel = document.getElementById("loan-result");
  const aiBody = document.getElementById("loan-ai-body");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const input = {
      age: Number(form.age.value),
      employmentType: form.employmentType.value,
      monthlyIncome: Number(form.monthlyIncome.value),
      existingEMIs: Number(form.existingEMIs.value || 0),
      requestedAmount: Number(form.requestedAmount.value),
      tenureMonths: Number(form.tenureMonths.value),
      creditScore: Number(form.creditScore.value),
    };

    const result = assessLoanEligibility(input);
    renderLoanResult(input, result);

    resultPanel.classList.add("visible");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    LoanWiseAPI.logSubmission({ tool: "loan-eligibility", inputs: input, result });

    aiBody.textContent = "Consulting Claude for a personalized read on this application…";
    aiBody.classList.add("loading");

    const insight = await LoanWiseAPI.getAIInsight({
      tool: "loan-eligibility",
      inputs: input,
      result,
      fallback: localFallbackInsight(input, result),
    });

    aiBody.textContent = insight.text;
    aiBody.classList.remove("loading");
  });
});

function renderLoanResult(input, result) {
  const v = verdictLabel(result.verdict);
  document.getElementById("loan-verdict").className = `verdict ${v.cls}`;
  document.getElementById("loan-verdict").textContent = v.label;

  document.getElementById("loan-emi").textContent = `₹${result.proposedEMI.toLocaleString("en-IN")}`;
  document.getElementById("loan-foir").textContent = `${result.foirPct}%`;
  document.getElementById("loan-max").textContent = `₹${result.maxEligibleAmount.toLocaleString("en-IN")}`;

  const list = document.getElementById("loan-reasons");
  list.innerHTML = "";
  result.reasons.forEach((r) => {
    const li = document.createElement("li");
    li.className = r.type;
    li.innerHTML = `<span class="dot"></span><span>${r.text}</span>`;
    list.appendChild(li);
  });
}
