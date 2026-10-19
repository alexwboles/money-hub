#!/usr/bin/env bash
# money-hub smoke tests — quick sanity checks
set -u
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
check() { # $1 = description, $2 = command...
  if eval "$2" >/dev/null 2>&1; then PASS=$((PASS+1)); echo "PASS: $1";
  else FAIL=$((FAIL+1)); echo "FAIL: $1"; fi
}

check "index.html exists"            "[ -f index.html ]"
check "css/style.css exists"         "[ -f css/style.css ]"
check "js/data.js exists"            "[ -f js/data.js ]"
check "js/app.js exists"             "[ -f js/app.js ]"
check "README.md exists"             "[ -f README.md ]"
check "LICENSE exists"                "[ -f LICENSE ]"
check "data.js syntax valid"         "node --check js/data.js"
check "app.js syntax valid"          "node --check js/app.js"
check "index.html loads data.js"     "grep -q 'js/data.js' index.html"
check "index.html loads app.js"      "grep -q 'js/app.js' index.html"
check "ledger console present"       "grep -q 'id=\"ledger\"' index.html && grep -q 'id=\"l-attack-amt\"' index.html && grep -q 'id=\"l-apply\"' index.html"
check "bridges section present"      "grep -q 'id=\"bridges\"' index.html && grep -q 'Bridge A' index.html && grep -q 'Bridge B' index.html"
check "products + search present"    "grep -q 'id=\"products\"' index.html && grep -q 'id=\"search\"' index.html && grep -q 'id=\"cards\"' index.html"
check "family pack present"          "grep -q 'id=\"pack\"' index.html && grep -q 'id=\"pack-price\"' index.html"
check "no border-radius styling"     "! grep -qi 'border-radius' css/style.css"
check "no purple/blue gradients"     "! grep -Eiq 'linear-gradient\([^)]*(purple|blue|violet|indigo)' css/style.css"
check "no color gradient fills"      "! grep -Ei 'radial-gradient|conic-gradient' css/style.css"
check "REDESIGN-AUDIT.md exists"     "[ -f REDESIGN-AUDIT.md ]"
check "flow diagram section present" "grep -q 'id=\"flow\"' index.html && grep -q 'id=\"flow-svg\"' index.html"
check "vitals row present"           "grep -q 'id=\"h-band\"' index.html && grep -q 'id=\"h-projected\"' index.html && grep -q 'id=\"h-horizon\"' index.html"
check "history section present"      "grep -q 'id=\"history\"' index.html && grep -q 'id=\"hist-svg\"' index.html && grep -q 'id=\"hist-verdict\"' index.html"
check "roadmap section present"      "grep -q 'id=\"roadmap\"' index.html && grep -q 'id=\"roadmap-list\"' index.html"
check "print button present"         "grep -q 'id=\"print-btn\"' index.html"
check "README documents hub-owned history key" "grep -q 'moneyhub.ledger_history.v1' README.md"
check "README documents bridge keys" "grep -q 'budgetlens.cashflow.v1' README.md && grep -q 'debtpayoff.debts.v1' README.md"
check "README documents deep link"   "grep -q '?attack=' README.md"

node -e '
var h = require("./js/data.js");
var assert = require("assert");
assert.strictEqual(h.PRODUCTS.length, 3, "3 products");
var slugs = h.PRODUCTS.map(function(p){return p.slug;}).sort();
assert.deepStrictEqual(slugs, ["budgetlens-ai","debtpayoff-ai","taxprep-ai"], "slugs");
h.PRODUCTS.forEach(function(p){
  assert.ok(/^https:\/\/github\.com\/alexwboles\/[a-z-]+$/.test(p.repo), "repo link well-formed: "+p.slug);
  assert.ok(Number.isInteger(p.price) && p.price > 0, "price valid: "+p.slug);
  assert.strictEqual(p.features.length, 3, "3 features: "+p.slug);
  assert.ok(p.connections.length >= 1, "family link: "+p.slug);
});
assert.strictEqual(h.BRIDGES.length, 2, "2 bridges documented");
assert.strictEqual(h.totalSeparate(), 20, "20 separate");
assert.strictEqual(h.BUNDLE.price, 14, "14 family pack");
assert.strictEqual(h.bundleSavings(), 6, "20-14=6 savings");
assert.ok(h.CONTRACT.reads.indexOf("budgetlens.cashflow.v1") !== -1, "contract reads budgetlens key");
assert.ok(h.CONTRACT.reads.indexOf("debtpayoff.debts.v1") !== -1, "contract reads debtpayoff key");
assert.strictEqual(h.attackDeepLink(150), "../debtpayoff-ai/?attack=150", "deep link shape");
assert.strictEqual(h.attackDeepLink(-5), "../debtpayoff-ai/?attack=0", "deep link clamps low");
assert.strictEqual(h.attackDeepLink(9999), "../debtpayoff-ai/?attack=1000", "deep link clamps high");
assert.deepStrictEqual(h.searchProducts("debt").map(function(p){return p.slug;}), ["debtpayoff-ai"], "search debt");
assert.strictEqual(h.searchProducts("zzz").length, 0, "search miss");
assert.strictEqual(h.LS_HISTORY, "moneyhub.ledger_history.v1", "hub history key");

