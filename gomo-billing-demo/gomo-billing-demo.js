/**
 * GoMo billing demo — bill UI + Genesys Web Messaging (Database.set + open chat).
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
    databaseReady: false,
    launcherReady: false,
    messengerReady: false,
    selectedAccountId: ACCOUNT_ORDER[0],
    pendingStartChat: false,
    genesysHandlersRegistered: false,
  };

  function genesys() {
    return window.Genesys;
  }

  function canOpenChatUi() {
    return state.messengerReady || state.launcherReady;
  }

  function canUseDatabase() {
    return state.databaseReady;
  }

  function refreshChatControls() {
    var btn = $("gomo-start-chat");
    var toastCta = $("gomo-toast-cta");
    var enabled = canUseDatabase() && canOpenChatUi();
    if (btn) btn.disabled = !enabled;
    if (toastCta) toastCta.disabled = !enabled;

    if (state.messengerReady) {
      setMessengerStatus("Ready to chat (Messenger loaded).");
    } else if (state.launcherReady) {
      setMessengerStatus("Ready to chat (Launcher loaded).");
    } else if (state.databaseReady) {
      setMessengerStatus("Waiting for Launcher/Messenger…");
    } else {
      setMessengerStatus("Loading Genesys Web Messaging…");
    }
  }

  function onDatabaseReady() {
    if (state.databaseReady) return;
    state.databaseReady = true;
    console.info("[GoMo demo] Database.ready");
    refreshChatControls();
    if (state.pendingStartChat) {
      state.pendingStartChat = false;
      startChat();
    }
  }

  function onLauncherReady() {
    if (state.launcherReady) return;
    state.launcherReady = true;
    console.info("[GoMo demo] Launcher.ready");
    refreshChatControls();
    if (state.pendingStartChat && canUseDatabase()) {
      state.pendingStartChat = false;
      startChat();
    }
  }

  function onMessengerReady() {
    if (state.messengerReady) return;
    state.messengerReady = true;
    console.info("[GoMo demo] Messenger.ready");
    refreshChatControls();
    if (state.pendingStartChat && canUseDatabase()) {
      state.pendingStartChat = false;
      startChat();
    }
  }

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

  /**
   * Open the widget only after Launcher or Messenger is ready.
   * Launcher.open is the supported path for custom buttons when Messenger is still lazy-loading.
   */
  function openChatUi(accountId) {
    var g = genesys();
    if (!g) {
      setMessengerStatus("Genesys SDK not loaded — check the bootstrap snippet.");
      return;
    }
    if (!canOpenChatUi()) {
      setMessengerStatus("Messenger is still loading — wait for Ready status.");
      return;
    }

    setMessengerStatus("Opening chat…");

    var command = state.messengerReady ? "Messenger.open" : "Launcher.open";
    console.info("[GoMo demo] " + command + " for account", accountId);

    g(
      "command",
      command,
      {},
      function onOpenSuccess() {
        setMessengerStatus("Chat open for account " + accountId + ".");
        var toast = $("gomo-chat-toast");
        if (toast) toast.classList.remove("is-visible");
      },
      function onOpenFail(err) {
        console.error("[GoMo demo] " + command + " failed", err);
        setMessengerStatus(
          "Could not open chat. In DevTools → Network, check failed requests for messenger*.js (ad blockers / domain allowlist)."
        );
      }
    );
  }

  function setParticipantDataThenOpen(accountId) {
    var g = genesys();
    var payload = {
      messaging: {
        customAttributes: {
          account_id: String(accountId),
        },
      },
    };

    g(
      "command",
      "Database.set",
      payload,
      function onSetSuccess() {
        console.info("[GoMo demo] Database.set OK", payload);
        openChatUi(accountId);
      },
      function onSetFail(err) {
        console.warn("[GoMo demo] Database.set failed", err);
        setMessengerStatus("Could not set participant data — see console.");
      }
    );
  }

  function startChat() {
    var accountId = state.selectedAccountId;
    console.info("[GoMo demo] Start chat clicked, account_id=", accountId);

    if (!accountId) {
      setMessengerStatus("Select an account first.");
      return;
    }
    if (!genesys()) {
      setMessengerStatus("Genesys SDK not loaded.");
      return;
    }
    if (!canUseDatabase() || !canOpenChatUi()) {
      state.pendingStartChat = true;
      setMessengerStatus("Waiting for Genesys to finish loading…");
      refreshChatControls();
      return;
    }

    setMessengerStatus("Setting participant data for " + accountId + "…");
    setParticipantDataThenOpen(accountId);
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
    refreshChatControls();
  }

  function registerGenesysHandlers() {
    var g = genesys();
    if (!g || state.genesysHandlersRegistered) return;
    state.genesysHandlersRegistered = true;

    g("subscribe", "Database.ready", onDatabaseReady);
    g("subscribe", "Launcher.ready", onLauncherReady);
    g("subscribe", "Messenger.ready", onMessengerReady);

    console.info("[GoMo demo] Subscribed to Database/Launcher/Messenger.ready");
  }

  function init() {
    bindUi();
    registerGenesysHandlers();
    refreshChatControls();

    window.setTimeout(function () {
      if (!canOpenChatUi()) {
        console.warn(
          "[GoMo demo] Launcher/Messenger not ready after 15s — check deployment domain allowlist and ad blockers."
        );
        setMessengerStatus(
          "Messenger did not finish loading. Add this site URL to the Web Messenger deployment allowed domains, then hard-refresh."
        );
      }
    }, 15000);

    window.setTimeout(function () {
      var toast = $("gomo-chat-toast");
      if (toast) toast.classList.add("is-visible");
    }, 1500);
  }

  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();
