# Stripe TEST-MODE setup for Profetix
**Do not create live Payment Links. Do not merge this branch.**

## Connection state (2026-11-12)
Stripe connector currently exposes only **Profetix (livemode=true)**. Test/sandbox mode is not exposed through the connected account session. Therefore no Stripe API write has been made, and no test checkout link exists yet.

## Enable a test-only environment
1. In the Stripe Dashboard, switch to **Sandboxes / Test mode** and create or select a sandbox.
2. Make that sandbox available to the ChatGPT Stripe connection if the integration supports it. Confirm that the connected session exposes `livemode=false`.
3. Alternatively, create test products and test Payment Links manually in the Stripe sandbox dashboard; do not use live links.
4. Use one-time products: **Profetix AI Business Starter Kit, CAD 49.00** and **Profetix AI Automation Toolkit, CAD 199.00**.
5. Keep automatic tax **off for the test configuration pending tax review**. Do not assume this determines real-world tax obligations.
6. Use Stripe test webhook secrets and test API keys **only in private deployment environment variables**, never GitHub.
7. Before launch, verify digital delivery and complete the checklist in `TAX-AND-LAUNCH-GATE.md`.

## Manual test acceptance criteria
- Test card purchase succeeds; only paid session triggers email.
- No email on failed, canceled, or unpaid payment.
- Duplicate webhook does not cause duplicate fulfillment.
- Wrong payment link ID cannot download a different product.
- Download link expires as intended.
- Customer support can resolve delivery failure.
- Private ZIPs are never accessible from GitHub Pages.
- Live website and live Stripe account remain unchanged.
