/**
 * GoMo billing demo — bill UI + Genesys Web Messaging (Database.set + open chat).
 * Load after the Genesys bootstrap snippet in index.html (deploymentId/environment live there).
 */
(function () {
  // BEGIN GENERATED DEMO ACCOUNTS (npm run demo:build)
  const DEMO_ACCOUNTS = {
    "currency": "EUR",
    "catalog_version": "2.2",
    "accounts": {
      "1108852001": {
        "profile": "Roaming disaster",
        "plan_label": "€9.99 Essential",
        "plan_tier": "9.99",
        "description": "Low fixed price then a brutal roaming month: premium add-on fee plus EU/US roaming voice and data.",
        "sample_question": "Why is my bill €68.38? I only pay €9.99 a month!",
        "bills": [
          {
            "bill_id": "GB202610201",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "68.38",
              "recurring": "9.99",
              "one_off": "5.99",
              "usage": "52.40"
            },
            "comparison_to_previous": {
              "total_delta": "56.39",
              "usage_delta": "50.40"
            }
          },
          {
            "bill_id": "GB202609201",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "11.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "2.00"
            },
            "comparison_to_previous": {
              "total_delta": "2.00",
              "usage_delta": "2.00"
            }
          },
          {
            "bill_id": "GB202608201",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607201",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606201",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      },
      "1108852002": {
        "profile": "Plan upgrade data surge",
        "plan_label": "€9.99 → €12.99 Mid",
        "plan_tier": "12.99",
        "description": "Plan step-up from Essential to Mid tier, then a heavy EU data binge on the latest statement.",
        "sample_question": "My plan says €12.99 now — why is the bill €31.49?",
        "bills": [
          {
            "bill_id": "GB202610202",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "31.49",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "18.50"
            },
            "comparison_to_previous": {
              "total_delta": "18.42",
              "usage_delta": "18.42"
            }
          },
          {
            "bill_id": "GB202609202",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "13.07",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "0.08"
            },
            "comparison_to_previous": {
              "total_delta": "3.08",
              "usage_delta": "0.08"
            }
          },
          {
            "bill_id": "GB202608202",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607202",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606202",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      },
      "1108852003": {
        "profile": "Premium addons voice",
        "plan_label": "€14.99 Plus drama",
        "plan_tier": "14.99",
        "description": "Device installment hit, GoMo Plus recurring bump, then a voice-call spike on the latest bill.",
        "sample_question": "Explain the €44.58 bill — I thought I was on €14.99?",
        "bills": [
          {
            "bill_id": "GB202610203",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "44.58",
              "recurring": "19.98",
              "one_off": "0.00",
              "usage": "24.60"
            },
            "comparison_to_previous": {
              "total_delta": "3.39",
              "usage_delta": "23.40"
            }
          },
          {
            "bill_id": "GB202609203",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "41.19",
              "recurring": "14.99",
              "one_off": "25.00",
              "usage": "1.20"
            },
            "comparison_to_previous": {
              "total_delta": "26.20",
              "usage_delta": "1.20"
            }
          },
          {
            "bill_id": "GB202608203",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607203",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606203",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      },
      "1108852004": {
        "profile": "Mms picture storm",
        "plan_label": "€9.99 — MMS storm",
        "plan_tier": "9.99",
        "description": "Three flat months on Essential, then a picture-message burst (group chat gone wrong).",
        "sample_question": "Why am I paying €34.84 when my plan is only €9.99?",
        "bills": [
          {
            "bill_id": "GB202610204",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "34.84",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "24.85"
            },
            "comparison_to_previous": {
              "total_delta": "24.40",
              "usage_delta": "24.40"
            }
          },
          {
            "bill_id": "GB202609204",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "10.44",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.45"
            },
            "comparison_to_previous": {
              "total_delta": "0.45",
              "usage_delta": "0.45"
            }
          },
          {
            "bill_id": "GB202608204",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607204",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606204",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      },
      "1108852005": {
        "profile": "Lost device fee",
        "plan_label": "€9.99 — device replacement",
        "plan_tier": "9.99",
        "description": "Minimal usage customer hit with a one-off lost-SIM / replacement charge.",
        "sample_question": "What's this €24.99 charge? I barely use the phone.",
        "bills": [
          {
            "bill_id": "GB202610205",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "24.99",
              "recurring": "9.99",
              "one_off": "15.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "14.88",
              "usage_delta": "-0.12"
            }
          },
          {
            "bill_id": "GB202609205",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "10.11",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.12"
            },
            "comparison_to_previous": {
              "total_delta": "0.12",
              "usage_delta": "0.12"
            }
          },
          {
            "bill_id": "GB202608205",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607205",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606205",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "9.99",
              "recurring": "9.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      },
      "1108852006": {
        "profile": "Mid tier roaming weekend",
        "plan_label": "€12.99 — weekend roaming",
        "plan_tier": "12.99",
        "description": "Stable Mid plan; short EU weekend trip drives a sharp roaming voice + data hit.",
        "sample_question": "I'm on €12.99 — why is this bill €47.89?",
        "bills": [
          {
            "bill_id": "GB202610206",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "47.89",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "34.90"
            },
            "comparison_to_previous": {
              "total_delta": "33.40",
              "usage_delta": "33.40"
            }
          },
          {
            "bill_id": "GB202609206",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "14.49",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "1.50"
            },
            "comparison_to_previous": {
              "total_delta": "1.50",
              "usage_delta": "1.50"
            }
          },
          {
            "bill_id": "GB202608206",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "12.99",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607206",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "12.99",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606206",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "12.99",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      },
      "1108852007": {
        "profile": "Mid activation double hit",
        "plan_label": "€12.99 — activation + SMS pile",
        "plan_tier": "12.99",
        "description": "New Mid line: setup fee on first full month plus international SMS cluster.",
        "sample_question": "First bill on Mid is €29.47 — is that normal?",
        "bills": [
          {
            "bill_id": "GB202610207",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "21.59",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "8.60"
            },
            "comparison_to_previous": {
              "total_delta": "-7.88",
              "usage_delta": "2.11"
            }
          },
          {
            "bill_id": "GB202609207",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "29.47",
              "recurring": "12.99",
              "one_off": "9.99",
              "usage": "6.49"
            },
            "comparison_to_previous": {
              "total_delta": "16.48",
              "usage_delta": "6.49"
            }
          },
          {
            "bill_id": "GB202608207",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "12.99",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607207",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "12.99",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606207",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "12.99",
              "recurring": "12.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      },
      "1108852008": {
        "profile": "Plus flat control",
        "plan_label": "€14.99 — flat control",
        "plan_tier": "14.99",
        "description": "Five identical Plus statements — agent must say total did not increase (Δ €0.00).",
        "sample_question": "Did my bill go up this month?",
        "bills": [
          {
            "bill_id": "GB202610208",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202609208",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202608208",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607208",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606208",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      },
      "1108852009": {
        "profile": "Cruise ship roaming",
        "plan_label": "€14.99 — cruise roaming",
        "plan_tier": "14.99",
        "description": "Maritime/satellite roaming megaspike on otherwise calm Plus account.",
        "sample_question": "My bill is over €100 — I was on a cruise, what happened?",
        "bills": [
          {
            "bill_id": "GB202610209",
            "billing_date": "2026-10-01",
            "amounts": {
              "total": "106.24",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "91.25"
            },
            "comparison_to_previous": {
              "total_delta": "90.90",
              "usage_delta": "90.90"
            }
          },
          {
            "bill_id": "GB202609209",
            "billing_date": "2026-09-01",
            "amounts": {
              "total": "15.34",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.35"
            },
            "comparison_to_previous": {
              "total_delta": "0.35",
              "usage_delta": "0.35"
            }
          },
          {
            "bill_id": "GB202608209",
            "billing_date": "2026-08-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202607209",
            "billing_date": "2026-07-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          },
          {
            "bill_id": "GB202606209",
            "billing_date": "2026-06-01",
            "amounts": {
              "total": "14.99",
              "recurring": "14.99",
              "one_off": "0.00",
              "usage": "0.00"
            },
            "comparison_to_previous": {
              "total_delta": "0.00",
              "usage_delta": "0.00"
            }
          }
        ]
      }
    }
  };

  const ACCOUNT_ORDER = ["1108852001","1108852004","1108852005","1108852002","1108852006","1108852007","1108852003","1108852008","1108852009"];
  // END GENERATED DEMO ACCOUNTS

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
    $("gomo-bill-plan").textContent = account.plan_label || "—";
    var hint = $("gomo-bill-sample-question");
    if (hint) {
      hint.textContent = account.sample_question ? "Try asking: “" + account.sample_question + "”" : "";
      hint.hidden = !account.sample_question;
    }
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
          euro(b.amounts.one_off || "0.00") +
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
