#!/usr/bin/env bash
# money-hub e2e tests — exercise catalogue + ledger logic end to end in node
set -u
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
flow() { # $1 = name, $2 = node script
  if node -e "$2" >/dev/null 2>&1; then PASS=$((PASS+1)); echo "PASS: $1";
  else FAIL=$((FAIL+1)); echo "FAIL: $1"; fi
}

flow "getProduct budgetlens-ai" '
var h=require("./js/data.js"),p=h.getProduct("budgetlens-ai");
if(!p||p.price!==8||p.lane!=="Track spending")process.exit(1);'

flow "getProduct debtpayoff-ai" '
var h=require("./js/data.js"),p=h.getProduct("debtpayoff-ai");
if(!p||p.price!==6||!/debt-free date/i.test(p.tagline))process.exit(1);'

flow "getProduct taxprep-ai" '
var h=require("./js/data.js"),p=h.getProduct("taxprep-ai");
if(!p||p.price!==6||!/shoebox/i.test(p.tagline))process.exit(1);'

flow "getProduct miss returns null" '
var h=require("./js/data.js");
if(h.getProduct("nope-ai")!==null)process.exit(1);'

flow "householdSummary aggregates debts" '
var h=require("./js/data.js");
var s=h.householdSummary([
  {id:"d1",name:"Card",balance:5240,apr:24.99,min:120},
  {id:"d2",name:"Loan",balance:3000,apr:8,min:90}
], null);
if(s.debtCount!==2)process.exit(1);
if(s.totalDebt!==8240)process.exit(1);
if(s.totalMin!==210)process.exit(1);
var want=Math.round((5240*0.2499/12+3000*0.08/12)*100)/100;
if(s.monthlyInterest!==want)process.exit(1);
if(s.hasCashflow!==false)process.exit(1);'

flow "householdSummary merges cashflow + verdict math" '
var h=require("./js/data.js");
var s=h.householdSummary(
  [{id:"d1",name:"Card",balance:5240,apr:24.99,min:120}],
  {updatedAt:1,months:3,monthlyIncome:3200,monthlySpending:2712,monthlyKept:488,
   savingsRate:0.1525,topCategories:[],
   attackSource:{monthly:150,items:[{title:"Subscriptions",monthly:72,detail:"x"}]}});
if(!s.hasCashflow)process.exit(1);
if(s.monthlyKept!==488)process.exit(1);
if(s.suggestedAttack!==150)process.exit(1);
if(s.attackItems.length!==1)process.exit(1);
if(s.monthsOfKeeping!==Math.ceil(5240/488))process.exit(1);'

flow "householdSummary tolerates empty/malformed input" '
var h=require("./js/data.js");
var s=h.householdSummary(null, null);
if(s.totalDebt!==0||s.debtCount!==0)process.exit(1);
var s2=h.householdSummary([{balance:"junk",apr:null}], null);
if(s2.totalDebt!==0||s2.monthlyInterest!==0)process.exit(1);'

flow "householdSummary monthsOfKeeping null without cashflow" '
var h=require("./js/data.js");
var s=h.householdSummary([{balance:100,apr:5,min:10}], null);
if(s.monthsOfKeeping!==undefined)process.exit(1);'

flow "attack deep link round-trips an integer" '
var h=require("./js/data.js");
if(h.attackDeepLink(187.6)!=="../debtpayoff-ai/?attack=188")process.exit(1);'

flow "money formatting" '
var h=require("./js/data.js");
if(h.money(5240)!=="$5,240")process.exit(1);
if(h.moneySigned(-488)!=="−$488")process.exit(1);
if(h.moneySigned(488)!=="$488")process.exit(1);'

flow "history journey: snapshot → trend → roadmap" '
var h=require("./js/data.js");
var debts=[{balance:9000,apr:20,min:200}];
var cf={months:3,monthlyIncome:3200,monthlySpending:2700,monthlyKept:500,
  savingsRate:0.156,topCategories:[],attackSource:{monthly:150,items:[]}};
var s=h.householdSummary(debts,cf);
var hist=h.appendSnapshot([],s,"2026-10-18");
var debts2=[{balance:8700,apr:20,min:200}];
var s2=h.householdSummary(debts2,cf);
hist=h.appendSnapshot(hist,s2,"2026-10-19");
if(hist.length!==2)process.exit(1);
var t=h.trend(hist);
if(!t.debtDown||t.debtDelta!==300)process.exit(1);
var rm=h.roadmap(s2,hist);
if(rm.length!==4||rm[0].state!=="done"||rm[3].state!=="done")process.exit(1);'

flow "history tolerates corrupt entries" '
var h=require("./js/data.js");
var s={monthlyKept:100,totalDebt:1000,suggestedAttack:10};
var hist=h.appendSnapshot([null,"junk",{d:"2026-10-18",kept:1,debt:2,attack:3}],s,"2026-10-19");
if(hist.length!==2)process.exit(1);
if(hist[0].d!=="2026-10-18"||hist[1].d!=="2026-10-19")process.exit(1);'

flow "savings band drives vitals copy" '
var h=require("./js/data.js");
if(h.savingsBand(0.22).label!=="Excellent pace")process.exit(1);
if(h.savingsBand(0.15).label!=="Healthy pace")process.exit(1);
if(h.savingsBand(0.03).tone!=="ok")process.exit(1);
if(h.savingsBand(-0.01).tone!=="bad")process.exit(1);'

flow "roadmap bend step reacts to rising debt" '
var h=require("./js/data.js");
var s={hasCashflow:true,debtCount:1,suggestedAttack:50};
var hist=[{d:"a",kept:400,debt:8000,attack:50},{d:"b",kept:400,debt:8300,attack:50}];
var rm=h.roadmap(s,hist);
if(rm[3].state!=="active")process.exit(1);
var t=h.trend(hist);
if(t.debtDown||t.debtDelta!==300*-1)process.exit(1);'

echo "---"
echo "e2e: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
