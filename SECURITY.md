# Security

This is a demo app for the `@umohpyro/better-auth-nuvion` plugin. It runs against Nuvion's test environment only and should never be given live keys or real customer data.

## Reporting a problem

Please report vulnerabilities privately through GitHub: **Security** tab, **Report a vulnerability**. Do not open a public issue for a security problem, and leave personal data out of any report.

I aim to acknowledge a report within 5 working days. This is a volunteer-maintained demo, so there is no bounty and no guaranteed fix time.

## What the demo does with secrets

- The Nuvion key and webhook secret you paste are encrypted (AES-256-GCM) on the server and never sent back to the browser.
- Settings, **Delete my account** removes your data, your Nuvion connection and the webhooks the demo created. See the privacy notice at `/privacy`.