/* ledger history: one snapshot per day, dedupe, 24 cap */
var summ = { monthlyKept: 488, totalDebt: 8240, suggestedAttack: 150 };
var hist = h.appendSnapshot(null, summ, "2026-10-18");
assert.strictEqual(hist.length, 1, "first snapshot");
assert.deepStrictEqual(hist[0], { d: "2026-10-18", kept: 488, debt: 8240, attack: 150 }, "snapshot shape");
hist = h.appendSnapshot(hist, summ, "2026-10-18");
assert.strictEqual(hist.length, 1, "same day deduped");
hist = h.appendSnapshot(hist, summ, "2026-10-19");
assert.strictEqual(hist.length, 2, "second day appended");
var big = [];
for (var i = 0; i < 30; i++) big = h.appendSnapshot(big, summ, "2026-09-" + (i < 9 ? "0" : "") + (i + 1));
assert.strictEqual(big.length, 24, "history capped at 24");
assert.strictEqual(big[0].d, "2026-09-07", "oldest evicted first");

/* trend verdicts */
var tr = h.trend([{ d: "a", kept: 400, debt: 9000, attack: 100 }, { d: "b", kept: 500, debt: 8200, attack: 150 }]);
assert.strictEqual(tr.debtDown, true, "debt shrinking detected");
assert.strictEqual(tr.debtDelta, 800, "debt delta");
assert.strictEqual(tr.keptAvg, 450, "kept average");
var tr2 = h.trend([{ d: "a", kept: 400, debt: 8000, attack: 100 }]);
assert.strictEqual(tr2.count, 1, "single snapshot count");
assert.strictEqual(tr2.debtDown, false, "no trend on one point");

/* savings bands */
assert.deepStrictEqual([h.savingsBand(0.25).label, h.savingsBand(0.25).tone], ["Excellent pace", "good"], "band excellent");
assert.deepStrictEqual([h.savingsBand(0.12).label, h.savingsBand(0.12).tone], ["Healthy pace", "good"], "band healthy");
assert.deepStrictEqual([h.savingsBand(0.05).label, h.savingsBand(0.05).tone], ["Building", "ok"], "band building");
assert.deepStrictEqual([h.savingsBand(0).label, h.savingsBand(0).tone], ["Breaking even", "warn"], "band break-even");
assert.deepStrictEqual([h.savingsBand(-0.05).label, h.savingsBand(-0.05).tone], ["Spending above income", "bad"], "band negative");

/* roadmap states from real data */
var full = { hasCashflow: true, debtCount: 2, suggestedAttack: 150, monthlyKept: 488, totalDebt: 8240 };
var rm = h.roadmap(full, [{ d: "a", kept: 400, debt: 9000, attack: 100 }, { d: "b", kept: 500, debt: 8200, attack: 150 }]);
assert.strictEqual(rm.length, 4, "4 roadmap steps");
assert.ok(rm.every(function (r) { return r.state === "done"; }), "all done with good data");
var bare = { hasCashflow: false, debtCount: 0, suggestedAttack: 0 };
var rm0 = h.roadmap(bare, []);
assert.strictEqual(rm0[0].state, "active", "first step active with no data");
assert.strictEqual(rm0[3].state, "todo", "bend-the-trajectory later with no history");
var rm1 = h.roadmap({ hasCashflow: true, debtCount: 0, suggestedAttack: 0 }, []);
assert.strictEqual(rm1[1].state, "active", "debts step active after flow");
'

echo "---"
echo "smoke: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
