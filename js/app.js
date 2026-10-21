/* money-hub UI — renders product cards from the shared catalogue, powers
   the household ledger console (bridges A + B), the money-flow diagram,
   health vitals, ledger history and the household roadmap. */
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
  var readProblems = Object.create(null), writeProblems = Object.create(null);
  function object(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function numeric(value) {
    return (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) &&
      Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER / 100;
  }
  function validStoredValue(key, value) {
    if (key === H.LS_HISTORY) return Array.isArray(value) && value.every(function (p) {
      return object(p) && typeof p.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.d) &&
        numeric(p.kept) && numeric(p.debt) && numeric(p.attack);
    });
    if (value === null) return true;
    if (key === "debtpayoff.debts.v1") return Array.isArray(value) && value.every(function (d) {
      return object(d) && ["balance", "apr", "min"].every(function (field) {
        return numeric(d[field]) && Number(d[field]) >= 0;
      });
    });
    if (key === "budgetlens.cashflow.v1") return object(value) &&
      ["monthlyIncome", "monthlySpending", "monthlyKept", "savingsRate"].every(function (k) { return numeric(value[k]); }) &&
      (!value.topCategories || (Array.isArray(value.topCategories) && value.topCategories.every(function (c) { return object(c) && numeric(c.monthly); }))) &&
      (!value.attackSource || (object(value.attackSource) && numeric(value.attackSource.monthly) &&
        (!value.attackSource.items || (Array.isArray(value.attackSource.items) && value.attackSource.items.every(function (i) { return object(i) && numeric(i.monthly); })))));
    return true;
  }
  function readKey(key) {
    try {
      var raw = localStorage.getItem(key);
      var value = raw === null ? null : JSON.parse(raw);
      if (raw !== null && !validStoredValue(key, value)) throw new Error("Unsupported saved-data shape");
      delete readProblems[key];
      return value;
    } catch (e) { readProblems[key] = true; return null; }
  }
  function writeKey(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); delete writeProblems[key]; return true; }
    catch (e) { writeProblems[key] = true; return false; }
  }
  function renderDataStatus() {
    var status = $("data-status"), unreadable = Object.keys(readProblems), unsaved = Object.keys(writeProblems);
    var incomplete = state.hasData && !state.hasCompleteData;
    status.hidden = !unreadable.length && !unsaved.length && !incomplete;
    status.textContent = (unreadable.length ? "Saved data is unavailable or invalid: " + unreadable.join(", ") +
      ". Original stored values have not been replaced. History is paused while connected inputs are unreadable. " : "") +
      (unsaved.length ? "History could not be saved. Today's snapshot is not recorded; earlier stored data is unchanged. " : "") +
      (incomplete ? "History is paused until both cash-flow and debt sources are available; missing data is not recorded as zero." : "");
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  var state = { summary: null, hasData: false };

  function renderLedger() {
    var cashflow = readKey("budgetlens.cashflow.v1");
    var debts = readKey("debtpayoff.debts.v1");
    var s = H.householdSummary(debts, cashflow);
    var hasAny = !!cashflow || (debts && debts.length);
    state.summary = s;
    state.hasData = hasAny;
    state.hasCompleteData = !!cashflow && Array.isArray(debts);

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
      var inTotal = s.monthlyIncome || s.monthlySpending || 1;
      s.topCategories.forEach(function (c) {
        var share = Math.round((Number(c.monthly) || 0) / inTotal * 100);
        var chip = el("span", "topcat");
        chip.appendChild(el("i", "topcat-bar"));
        chip.firstChild.style.width = Math.min(100, Math.max(2, share * 2)) + "%";
        chip.appendChild(document.createTextNode(c.icon + " " + c.name + " " + H.money(c.monthly) + "/mo · " + share + "%"));
        tc.appendChild(chip);
      });
    } else {
      ["l-income", "l-spend", "l-kept", "l-rate-val"].forEach(function (id) { $(id).textContent = "—"; });
      $("l-rate-bar").style.width = "0%";
      $("l-topcats").textContent = "";
    }

    if (debts && debts.length) {
      $("l-debt").textContent = H.money(s.totalDebt);
      $("l-mins").textContent = H.money(s.totalMin) + "/mo";
      $("l-interest").textContent = H.money(s.monthlyInterest) + "/mo";
      $("l-debt-note").textContent = s.debtCount + (s.debtCount === 1 ? " debt" : " debts") +
        " on the books — interest alone costs " + H.money(s.monthlyInterest) + " every month.";
    } else {
      ["l-debt", "l-mins", "l-interest"].forEach(function (id) { $(id).textContent = "—"; });
      $("l-debt-note").textContent = "";
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
      apply.removeAttribute("aria-disabled");
      apply.removeAttribute("tabindex");
      apply.textContent = "Apply " + H.money(s.suggestedAttack) + "/mo in DebtPayoff →";
    } else {
      $("l-attack-amt").textContent = "—";
      $("l-attack-items").innerHTML = "<li>No quantified savings found yet — run BudgetLens on your transactions.</li>";
      var applyBtn = $("l-apply");
      applyBtn.classList.add("disabled");
      applyBtn.removeAttribute("href");
      applyBtn.setAttribute("aria-disabled", "true");
      applyBtn.setAttribute("tabindex", "-1");
      applyBtn.textContent = "Apply in DebtPayoff →";
    }

    var verdict = $("l-verdict");
    if (cashflow && debts && debts.length && s.monthsOfKeeping) {
      verdict.textContent = "You're keeping " + H.money(s.monthlyKept) + "/mo against " +
        H.money(s.totalDebt) + " of debt. At that pace the principal alone is ~" +
        s.monthsOfKeeping + " months of keeping — before interest. That's what the attack is for.";
    } else if (cashflow && debts && debts.length) {
      verdict.textContent = "Cash flow and debts are loaded. No positive kept-income horizon is available; this is not a payoff forecast.";
    } else if (cashflow) {
      verdict.textContent = "You're keeping " + H.moneySigned(s.monthlyKept) + "/mo. No debts on the books — the ledger balances.";
    } else if (debts && debts.length) {
      verdict.textContent = "Debt side loaded. Add BudgetLens cash-flow data and the ledger gets its other half.";
    } else {
      verdict.textContent = "";
    }

    renderVitals(s, hasAny);
    renderFlow(s, hasAny);
    renderHistory(s, hasAny);
    renderRoadmap(s);
    renderDataStatus();
  }

  /* ---------- health vitals ---------- */
  function renderVitals(s, hasAny) {
    var band = $("h-band");
    if (!hasAny || !s.hasCashflow) {
      band.textContent = "—"; band.className = "band";
      $("h-band-label").textContent = "—";
      $("h-projected").textContent = "—";
      $("h-horizon").textContent = "—";
      return;
    }
    var b = H.savingsBand(s.savingsRate);
    band.textContent = b.label;
    band.className = "band tone-" + b.tone;
    $("h-band-label").textContent = Math.round((s.savingsRate || 0) * 100) +
      "% of income kept · benchmarks: 20%+ excellent, 10–20% healthy, under 10% building";
    $("h-projected").textContent = H.moneySigned(s.monthlyKept * 12);
    $("h-horizon").textContent = s.monthsOfKeeping ? "~" + s.monthsOfKeeping + " months" : "—";
  }

  /* ---------- money-flow diagram: proportional stacked bars ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function flowText(x, y, str, cls) {
    var t = svgEl("text", { x: x, y: y, "class": cls || "f-label" });
    t.textContent = str;
    return t;
  }

  function renderFlow(s, hasAny) {
    var host = $("flow-svg");
    host.innerHTML = "";
    var W = 960, Hh = 512;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + Hh, "class": "flow-art" });
    host.appendChild(svg);

    if (!hasAny || !s.hasCashflow) {
      var emptySvg = svgEl("svg", { viewBox: "0 0 960 330", "class": "flow-art" });
      host.replaceChild(emptySvg, svg);
      svg = emptySvg;
      svg.appendChild(svgEl("rect", { x: 30, y: 80, width: 900, height: 150, "class": "f-empty" }));
      var e1 = flowText(480, 148, "Your money in motion will appear here.", "f-empty-t");
      e1.setAttribute("text-anchor", "middle");
      svg.appendChild(e1);
      var e2 = flowText(480, 174, "Run BudgetLens and DebtPayoff on this same origin.", "f-empty-s");
      e2.setAttribute("text-anchor", "middle");
      svg.appendChild(e2);
      $("flow-caption").textContent = "No live data yet \u2014 the diagram draws itself from your BudgetLens cash-flow and DebtPayoff debts.";
      return;
    }

    var labelX = 24, barX = 228, barW = 560, barH = 52;
    var rows = [44, 164, 284, 404];

    function rowLabel(y, title, amount, sub) {
      svg.appendChild(flowText(labelX, y + 20, title, "b-title"));
      svg.appendChild(flowText(labelX, y + 42, amount, "b-amount"));
      if (sub) svg.appendChild(flowText(labelX, y + 60, sub, "b-sub"));
    }
    function seg(x, y, w, cls, label, dark) {
      if (w < 3) return x;
      svg.appendChild(svgEl("rect", { x: x, y: y, width: w, height: barH, "class": cls }));
      if (label) {
        var inside = w >= 150;
        var tx = inside ? x + w / 2 : x + w + 12;
        var t = flowText(tx, y + barH / 2 + 5, label,
          inside ? (dark ? "b-seglabel-d" : "b-seglabel-l") : "b-seglabel-o");
        if (inside) t.setAttribute("text-anchor", "middle");
        svg.appendChild(t);
      }
      return x + w;
    }
    function rule(y) {
      svg.appendChild(svgEl("line", { x1: barX, y1: y + barH + 20, x2: barX + barW, y2: y + barH + 20, "class": "b-rule" }));
    }

    var income = Math.max(1, s.monthlyIncome || 0);
    var spend = Math.max(0, s.monthlySpending || 0);
    var kept = Math.max(0, s.monthlyKept || 0);
    var attack = Math.max(0, Math.min(s.suggestedAttack || 0, kept));
    var buffer = kept - attack;
    var mins = s.totalMin || 0;
    var interest = Math.min(s.monthlyInterest || 0, mins);
    var debt = s.totalDebt || 0;

    /* Row 1: income splits into spent and kept */
    rowLabel(rows[0], "INCOME", H.money(income) + "/mo");
    var x = barX;
    x = seg(x, rows[0], spend / income * barW, "b-seg-spent", "Spent " + H.money(spend) + "/mo", true);
    x = seg(x, rows[0], kept / income * barW, "b-seg-kept", "Kept " + H.moneySigned(kept) + "/mo", true);
    rule(rows[0]);

    /* Row 2: kept splits into attack and buffer */
    rowLabel(rows[1], "KEPT", H.moneySigned(kept) + "/mo",
      kept > 0 ? "every kept dollar is one the debt doesn't own" : null);
    x = barX;
    if (kept > 0) {
      x = seg(x, rows[1], attack / kept * barW, "b-seg-attack",
        attack > 0 ? "Attack " + H.money(attack) + "/mo" : null, true);
      x = seg(x, rows[1], buffer / kept * barW, "b-seg-buffer",
        "Buffer " + H.money(buffer) + "/mo", false);
    } else {
      svg.appendChild(flowText(barX + 12, rows[1] + barH / 2 + 5, "Nothing kept this month.", "b-seglabel-o"));
    }
    rule(rows[1]);

    /* Row 3: minimums split into interest and principal */
    var intShare = mins > 0 ? Math.round(interest / mins * 100) : 0;
    rowLabel(rows[2], "MINIMUMS", H.money(mins) + "/mo",
      mins > 0 ? intShare + "\u00a2 of every minimum dollar is pure interest" : null);
    x = barX;
    if (mins > 0) {
      x = seg(x, rows[2], interest / mins * barW, "b-seg-int",
        "Interest " + H.money(interest) + "/mo", true);
      x = seg(x, rows[2], (mins - interest) / mins * barW, "b-seg-prin",
        "Principal " + H.money(mins - interest) + "/mo", false);
    }
    rule(rows[2]);

    /* Row 4: the debt itself */
    rowLabel(rows[3], "DEBT OWED", H.money(debt),
      (s.debtCount || 0) + ((s.debtCount || 0) === 1 ? " debt" : " debts") + " on the books");
    svg.appendChild(svgEl("rect", { x: barX, y: rows[3], width: barW, height: barH, "class": "b-debtbar" }));
    var dl = flowText(barX + barW - 12, rows[3] + barH / 2 + 5, H.money(debt), "b-seglabel-l");
    dl.setAttribute("text-anchor", "end");
    svg.appendChild(dl);

    var bits = [];
    if (attack > 0) bits.push(H.money(attack) + "/mo of attack is the first to strike the debt");
    if (interest > 0) bits.push("interest alone costs " + H.money(interest) + " every month");
    $("flow-caption").textContent = bits.length
      ? bits.join(" \u2014 ") + "."
      : "Your income splits into spent and kept; every kept dollar is a dollar the debt doesn't own.";
  }

  /* ---------- ledger history ---------- */
  function renderHistory(s, hasAny) {
    var host = $("hist-svg");
    host.innerHTML = "";
    var history = readKey(H.LS_HISTORY) || [];
    if (readProblems[H.LS_HISTORY]) {
      $("hist-verdict").textContent = "History is unavailable. Original stored data has not been replaced.";
      return;
    }
    var saved = true;
    if (state.hasCompleteData && !readProblems["budgetlens.cashflow.v1"] && !readProblems["debtpayoff.debts.v1"]) {
      var next = H.appendSnapshot(history, s, todayKey());
      saved = writeKey(H.LS_HISTORY, next);
      if (saved) history = next;
    }
    var W = 960, Hh = 220;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + Hh, "class": "hist-art" });
    host.appendChild(svg);

    if (history.length < 1) {
      var t = flowText(480, 110, "No recorded days yet — visit once your data is connected.", "f-empty-t");
      t.setAttribute("text-anchor", "middle");
      svg.appendChild(t);
      $("hist-verdict").textContent = saved ? "" : "Today's snapshot could not be saved. No new history entry was recorded.";
      return;
    }

    var padL = 70, padR = 70, padT = 30, padB = 40;
    var iw = W - padL - padR, ih = Hh - padT - padB;
    var maxV = 1;
    history.forEach(function (p) {
      maxV = Math.max(maxV, Number(p.debt) || 0, Number(p.kept) || 0);
    });
    function X(i) { return padL + (history.length === 1 ? iw / 2 : i / (history.length - 1) * iw); }
    function Y(v) { return padT + ih - (Number(v) || 0) / maxV * ih; }

    // hairline grid
    [0, 0.5, 1].forEach(function (f) {
      var y = padT + ih * (1 - f);
      svg.appendChild(svgEl("line", { x1: padL, y1: y, x2: W - padR, y2: y, "class": "g-line" }));
      var gl = flowText(padL - 10, y + 4, H.money(maxV * f), "g-label");
      gl.setAttribute("text-anchor", "end");
      svg.appendChild(gl);
    });

    function series(key, cls) {
      var d = history.map(function (p, i) {
        return (i === 0 ? "M " : "L ") + X(i).toFixed(1) + " " + Y(p[key]).toFixed(1);
      }).join(" ");
      svg.appendChild(svgEl("path", { d: d, "class": cls, fill: "none" }));
      history.forEach(function (p, i) {
        svg.appendChild(svgEl("circle", { cx: X(i), cy: Y(p[key]), r: 4, "class": cls + "-dot" }));
      });
      var last = history[history.length - 1];
      var lab = flowText(W - padR + 8, Y(last[key]) + 4, H.money(last[key]), "g-series");
      svg.appendChild(lab);
    }
    series("debt", "s-debt");
    series("kept", "s-kept");

    var lg1 = flowText(padL, Hh - 12, "Debt owed", "g-legend g-legend-debt");
    svg.appendChild(lg1);
    var lg2 = flowText(padL + 110, Hh - 12, "Kept / month", "g-legend g-legend-kept");
    svg.appendChild(lg2);

    var tr = H.trend(history);
    var v = $("hist-verdict");
    if (tr.count < 2) {
      v.textContent = "First entry recorded. Come back tomorrow and the line starts telling a story.";
    } else if (tr.debtDown) {
      v.textContent = "Debt is down " + H.money(tr.debtDelta) + " across " + tr.count +
        " recorded days — the trajectory is bending the right way.";
    } else if (tr.debtDelta < 0) {
      v.textContent = "Debt is up " + H.money(-tr.debtDelta) + " across " + tr.count +
        " recorded days — worth a look before it compounds.";
    } else {
      v.textContent = tr.count + " recorded days, debt holding steady. The attack is how it starts moving.";
    }
    if (!saved) v.textContent = "Today's snapshot could not be saved. Showing previously stored history only.";
  }

  /* ---------- household roadmap ---------- */
  function renderRoadmap(s) {
    var history = readKey(H.LS_HISTORY) || [];
    var list = $("roadmap-list");
    list.innerHTML = "";
    H.roadmap(s, history).forEach(function (step, i) {
      var li = el("li", "roadmap-step state-" + step.state);
      li.appendChild(el("span", "roadmap-no", String(i + 1).padStart(2, "0")));
      var body = el("div", "roadmap-body");
      body.appendChild(el("h3", null, step.title));
      body.appendChild(el("p", null, step.desc));
      li.appendChild(body);
      li.appendChild(el("span", "roadmap-mark",
        step.state === "done" ? "Done" : (step.state === "active" ? "Now" : "Later")));
      list.appendChild(li);
    });
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
    $("print-btn").addEventListener("click", function () { window.print(); });
    /* Re-read the ledger if sibling apps wrote while this tab was open. */
    window.addEventListener("storage", renderLedger);
    window.addEventListener("focus", renderLedger);
  });
})();
