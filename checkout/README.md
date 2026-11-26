# Profetix Stripe delivery — staging
This source is **not deployed**. Do not link checkout buttons or accept payment before testing.

Architecture: Stripe Payment Links for two digital products (CA$49 and CA$199), a separate Node backend for signed webhooks, verified buyer downloads, and email fulfillment via Resend. Custom consulting is invoiced after scope agreement.

Setup:
1. Create test-mode Stripe Payment Links; collect email; copy their `plink_` IDs.
2. Deploy `checkout/server.js` as a Node service with HTTPS and a private filesystem containing `private/starter-kit.zip` and `private/automation-toolkit.zip`.
3. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PAYMENT_LINK_ID`, `STRIPE_AUTOMATION_PAYMENT_LINK_ID`, `PUBLIC_BASE_URL`, `RESEND_API_KEY`, and `DELIVERY_FROM_EMAIL` in host secrets.
4. Configure Stripe webhook `POST /api/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Redirect Payment Links to a generic thank-you page.
5. Verify test purchases, delivery, delayed payments, retries, invalid signatures, expired links, and refund handling before production.

**Important:** Product archives must stay private, not in this public GitHub repository. Fulfillment must be idempotent and persist event processing state before launch; the initial implementation uses an email idempotency key but is not a complete transactional queue. Check tax, privacy, license, and refund requirements before selling. Stripe account and external services are not connected by this code.
