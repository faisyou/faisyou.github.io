/**
 * Header account picker, bill summary UI, Database.set(account_id), Messenger.open.
 */
(function () {
  const ACCOUNT_ORDER = ["1108842001", "1108842002", "1108842003", "1108842004"];

  const state = {
    messengerReady: false,
    selectedAccountId: ACCOUNT_ORDER[0],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function euro(amount) {
    return `€${amount}`;
  }

  function formatDelta(delta) {
    const n = Number.parseFloat(delta);
    if (Number.isNaN(n) || n === 0) return "No change vs previous bill";
    const sign = n > 0 ? "+" : "";
    return `${sign}${euro(delta)} vs previous bill`;
  }

  function getAccount(id) {
    return window.GOMO_DEMO_ACCOUNTS?.accounts?.[id];
  }

  function setMessengerStatus(text) {
    const el = $("gomo-messenger-status");
    if (el) el.textContent = text;
  }

  function renderBillDetails(accountId) {
    const account = getAccount(accountId);
    const panel = $("gomo-bill-panel");
    if (!account || !panel) return;

    const latest = account.bills[0];
    const currency = window.GOMO_DEMO_ACCOUNTS.currency || "EUR";

    $("gomo-bill-profile").textContent = account.profile;
    $("gomo-bill-description").textContent = account.description;
    $("gomo-bill-latest-id").textContent = latest.bill_id;
    $("gomo-bill-latest-date").textContent = latest.billing_date;
    $("gomo-bill-latest-total").textContent = euro(latest.amounts.total);
    $("gomo-bill-latest-delta").textContent = formatDelta(
      latest.comparison_to_previous?.total_delta ?? "0.00"
    );

    const rows = account.bills
      .map((b) => {
        const delta = b.comparison_to_previous?.total_delta ?? "0.00";
        return `<tr>
          <td>${b.bill_id}</td>
          <td>${b.billing_date}</td>
          <td>${euro(b.amounts.total)}</td>
          <td>${euro(b.amounts.recurring)}</td>
          <td>${euro(b.amounts.usage)}</td>
          <td>${formatDelta(delta)}</td>
        </tr>`;
      })
      .join("");

    $("gomo-bill-table-body").innerHTML = rows;
    $("gomo-bill-currency").textContent = currency;
    panel.hidden = false;
  }

  function onAccountChange(accountId) {
    state.selectedAccountId = accountId;
    renderBillDetails(accountId);
  }

  function bindHeaderAccountSelect() {
    const select = $("gomo-header-account-select");
    if (!select) return;

    ACCOUNT_ORDER.forEach((id) => {
      const account = getAccount(id);
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = account ? `${id} — ${account.profile}` : id;
      select.appendChild(opt);
    });

    select.value = state.selectedAccountId;
    select.addEventListener("change", () => onAccountChange(select.value));
    onAccountChange(state.selectedAccountId);
  }

  function startChat() {
    const accountId = state.selectedAccountId;
    if (!accountId) {
      setMessengerStatus("Select an account first.");
      return;
    }
    if (!state.messengerReady) {
      setMessengerStatus("Messenger is still loading…");
      return;
    }

    setMessengerStatus("Setting participant data…");
    window.Genesys(
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
        window.Genesys(
          "command",
          "Messenger.open",
          {},
          function onOpenSuccess() {
            setMessengerStatus(`Chat open for account ${accountId}.`);
            $("gomo-chat-toast")?.classList.remove("is-visible");
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

  function registerGenesysPlugin() {
    window.Genesys("registerPlugin", "GomoBillingLauncherPlugin", function (Plugin) {
      Plugin.subscribe([
        {
          topic: "Launcher.ready",
          callback: function () {
            window.Genesys("command", "Launcher.hide", {});
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
  }

  function configureGenesys() {
    const cfg = window.GOMO_MESSENGER_CONFIG;
    if (!cfg?.deploymentId) {
      setMessengerStatus("Missing deploymentId in config.js");
      return;
    }
    registerGenesysPlugin();
    window.Genesys("configure", {
      deploymentId: cfg.deploymentId,
      environment: cfg.environment || "prod-euc1",
      debug: Boolean(cfg.debug),
    });
  }

  function bindUi() {
    bindHeaderAccountSelect();
    $("gomo-start-chat")?.addEventListener("click", startChat);
    $("gomo-toast-cta")?.addEventListener("click", startChat);
    $("gomo-toast-dismiss")?.addEventListener("click", () => {
      $("gomo-chat-toast")?.classList.remove("is-visible");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindUi();
    if (typeof window.Genesys === "function") {
      configureGenesys();
    } else {
      setMessengerStatus("Genesys bootstrap failed to load.");
    }
    window.setTimeout(() => {
      $("gomo-chat-toast")?.classList.add("is-visible");
    }, 1500);
  });
})();
