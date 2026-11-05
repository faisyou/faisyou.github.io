/**
 * Writes the catalog v2 accounts into gomo-billing-demo.js (between the GENERATED markers),
 * so the static demo stays a single JS file with no runtime fetch.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(here, "..", "catalog-v2", "accounts.data.json");
const demoPath = join(here, "gomo-billing-demo.js");

const BEGIN = "  // BEGIN GENERATED DEMO ACCOUNTS (npm run demo:build)";
const END = "  // END GENERATED DEMO ACCOUNTS";

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

function titleCase(profile) {
  const words = profile.split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const accounts = {};
for (const [id, account] of Object.entries(catalog.accounts)) {
  accounts[id] = {
    profile: titleCase(account.profile),
    plan_label: account.plan_label,
    plan_tier: account.plan_tier,
    description: account.description,
    sample_question: account.sample_question,
    bills: account.bills.map((bill) => ({
      bill_id: bill.bill_id,
      billing_date: bill.billing_date,
      amounts: {
        total: bill.amounts.total,
        recurring: bill.amounts.recurring,
        one_off: bill.amounts.one_off,
        usage: bill.amounts.usage,
      },
      comparison_to_previous: {
        total_delta: bill.comparison_to_previous.total_delta,
        usage_delta: bill.comparison_to_previous.usage_delta,
      },
    })),
  };
}

const order = Object.keys(accounts).sort((a, b) => {
  const tier = parseFloat(accounts[a].plan_tier) - parseFloat(accounts[b].plan_tier);
  return tier !== 0 ? tier : a.localeCompare(b);
});

const indent = (text) => text.split("\n").join("\n  ");
const block = [
  BEGIN,
  "  const DEMO_ACCOUNTS = " +
    indent(JSON.stringify({ currency: catalog.currency, catalog_version: catalog.catalog_version, accounts }, null, 2)) +
    ";",
  "",
  "  const ACCOUNT_ORDER = " + JSON.stringify(order) + ";",
  END,
].join("\n");

const source = readFileSync(demoPath, "utf8");
const start = source.indexOf(BEGIN);
const end = source.indexOf(END);
if (start === -1 || end === -1) {
  throw new Error("GENERATED markers not found in gomo-billing-demo.js");
}

writeFileSync(demoPath, source.slice(0, start) + block + source.slice(end + END.length));
console.log(`Wrote ${order.length} accounts (catalog ${catalog.catalog_version}) into gomo-billing-demo.js`);
