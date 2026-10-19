/* money-hub catalogue + Money Bridge contract v1 — UMD so browsers and node
   tests share one source of truth.
   The Money Bridge is a same-origin localStorage convention (no network, no
   accounts): when the hub and the three member apps run under one origin,
   they can see each other's keys. See README.md ("Money Bridge contract v1"). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MoneyHub = factory();
}(typeof self !== "undefined" ? self : this, function () {

  var PRODUCTS = [
    {
      slug: "budgetlens-ai",
      name: "BudgetLens AI",
      price: 8,
      lane: "Track spending",
      tagline: "See where your money goes — categorized spending, subscriptions, and plain-language savings nudges.",
      features: [
        "13-category keyword engine with confidence flags and one-click corrections it remembers per merchant",
        "Subscription and recurring-income detection, showing what \"$14.99/mo\" really costs per year",
        "Spending pace, savings-goal meter, duplicate and unusual-charge alerts, month-over-month trends"
      ],
      repo: "https://github.com/alexwboles/budgetlens-ai",
      connections: [
        "Exports monthly cash-flow + quantified savings opportunities to the hub ledger and to DebtPayoff's attack payment (bridge A)"
      ]
    },
    {
      slug: "debtpayoff-ai",
      name: "DebtPayoff AI",
      price: 6,
      lane: "Kill debt",
      tagline: "Your debt-free date, calculated — snowball vs. avalanche with a month-by-month payoff plan.",
      features: [
        "Snowball vs. avalanche strategy showdown: exact debt-free dates, total interest, total paid",
        "Freed minimums roll into the attack automatically; warns when a minimum doesn't cover the interest",
        "What-if tools: lump sums, debt-free-by-date reverse calculator, refinance simulator"
      ],
      repo: "https://github.com/alexwboles/debtpayoff-ai",
      connections: [
        "Reads BudgetLens's savings opportunities into your attack payment (bridge A)",
        "Feeds your debts to the hub's household ledger (bridge B)"
      ]
    },
    {
      slug: "taxprep-ai",
      name: "TaxPrep AI",
      price: 6,
      lane: "Keep it at tax time",
      tagline: "Tax season, minus the shoebox — checklists, vault, deduction tracker and deadline countdowns.",
      features: [
        "Situation-based document checklist merged and deduplicated across W-2, 1099, homeowner and investor",
        "Document vault with Missing → Received → N/A tracking, notes, and per-tax-year rollover",
        "Deduction tracker, quarterly-estimate calculator, refund/owed estimator and accountant packet"
      ],
      repo: "https://github.com/alexwboles/taxprep-ai",
      connections: [
        "Ledger neighbor: a spending → deduction-tracker bridge key is reserved for contract v2"
      ]
    }
  ];

  var BRIDGES = [
    {
      id: "A",
      name: "Spending \u2192 attack payment",
      from: "budgetlens-ai",
      to: "debtpayoff-ai",
      keys: ["budgetlens.cashflow.v1", "debtpayoff.extra.v1"],
      summary: "BudgetLens quantifies the savings its own nudges already name (subscriptions, dining, fees) and writes the monthly total to budgetlens.cashflow.v1. DebtPayoff reads it and offers it as your attack payment — \"here's where your $150/mo could come from\" — unless you've already set the slider yourself. Nothing is copied until you click."
    },
    {
      id: "B",
      name: "The household ledger",
      from: "budgetlens-ai + debtpayoff-ai",
      to: "money-hub",
      keys: ["budgetlens.cashflow.v1", "debtpayoff.debts.v1"],
      summary: "The hub reads BudgetLens's monthly cash-flow and DebtPayoff's debt list and renders one ledger: money in, money out, what's kept, total debt, monthly interest cost, and the suggested attack. Assets aren't tracked, so this is debt-vs-cash-flow, not full net worth — and it says so."
    }
  ];

  /* Keys the hub may read. Member apps may also write (see contract). */
  var CONTRACT = {
    reads: ["budgetlens.cashflow.v1", "debtpayoff.debts.v1"],
    optionalReads: ["debtpayoff.extra.v1", "debtpayoff.strategy.v1"],
    reserved: ["budgetlens.deductible_candidates.v1 (contract v2, unassigned)"]
  };

  var BUNDLE = { name: "Family Pack", price: 14, period: "/mo" };

  function getProduct(slug) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].slug === slug) return PRODUCTS[i];
    return null;
  }
  function totalSeparate() {
    return PRODUCTS.reduce(function (s, p) { return s + p.price; }, 0);
  }
  function bundleSavings() { return totalSeparate() - BUNDLE.price; }

  function round2(n) { return Math.round(n * 100) / 100; }
  function money(n) {
    var v = Number(n) || 0;
    return "$" + Math.round(v).toLocaleString("en-US");
  }
  function moneySigned(n) {
    var v = Number(n) || 0;
    return (v < 0 ? "−$" : "$") + Math.abs(Math.round(v)).toLocaleString("en-US");
  }

  /* Pure aggregation: debts (debtpayoff.debts.v1 shape) + cashflow
     (budgetlens.cashflow.v1 shape). Never touches localStorage — the
     caller passes parsed values in, so this stays testable in node. */
  function householdSummary(debts, cashflow) {
    debts = debts || [];
    var totalDebt = 0, totalMin = 0, monthlyInterest = 0;
    debts.forEach(function (d) {
      var b = Number(d.balance) || 0, apr = Number(d.apr) || 0, min = Number(d.min) || 0;
      totalDebt += b; totalMin += min; monthlyInterest += b * (apr / 100) / 12;
    });
    var s = {
      debtCount: debts.length,
      totalDebt: round2(totalDebt),
      totalMin: round2(totalMin),
      monthlyInterest: round2(monthlyInterest),
      hasCashflow: !!cashflow
    };
    if (cashflow) {
      var kept = Number(cashflow.monthlyKept) || 0;
      s.monthlyIncome = Number(cashflow.monthlyIncome) || 0;
      s.monthlySpending = Number(cashflow.monthlySpending) || 0;
      s.monthlyKept = kept;
      s.savingsRate = Number(cashflow.savingsRate) || 0;
      s.monthsAnalyzed = Number(cashflow.months) || 0;
      s.topCategories = Array.isArray(cashflow.topCategories) ? cashflow.topCategories : [];
      var atk = cashflow.attackSource || {};
      s.suggestedAttack = Number(atk.monthly) || 0;
      s.attackItems = Array.isArray(atk.items) ? atk.items : [];
      s.monthsOfKeeping = (totalDebt > 0 && kept > 0) ? Math.ceil(totalDebt / kept) : null;
    }
    return s;
  }

  /* Deep link to the sibling DebtPayoff app with the hub's suggested
     attack pre-filled (DebtPayoff honors ?attack=N on load, clamped to
     its own slider range). Resolves relative to the hub page so it works
     on shared origins (e.g. GitHub Pages project sites). */
  function attackDeepLink(attack) {
    var n = Math.max(0, Math.min(1000, Math.round(Number(attack) || 0)));
    return "../debtpayoff-ai/?attack=" + n;
  }

  function searchProducts(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return PRODUCTS.slice();
    return PRODUCTS.filter(function (p) {
      return (p.name + " " + p.tagline + " " + p.features.join(" ") + " " + p.lane).toLowerCase().indexOf(q) !== -1;
    });
  }

  return {
    PRODUCTS: PRODUCTS,
    BRIDGES: BRIDGES,
    CONTRACT: CONTRACT,
    BUNDLE: BUNDLE,
    getProduct: getProduct,
    totalSeparate: totalSeparate,
    bundleSavings: bundleSavings,
    money: money,
    moneySigned: moneySigned,
    householdSummary: householdSummary,
    attackDeepLink: attackDeepLink,
    searchProducts: searchProducts
  };
}));
