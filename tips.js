/**
 * tips.js — AI Financial Tips
 *
 * Builds a short financial profile from the form, sends it to Claude for
 * 4 personalized tips, and falls back to a curated (still profile-aware)
 * static set if the backend isn't configured yet.
 */

const CURATED_TIP_LIBRARY = [
  {
    cat: "Emergency fund",
    test: (p) => p.savingsMonths < 3,
    text: (p) => `You have roughly ${p.savingsMonths.toFixed(1)} months of expenses saved. Aim for 3–6 months in a liquid instrument before directing surplus toward other goals.`,
  },
  {
    cat: "Debt load",
    test: (p) => p.debtToIncome > 0.4,
    text: (p) => `Your monthly debt payments take up ${Math.round(p.debtToIncome * 100)}% of income. Prioritize paying down the highest-interest debt first before increasing investment contributions.`,
  },
  {
    cat: "Savings rate",
    test: (p) => p.savingsRate < 0.15,
    text: (p) => `You're currently saving about ${Math.round(p.savingsRate * 100)}% of income. Even a 5-point increase, automated right after payday, compounds meaningfully over a decade.`,
  },
  {
    cat: "Savings rate",
    test: (p) => p.savingsRate >= 0.15,
    text: (p) => `A ${Math.round(p.savingsRate * 100)}% savings rate is solid. Consider whether idle savings beyond your emergency fund should move into higher-yield instruments matched to your goal's timeline.`,
  },
  {
    cat: "Goal pacing",
    test: (p) => p.goalAmount > 0 && p.monthsToGoal,
    text: (p) => `At your current surplus, reaching ₹${p.goalAmount.toLocaleString("en-IN")} will take about ${p.monthsToGoal} months. Small recurring increases to the monthly set-aside shorten this faster than one-off lump sums.`,
  },
  {
    cat: "General",
    test: () => true,
    text: () => `Review recurring subscriptions and fixed costs quarterly — they tend to drift upward unnoticed and are the easiest lever to reclaim monthly surplus.`,
  },
];

function buildProfile(input) {
  const surplus = input.monthlyIncome - input.monthlyExpenses - input.monthlyDebtPayments;
  const savingsRate = surplus > 0 ? surplus / input.monthlyIncome : 0;
  const savingsMonths = input.monthlyExpenses > 0 ? input.currentSavings / input.monthlyExpenses : 0;
  const debtToIncome = input.monthlyDebtPayments / input.monthlyIncome;
  const monthsToGoal =
    input.goalAmount > 0 && surplus > 0 ? Math.ceil(input.goalAmount / surplus) : null;

  return { ...input, surplus, savingsRate, savingsMonths, debtToIncome, monthsToGoal };
}

function curatedTips(profile) {
  return CURATED_TIP_LIBRARY.filter((t) => t.test(profile))
    .slice(0, 4)
    .map((t) => ({ cat: t.cat, text: t.text(profile) }));
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("tips-form");
  if (!form) return;

  const resultPanel = document.getElementById("tips-result");
  const grid = document.getElementById("tips-grid");
  const aiBody = document.getElementById("tips-ai-body");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const input = {
      monthlyIncome: Number(form.monthlyIncome.value),
      monthlyExpenses: Number(form.monthlyExpenses.value),
      monthlyDebtPayments: Number(form.monthlyDebtPayments.value || 0),
      currentSavings: Number(form.currentSavings.value || 0),
      goalAmount: Number(form.goalAmount.value || 0),
    };

    const profile = buildProfile(input);
    const fallbackTips = curatedTips(profile);

    renderTips(grid, fallbackTips);
    resultPanel.classList.add("visible");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    LoanWiseAPI.logSubmission({ tool: "financial-tips", inputs: input, result: profile });

    aiBody.textContent = "Asking Claude to tailor these tips to your numbers…";
    aiBody.classList.add("loading");

    const insight = await LoanWiseAPI.getAIInsight({
      tool: "financial-tips",
      inputs: input,
      result: profile,
      fallback: fallbackTips.map((t) => `${t.cat}: ${t.text}`).join("\n\n"),
    });

    aiBody.textContent = insight.text;
    aiBody.classList.remove("loading");
  });
});

function renderTips(grid, tips) {
  grid.innerHTML = "";
  tips.forEach((tip) => {
    const div = document.createElement("div");
    div.className = "tip-card glass";
    div.innerHTML = `<div class="cat">${tip.cat}</div><p>${tip.text}</p>`;
    grid.appendChild(div);
  });
}
