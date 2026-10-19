# Money Hub — Redesign Audit (v2, 2026-10-19)

## What was preserved (from N1, 2026-10-19 — non-negotiable)
- Household-ledger identity: paper background, ink serif, bank-green accent, hairline rules, zero rounded edges.
- Live household-ledger console reading `budgetlens.cashflow.v1` + `debtpayoff.debts.v1` via pure `MoneyHub.householdSummary()`.
- Bridge A (BudgetLens → DebtPayoff attack payment hint + `?attack=N` deep link), Bridge B (hub ledger, honestly labeled "debt vs. cash-flow, not net worth").
- Bridge cards, 3 product cards with family links, Family Pack card (vision pricing), Money Bridge contract v1 in README.
- Same-origin localStorage convention, no accounts, no sync, nothing leaves the browser.

## Competitors studied
- **YNAB** (reviews via usatoday.com, thepennyhoarder.com, marriagekidsandmoney.com): Income-vs-Expense report (income on top, expenses below), category targets with rollover, reports that surface "aha" moments, Age of Money (how long money sits before being spent — a forward-looking health metric), CSV export for granular analysis.
- **Monarch Money** (reviews via envelopebudgeting.com, personalone.org, robberger.com, priori.dev): modular dashboard "command center", net-worth sparkline trend, **Sankey cash-flow diagram** (frequently cited "delight factor" — see exactly where income flows), recurring-bills calendar for cash-flow forecasting, colorful immediately-legible charts, reports sliceable by merchant/category/group and month/quarter/year.
- **EveryDollar** (reviews via lendedu.com, sawahits.com, savingscotts.com): zero-based budgeting, per-category countdown trackers (spend bar shrinks as you spend, turns red when over), **Baby Steps roadmap** showing where you are in a 7-step journey, pie chart of where money goes.

## 4–6 layout/IA/visual patterns worth borrowing
1. **Money-flow visualization** (Monarch's Sankey, YNAB's Income-vs-Expense): the hub only shows numbers. A flow diagram — income → spending / kept → attack → debts, with interest cost as a visible "leak" — makes the bridges legible at a glance.
2. **Trend over time, not a single snapshot** (Monarch's net-worth sparkline, YNAB's trend reports): the ledger is currently one point in time. Recording daily hub-owned snapshots and rendering a debt-vs-kept sparkline gives the "am I getting somewhere?" answer competitors provide.
3. **Forward-looking health metrics** (YNAB's Age of Money, Monarch's cash-flow projection): "kept" is backward-looking. Derive buffer pace (how fast savings accumulate), savings-rate benchmark bands, and months-to-cover-debt from existing data — without re-running DebtPayoff's projections (contract boundary: payoff math stays in DebtPayoff).
4. **A roadmap/journey strip** (EveryDollar's Baby Steps): households want to know where they stand. A 4-step household roadmap derived from real data (flow connected → debts inventoried → attack funded → trajectory healthy) makes progress tangible.
5. **Per-category countdown trackers** (EveryDollar): the ledger's top-categories chips are dead text. Turn them into spending-share bars — proportion of income per category, visually weighted.
6. **Trust through honest accounting + printability**: competitors monetize trust signals (bank-grade security claims). Our trust signal is honesty: "debt vs. cash-flow, not net worth" labels, plus a paper-ledger artifact — a "Print this ledger" action fits the identity perfectly and costs nothing.

## Top functional gaps vs. competitors (closed in this redesign)
1. **No visualization of money flow** → new SVG "Money in motion" flow diagram (income → spent / kept → attack → debts, interest as leak). [Monarch Sankey pattern]
2. **No history / no trend** → hub-owned `moneyhub.ledger_history.v1` snapshots (one per day, 24 kept) + debt-vs-kept sparkline with "debt shrinking" verdict. [Monarch sparkline pattern]
3. **No health benchmarks** → vitals row: savings-rate band vs. plain benchmarks, 12-month kept projection, months-to-cover-debt (kept pace, clearly not a payoff plan). [YNAB Age-of-Money pattern]
4. **No sense of journey** → 4-step household roadmap driven by real data states. [EveryDollar Baby Steps pattern]
- Deliberately NOT closed: full net-worth with assets (no member app tracks assets — would require fabricating data), tax bridge code (contract v2, needs taxonomy mapping that doesn't exist).

## New distinctive visual identity
Extend — not replace — the household-ledger direction: **an open bank ledger on paper**. Editorial serif masthead with a "statement date" line, the ledger console as a two-page open spread (left page: cash flow, right page: debts) with a bank-green "memo slip" pinned across the fold for the attack, double-rule section headers, ruled money lines with mono figures, a stitched-paper family-pack panel. The flow diagram is drawn as a teller's chalk-style SVG in bank green/ink on paper. Sharp geometry throughout, zero border-radius, no gradients, generous whitespace, restrained motion (a slow bar ease, a blinking "live" dot).
