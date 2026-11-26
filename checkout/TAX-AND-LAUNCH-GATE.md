# Profetix tax and payment launch gate
**State: HOLD — not authorized for live sales.**
Business owner reports Profetix is **not registered for GST/HST** and has approximately **CA$0 in taxable revenue over the last 12 months**. This is consistent with small-supplier status if there are no associated-person supplies or other special circumstances. Do not represent this as a determination that tax is never owed.

## Canadian GST/HST
For most Canadian businesses, CRA's small-supplier threshold is CA$30,000 of worldwide taxable supplies in a single calendar quarter or across four consecutive calendar quarters (subject to details and associated-person rules). Review CRA guidance and verify business-specific facts before launch:
https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html

- [x] Owner reports CA$0 taxable revenue over last 12 months (self-reported, not independently verified).
- [ ] Confirm worldwide taxable supplies in each relevant calendar quarter, including any associated persons or businesses.
- [ ] Confirm whether mandatory registration applies, and whether voluntary registration is planned.
- [ ] Determine treatment of Canadian and international digital product sales, including other jurisdictions.
- [ ] Confirm pricing display, invoice/receipt wording, refund policy, terms, and product license.
- [ ] Confirm with a qualified Canadian tax professional if uncertain.
- [ ] Configure Stripe Tax only when obligations and registrations are established; do not charge GST/HST merely because Stripe offers the feature.

## Payment launch gate
- [ ] Two Stripe catalog products and CAD prices checked.
- [ ] Test-mode checkout links created and kept off the public site.
- [ ] Digital ZIPs generated and stored privately.
- [ ] Backend deployed with Stripe test credentials and a signed webhook.
- [ ] Resend verified sender and delivery service connected.
- [ ] Persist webhook idempotency and retries, and secure download tokens against unwanted sharing.
- [ ] Test success, failure, duplicate webhooks, expired downloads, refunds and customer support.
- [ ] Legal/tax review complete and approved.
- [ ] Explicit authorization to enable live checkout and merge the website.

## Current implementation status
Only staging code and product source files exist in the GitHub development branch. No payment links have been created or activated by this work. No production site changes.
