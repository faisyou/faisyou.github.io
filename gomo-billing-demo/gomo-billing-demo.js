/**
 * GoMo billing demo — bill UI + Genesys Web Messaging (Database.set + Messenger.open).
 * Load after the Genesys bootstrap snippet in index.html (deploymentId/environment live there).
 */
(function () {
  const DEMO_ACCOUNTS = {
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

  const ACCOUNT_ORDER = ["1108842001", "1108842002", "1108842003", "1108842004"];

  const state = {
    messengerReady: false,
    selectedAccountId: ACCOUNT_ORDER[0],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function euro(amount) {
    return "€" + amount;
  }

  function formatDelta(delta) {
    var n = parseFloat(delta);
    if (isNaN(n) || n === 0) return "No change vs previous bill";
    var sign = n > 0 ? "+" : "";
    return sign + euro(delta) + " vs previous bill";
  }

  function getAccount(id) {
    return DEMO_ACCOUNTS.accounts[id];
  }

  function setMessengerStatus(text) {
    var el = $("gomo-messenger-status");
    if (el) el.textContent = text;
  }

  function renderBillDetails(accountId) {
    var account = getAccount(accountId);
    if (!account) return;

    var latest = account.bills[0];

    $("gomo-bill-profile").textContent = account.profile;
    $("gomo-bill-description").textContent = account.description;
    $("gomo-bill-latest-id").textContent = latest.bill_id;
    $("gomo-bill-latest-date").textContent = latest.billing_date;
    $("gomo-bill-latest-total").textContent = euro(latest.amounts.total);
    $("gomo-bill-latest-delta").textContent = formatDelta(
      (latest.comparison_to_previous && latest.comparison_to_previous.total_delta) || "0.00"
    );

    var rows = account.bills
      .map(function (b) {
        var delta = (b.comparison_to_previous && b.comparison_to_previous.total_delta) || "0.00";
        return (
          "<tr><td>" +
          b.bill_id +
          "</td><td>" +
          b.billing_date +
          "</td><td>" +
          euro(b.amounts.total) +
          "</td><td>" +
          euro(b.amounts.recurring) +
          "</td><td>" +
          euro(b.amounts.usage) +
          "</td><td>" +
          formatDelta(delta) +
          "</td></tr>"
        );
      })
      .join("");

    $("gomo-bill-table-body").innerHTML = rows;
    $("gomo-bill-currency").textContent = DEMO_ACCOUNTS.currency;
  }

  function onAccountChange(accountId) {
    state.selectedAccountId = accountId;
    renderBillDetails(accountId);
  }

  function bindHeaderAccountSelect() {
    var select = $("gomo-header-account-select");
    if (!select) return;

    ACCOUNT_ORDER.forEach(function (id) {
      var account = getAccount(id);
      var opt = document.createElement("option");
      opt.value = id;
      opt.textContent = account ? id + " — " + account.profile : id;
      select.appendChild(opt);
    });

    select.value = state.selectedAccountId;
    select.addEventListener("change", function () {
      onAccountChange(select.value);
    });
    onAccountChange(state.selectedAccountId);
  }

  function startChat() {
    var accountId = state.selectedAccountId;
    if (!accountId) {
      setMessengerStatus("Select an account first.");
      return;
    }
    if (!state.messengerReady) {
      setMessengerStatus("Messenger is still loading…");
      return;
    }

    setMessengerStatus("Setting participant data…");
    Genesys(
      "command",
      "Database.set",
      {
        messaging: {
          customAttributes: {
            account_id: String(accountId),
          },
        },
      },
      function onSetSuccess() {
        setMessengerStatus("Opening chat…");
        Genesys(
          "command",
          "Messenger.open",
          {},
          function onOpenSuccess() {
            setMessengerStatus("Chat open for account " + accountId + ".");
            var toast = $("gomo-chat-toast");
            if (toast) toast.classList.remove("is-visible");
          },
          function onOpenFail(err) {
            console.error("Messenger.open failed", err);
            setMessengerStatus("Could not open messenger.");
          }
        );
      },
      function onSetFail(err) {
        console.error("Database.set failed", err);
        setMessengerStatus("Could not set account_id participant data.");
      }
    );
  }

  function bindUi() {
    bindHeaderAccountSelect();
    var startBtn = $("gomo-start-chat");
    if (startBtn) startBtn.addEventListener("click", startChat);
    var toastCta = $("gomo-toast-cta");
    if (toastCta) toastCta.addEventListener("click", startChat);
    var toastDismiss = $("gomo-toast-dismiss");
    if (toastDismiss) {
      toastDismiss.addEventListener("click", function () {
        var toast = $("gomo-chat-toast");
        if (toast) toast.classList.remove("is-visible");
      });
    }
  }

  /** Queued on Genesys stub — runs once SDK loads. Do not call Genesys('configure') here. */
  Genesys("registerPlugin", "GomoBillingLauncherPlugin", function (Plugin) {
    Plugin.subscribe([
      {
        topic: "Launcher.ready",
        callback: function () {
          Genesys("command", "Launcher.hide", {});
        },
      },
      {
        topic: "Messenger.ready",
        callback: function () {
          state.messengerReady = true;
          setMessengerStatus("Ready to chat about the selected account.");
        },
      },
    ]);
  });

  document.addEventListener("DOMContentLoaded", function () {
    bindUi();
    setMessengerStatus("Loading messenger…");
    window.setTimeout(function () {
      var toast = $("gomo-chat-toast");
      if (toast) toast.classList.add("is-visible");
    }, 1500);
  });
})();
