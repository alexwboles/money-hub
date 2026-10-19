# Money Hub — Personal-Money Family

Three independent money tools for the individual, not the business:
[BudgetLens AI](https://github.com/alexwboles/budgetlens-ai) · [DebtPayoff AI](https://github.com/alexwboles/debtpayoff-ai) · [TaxPrep AI](https://github.com/alexwboles/taxprep-ai)

Money Hub is the household ledger that ties them together: a live console that
reads BudgetLens cash-flow and DebtPayoff debts from the same origin, a
money-flow diagram, savings vitals, a day-by-day trajectory, and a roadmap —
plus the bridge cards and the Family Pack. Free to run, local-first, open
source. Educational math, not financial or tax advice.

Run it: serve this folder with any static server (`python3 -m http.server`) and
open `index.html`. For the ledger to fill in, BudgetLens and DebtPayoff must run
under the **same origin** (e.g. GitHub Pages project pages, or sibling folders
on one local server).

## Money Bridge contract v1

The bridges are a **same-origin localStorage convention** — no network, no
accounts, no sync. Each member app writes its own keys; the hub reads them.
Everything works standalone if the keys are absent.

### Keys the hub reads

- `budgetlens.cashflow.v1` — written by BudgetLens on every analysis:
  `{updatedAt, months, monthlyIncome, monthlySpending, monthlyKept, savingsRate,
  topCategories: [{id, name, icon, monthly}], attackSource: {monthly, items: [{title, monthly, detail}]}}`
- `debtpayoff.debts.v1` — written by DebtPayoff: array of
  `{id, name, balance, apr, min[, deadline]}`

### Optional keys the hub may read

- `debtpayoff.extra.v1` — the attack payment DebtPayoff actually adopted.
- `debtpayoff.strategy.v1` — `"snowball"` or `"avalanche"`.

### Hub-owned key (not part of the contract)

- `moneyhub.ledger_history.v1` — written and read by the hub only: one ledger
  snapshot per day (`{d, kept, debt, attack}`, last 24), powering the trajectory
  chart. Member apps never need to know about it.

### Reserved for contract v2

- `budgetlens.deductible_candidates.v1` — spending → TaxPrep deduction-tracker
  bridge. Unassigned; needs a category-to-deduction taxonomy that doesn't exist yet.

### Bridge A — Spending → attack payment

BudgetLens quantifies the savings its own nudges already name and writes the
monthly total to `budgetlens.cashflow.v1`. DebtPayoff reads it and offers it as
the attack payment ("here's where your $150/mo could come from") — only if the
attack slider is untouched, dismissable, nothing copied until clicked. The hub
also deep-links: `../debtpayoff-ai/?attack=N` (DebtPayoff honors `?attack=N` on
load, clamped to its slider range). Pure helper: `MoneyHub.attackDeepLink(n)`.

### Bridge B — The household ledger

The hub aggregates both keys via the pure, node-testable
`MoneyHub.householdSummary(debts, cashflow)` and renders the ledger. Assets are
not tracked, so the hub says so plainly: **debt vs. cash-flow, not net worth**.
Payoff projections stay in DebtPayoff — the hub never re-runs the math.

## What the hub computes (all pure in `js/data.js`, all node-tested)

- `householdSummary(debts, cashflow)` — totals, monthly interest cost, suggested
  attack, months of kept income to cover the principal.
- `appendSnapshot(history, summary, dateKey)` — one snapshot per day, 24 kept.
- `trend(history)` — debt delta, average kept, "debt shrinking" verdict.
- `savingsBand(rate)` — plain-language pace label (Excellent / Healthy /
  Building / Breaking even / Spending above income).
- `roadmap(summary, history)` — four data-driven household milestones.
- `searchProducts(q)` — catalogue search; `money` / `moneySigned` formatting.

## Files

- `index.html` — the hub page (ledger console, flow diagram, vitals, trajectory,
  roadmap, bridge cards, product cards, Family Pack).
- `css/style.css` — "open ledger" identity: warm paper, ink serif, bank-green
  accent. No border-radius, no color gradients.
- `js/data.js` — UMD catalogue + bridge contract + pure math (browser and node
  share one source of truth).
- `js/app.js` — rendering.
- `REDESIGN-AUDIT.md` — competitor research (YNAB, Monarch Money, EveryDollar),
  gaps closed, identity rationale.
- `test/smoke.sh`, `test/e2e.sh` — suites; green before every push.
