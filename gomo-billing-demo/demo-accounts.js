/** Static demo billing data (mirrors billing-tools/fixtures/accounts.data.json). */
window.GOMO_DEMO_ACCOUNTS = {
  currency: "EUR",
  accounts: {
    "1108842001": {
      profile: "Usage spike",
      description: "Latest bill €18.16 — September usage spike.",
      bills: [
        {
          bill_id: "GB202610001",
          billing_date: "2026-10-01",
          amounts: { total: "18.16", recurring: "14.99", usage: "3.17" },
          comparison_to_previous: { total_delta: "3.17", usage_delta: "3.17" },
        },
        {
          bill_id: "GB202609001",
          billing_date: "2026-09-01",
          amounts: { total: "15.14", recurring: "14.99", usage: "0.15" },
          comparison_to_previous: { total_delta: "0.15", usage_delta: "0.15" },
        },
      ],
    },
    "1108842002": {
      profile: "No total increase",
      description: "Four months at €14.99 — total unchanged vs previous bill.",
      bills: [
        {
          bill_id: "GB202610002",
          billing_date: "2026-10-01",
          amounts: { total: "14.99", recurring: "14.99", usage: "0.00" },
          comparison_to_previous: { total_delta: "0.00", usage_delta: "0.00" },
        },
      ],
    },
    "1108842003": {
      profile: "International SMS",
      description: "Latest €15.14 includes €0.15 international SMS.",
      bills: [
        {
          bill_id: "GB202610003",
          billing_date: "2026-10-01",
          amounts: { total: "15.14", recurring: "14.99", usage: "0.15" },
          comparison_to_previous: { total_delta: "0.15", usage_delta: "0.15" },
        },
      ],
    },
    "1108842004": {
      profile: "Mixed demo",
      description: "Default profile — recent bills vary by month.",
      bills: [
        {
          bill_id: "GB202610004",
          billing_date: "2026-10-01",
          amounts: { total: "15.14", recurring: "14.99", usage: "0.15" },
          comparison_to_previous: { total_delta: "-3.02", usage_delta: "-3.02" },
        },
        {
          bill_id: "GB202609004",
          billing_date: "2026-09-01",
          amounts: { total: "18.16", recurring: "14.99", usage: "3.17" },
          comparison_to_previous: { total_delta: "3.17", usage_delta: "3.17" },
        },
      ],
    },
  },
};
