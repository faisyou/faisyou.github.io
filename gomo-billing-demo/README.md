# GoMo billing — Web Messaging demo (static site)

Plain static HTML + one JavaScript file. No build step.

## Copy to Git WebIO (minimum)

| File | Purpose |
| --- | --- |
| `index.html` | Page + **official Genesys bootstrap snippet** (`deploymentId` / `environment` in snippet) |
| `gomo-billing-demo.js` | Bill UI, plugin, `Database.set`, `Messenger.open` |

**Do not** deploy old files `genesys-init.js`, `genesys-launcher.js`, or a second copy of the plugin — that causes “Name is already taken”.

Optional (not loaded by `index.html`): `demo-accounts.js`, `config.js`, `config.example.js`.

## Change deployment

Edit the object at the bottom of `index.html` (inside the Genesys IIFE):

```javascript
{
  environment: "prod-euc1",
  deploymentId: "b6d540d6-eaa6-43d0-9939-83dbe60489ad",
}
```

Do **not** add a separate `<script src="genesys.min.js">` or `Genesys('configure', …)` — the snippet loads and configures in one step.

## Flow

1. Account dropdown (header) → bill summary on page.
2. **Start chat** (enabled after `Database.ready` + `Launcher.ready`) → `Database.set` with `account_id` → `Messenger.open` or `Launcher.open`.

If the console shows **Could not load plugin file: messenger.min.js**, you clicked before the SDK was ready or the host blocks Genesys plugin scripts — wait for “Ready to chat”, disable ad blockers, and add your WebIO URL to the deployment **Allowed domains** in Genesys Admin.

Architect: **Get Participant Data** key `account_id`.

## References

- [Database plugin](https://developer.genesys.cloud/commdigital/digital/webmessaging/messengersdk/SDKCommandsEvents/databasePlugin)
- Test account meanings: [`../ACCOUNTS.md`](../ACCOUNTS.md)
