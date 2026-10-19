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
check "no border-radius styling"     "! grep -q 'border-radius: *[1-9]' css/style.css"
check "no purple/blue gradients"     "! grep -Eiq 'linear-gradient\([^)]*(purple|blue|violet|indigo)' css/style.css"
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
'

echo "---"
echo "smoke: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
