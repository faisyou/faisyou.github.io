# GoMo billing — Web Messaging demo (static site)

This folder is **plain static HTML/JS/CSS**. No build step, no Python, no Node server in production.

Copy these files into your **Git WebIO** (or any static host) repository and publish:

| File | Required |
| --- | --- |
| `index.html` | Yes |
| `genesys-init.js` | Yes (configure Genesys immediately after bootstrap) |
| `genesys-launcher.js` | Yes |
| `demo-accounts.js` | Yes (mock bill data for the page) |
| `config.js` | Yes (`deploymentId` already set for this demo) |
| `config.example.js` | Optional template |

Genesys loads from `https://apps.mypurecloud.de/genesys-bootstrap/genesys.min.js` in the browser. Your site only needs to be served over **https://** (or **http://** on localhost)—not as `file://` on disk.

## WebIO / static hosting

1. Copy the four files above into the WebIO repo (often repo root, or a folder that becomes the site root).
2. Edit `config.js` with your Messenger **deployment ID** and `environment` (`prod-euc1` for EU).
3. Commit and push; open the WebIO URL (e.g. `https://<your-org>.webio.../index.html` or `/` if `index.html` is the default document).
4. In Architect, map participant data key **`account_id`** (from `Database.set`) into the AVA / inbound flow start context.

If the site is published in a **subpath** (e.g. `https://host/demo/billing/`), keep `index.html`, `config.js`, and `genesys-launcher.js` in the **same directory** so relative `./config.js` and `./genesys-launcher.js` still resolve.

## Behaviour

1. Visitor picks a demo `account_id` (`1108842001`–`1108842004`).
2. **Start chat** runs `Database.set` with `customAttributes.account_id`, then `Messenger.open`.
3. Default Genesys launcher is hidden; toaster + custom panel are used instead.

## Local preview (optional)

Python is **not required** for WebIO—only if you want to preview on your laptop without pushing:

```bash
cd billing-tools/web-messaging-demo
python3 -m http.server 8080
```

Any static server (VS Code Live Server, `npx serve`, nginx, WebIO itself) works the same way.

## References

- [Messenger SDK plugin examples](https://developer.genesys.cloud/commdigital/digital/webmessaging/messengersdk/pluginExamples)
- [Database plugin](https://developer.genesys.cloud/commdigital/digital/webmessaging/messengersdk/SDKCommandsEvents/databasePlugin)
- Test account meanings: [`../ACCOUNTS.md`](../ACCOUNTS.md)
