/* money-hub UI — renders product cards from the shared catalogue and
   powers the household ledger console (bridges A + B). */
(function () {
  "use strict";
  var H = window.MoneyHub;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function $(id) { return document.getElementById(id); }

  /* ---------- product cards ---------- */
  function renderCards() {
    var grid = $("cards");
    grid.innerHTML = "";
    var q = $("search").value;
    var list = H.searchProducts(q);
    $("result-count").textContent = list.length === H.PRODUCTS.length
      ? H.PRODUCTS.length + " tools in the family"
      : list.length + " of " + H.PRODUCTS.length + " tools";
    if (!list.length) {
      grid.appendChild(el("p", "no-results", "No tools match that search."));
      return;
    }
    list.forEach(function (p) {
      var card = el("article", "card");
      card.appendChild(el("div", "lane", p.lane));
      card.appendChild(el("h2", null, p.name));
      card.appendChild(el("p", "tagline", p.tagline));
      var ul = el("ul", "features");
      p.features.forEach(function (f) { ul.appendChild(el("li", null, f)); });
      card.appendChild(ul);
      var conn = el("p", "conn");
      conn.innerHTML = "<b>Family link:</b> ";
      conn.appendChild(document.createTextNode(p.connections.join(" ")));
      card.appendChild(conn);
      var foot = el("div", "cardfoot");
      var price = el("span", "price", "$" + p.price);
      price.appendChild(el("small", null, "/mo Plus"));
      foot.appendChild(price);
      var actions = el("div", "card-actions");
      var a = el("a", "btn ghost", "Open repo →");
      a.href = p.repo;
      a.target = "_blank";
      a.rel = "noopener";
      actions.appendChild(a);
      foot.appendChild(actions);
      card.appendChild(foot);
      grid.appendChild(card);
    });
  }

  /* ---------- household ledger ---------- */
  function readKey(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function renderLedger() {
    var cashflow = readKey("budgetlens.cashflow.v1");
    var debts = readKey("debtpayoff.debts.v1");
    var s = H.householdSummary(debts, cashflow);
    var hasAny = !!cashflow || (debts && debts.length);

    $("ledger-empty").hidden = !!hasAny;
    $("ledger-source").innerHTML = hasAny
      ? ("sources: " + (cashflow ? "<b>budgetlens.cashflow.v1</b>" : "<b>no budget data</b>") +
         " · " + (debts && debts.length ? "<b>debtpayoff.debts.v1</b>" : "<b>no debt data</b>"))
      : "no local family data on this origin";

    if (cashflow) {
      $("l-income").textContent = H.money(s.monthlyIncome) + "/mo";
      $("l-spend").textContent = H.money(s.monthlySpending) + "/mo";
      $("l-kept").textContent = H.moneySigned(s.monthlyKept) + "/mo";
      var pct = Math.round((s.savingsRate || 0) * 100);
      $("l-rate-val").textContent = pct + "%";
      $("l-rate-bar").style.width = Math.min(100, Math.max(0, pct)) + "%";
      var tc = $("l-topcats");
      tc.innerHTML = "";
      s.topCategories.forEach(function (c) {
        tc.appendChild(el("span", "topcat", c.icon + " " + c.name + " " + H.money(c.monthly) + "/mo"));
      });
    }

    if (debts && debts.length) {
      $("l-debt").textContent = H.money(s.totalDebt);
      $("l-mins").textContent = H.money(s.totalMin) + "/mo";
      $("l-interest").textContent = H.money(s.monthlyInterest) + "/mo";
      $("l-debt-note").textContent = s.debtCount + (s.debtCount === 1 ? " debt" : " debts") +
        " on the books — interest alone costs " + H.money(s.monthlyInterest) + " every month.";
    }

    if (s.suggestedAttack > 0) {
      $("l-attack-amt").textContent = H.money(s.suggestedAttack) + "/mo";
      var ul = $("l-attack-items");
      ul.innerHTML = "";
      s.attackItems.forEach(function (it) {
        var li = el("li");
        li.appendChild(el("b", null, H.money(it.monthly) + "/mo"));
        li.appendChild(document.createTextNode(" — " + it.title + ": " + (it.detail || "")));
        ul.appendChild(li);
      });
      var apply = $("l-apply");
      apply.href = H.attackDeepLink(s.suggestedAttack);
      apply.classList.remove("disabled");
      apply.textContent = "Apply " + H.money(s.suggestedAttack) + "/mo in DebtPayoff →";
    } else {
      $("l-attack-amt").textContent = "—";
      $("l-attack-items").innerHTML = "<li>No quantified savings found yet — run BudgetLens on your transactions.</li>";
      var applyBtn = $("l-apply");
      applyBtn.classList.add("disabled");
      applyBtn.textContent = "Apply in DebtPayoff →";
    }

    var verdict = $("l-verdict");
    if (cashflow && debts && debts.length && s.monthsOfKeeping) {
      verdict.textContent = "You're keeping " + H.money(s.monthlyKept) + "/mo against " +
        H.money(s.totalDebt) + " of debt. At that pace the principal alone is ~" +
        s.monthsOfKeeping + " months of keeping — before interest. That's what the attack is for.";
    } else if (cashflow) {
      verdict.textContent = "You're keeping " + H.moneySigned(s.monthlyKept) + "/mo. No debts on the books — the ledger balances.";
    } else if (debts && debts.length) {
      verdict.textContent = "Debt side loaded. Add BudgetLens cash-flow data and the ledger gets its other half.";
    } else {
      verdict.textContent = "";
    }
  }

  /* ---------- family pack ---------- */
  function renderPack() {
    $("separate-price").textContent = "$" + H.totalSeparate() + "/mo";
    $("pack-price").textContent = "$" + H.BUNDLE.price + "/mo";
    $("pack-save").textContent = "Save $" + H.bundleSavings() + "/mo vs. separate Plus plans";
    $("pack-name").textContent = H.BUNDLE.name;
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderCards();
    renderLedger();
    renderPack();
    $("search").addEventListener("input", renderCards);
    /* Re-read the ledger if sibling apps wrote while this tab was open. */
    window.addEventListener("storage", renderLedger);
    window.addEventListener("focus", renderLedger);
  });
})();
