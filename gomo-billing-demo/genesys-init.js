/**
 * Must run synchronously right after genesys.min.js — before the SDK bootstraps.
 */
(function () {
  var cfg = window.GOMO_MESSENGER_CONFIG || {};
  var deploymentId = cfg.deploymentId || "b6d540d6-eaa6-43d0-9939-83dbe60489ad";
  var environment = cfg.environment || "prod-euc1";

  window.GomoMessenger = window.GomoMessenger || { ready: false };

  if (typeof window.Genesys !== "function") {
    console.error("Genesys bootstrap not loaded before genesys-init.js");
    return;
  }

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
          window.GomoMessenger.ready = true;
          window.dispatchEvent(new CustomEvent("gomo-messenger-ready"));
        },
      },
    ]);
  });

  window.Genesys("configure", {
    deploymentId: deploymentId,
    environment: environment,
    debug: Boolean(cfg.debug),
  });
})();
