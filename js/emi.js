/**
 * emi.js — EMI Calculator
 *
 * Standard reducing-balance EMI formula with full amortization schedule
 * and a live update on every input change (not just on submit) since this
 * tool is exploratory by nature.
 */

function computeEMIDetails(principal, annualRatePct, tenureMonths) {
  const r = annualRatePct / 12 / 100;
  const emi =
    r === 0
      ? principal / tenureMonths
      : (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);

  const totalPayment = emi * tenureMonths;
  const totalInterest = totalPayment - principal;

  // Build a compact yearly amortization summary (not month-by-month, for readability)
  let balance = principal;
  const yearly = [];
  let yearPrincipal = 0;
  let yearInterest = 0;

  for (let m = 1; m <= tenureMonths; m++) {
    const interestPortion = balance * r;
    const principalPortion = emi - interestPortion;
    balance -= principalPortion;
    yearPrincipal += principalPortion;
    yearInterest += interestPortion;

    if (m % 12 === 0 || m === tenureMonths) {
      yearly.push({
        year: Math.ceil(m / 12),
        principalPaid: Math.round(yearPrincipal),
        interestPaid: Math.round(yearInterest),
        balance: Math.max(Math.round(balance), 0),
      });
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }

  return {
    emi: Math.round(emi),
    totalPayment: Math.round(totalPayment),
    totalInterest: Math.round(totalInterest),
    yearly,
  };
}

function localFallbackEMIInsight(input, result) {
  const interestShare = Math.round((result.totalInterest / result.totalPayment) * 100);
  return `Over ${input.tenureMonths} months, interest makes up ${interestShare}% of your total repayment. Shortening the tenure or making occasional prepayments toward the principal in the early years would cut this interest share the most, since reducing-balance loans front-load interest.`;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("emi-form");
  if (!form) return;

  const resultPanel = document.getElementById("emi-result");
  const aiBody = document.getElementById("emi-ai-body");

  function recalculate() {
    const input = {
      principal: Number(form.principal.value),
      annualRatePct: Number(form.annualRatePct.value),
      tenureMonths: Number(form.tenureMonths.value),
    };
    if (!input.principal || !input.annualRatePct || !input.tenureMonths) return null;

    const result = computeEMIDetails(input.principal, input.annualRatePct, input.tenureMonths);
    renderEMIResult(result);
    resultPanel.classList.add("visible");
    return { input, result };
  }

  // Live recalculation as the user adjusts sliders/inputs
  ["principal", "annualRatePct", "tenureMonths"].forEach((name) => {
    form[name].addEventListener("input", () => {
      document.getElementById(`${name}-echo`).textContent = form[name].value;
      recalculate();
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = recalculate();
    if (!data) return;

    const { input, result } = data;
    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    LoanWiseAPI.logSubmission({ tool: "emi-calculator", inputs: input, result });

    aiBody.textContent = "Asking Claude for a repayment strategy tip…";
    aiBody.classList.add("loading");

    const insight = await LoanWiseAPI.getAIInsight({
      tool: "emi-calculator",
      inputs: input,
      result,
      fallback: localFallbackEMIInsight(input, result),
    });

    aiBody.textContent = insight.text;
    aiBody.classList.remove("loading");
  });

  // Initial render on load with default values
  recalculate();
});

function renderEMIResult(result) {
  document.getElementById("emi-amount").textContent = `₹${result.emi.toLocaleString("en-IN")}`;
  document.getElementById("emi-total-payment").textContent = `₹${result.totalPayment.toLocaleString("en-IN")}`;
  document.getElementById("emi-total-interest").textContent = `₹${result.totalInterest.toLocaleString("en-IN")}`;

  const table = document.getElementById("emi-schedule");
  table.innerHTML = "";
  result.yearly.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>Yr ${row.year}</td>
      <td>₹${row.principalPaid.toLocaleString("en-IN")}</td>
      <td>₹${row.interestPaid.toLocaleString("en-IN")}</td>
      <td>₹${row.balance.toLocaleString("en-IN")}</td>`;
    table.appendChild(tr);
  });
}
