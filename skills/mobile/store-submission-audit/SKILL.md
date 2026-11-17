---
name: store-submission-audit
description: Pre-submission audit of an iOS or Android app against the Apple App Review Guidelines and the Google Play Developer Program Policies — upload gates, reviewer access, privacy declarations, permissions, account deletion, payments, content and audience, the store listing, and console state. Reads the project (native, Flutter, React Native, Expo, Capacitor), loads only the rules for the stores it ships to, refreshes dated values from the live policy pages, and returns a findings table with the cited rule and smallest fix, a worksheet of what the privacy label and Data safety form should say, a list of what only the console can show, and a verdict. Use when asked whether an app is ready to submit, to check an app before App Store or Google Play review, to audit App Store or Play policy compliance, or to find what will get an app rejected. Read-only; it does not fix or submit.
user-invocable: true
---

# Store submission audit

Operation manual for auditing a mobile app **before** it goes to App Review or Google Play review.
One audit per invocation; the deliverable is a report in chat.

> **When this document is loaded, begin executing immediately** with [Workflow](#workflow) Step 1.
> Stop to ask only where a step says to.
>
> **Persona.** Act as the release engineer who has to answer for the rejection. The reviewer has one
> device, a few minutes, the build, the listing, and the notes — nothing the team knows but did not
> write down. Audit from that seat.
>
> **Read-only.** Do not edit the project, change anything in App Store Connect or Play Console, or
> run a submit command. Fix a finding only when the user asks after the report.
>
> **The store's page outranks this manual.** Rules files carry the date they were checked. Where a
> live page disagrees, the page is right: audit against it and say so in the report.
>
> **Effort.** `high` or above. Below that the sweep stops at the manifest and misses what lives in
> SDKs, paywalls, and sign-up flows. If you are running lower, label the report thin.

## Scope

**In scope:** store policy as it applies to this project — the app's code and configuration, its
third-party SDKs, any listing metadata tracked in the repo, and console state the user reports.

**Out of scope:**

- **Law.** GDPR, COPPA, the EU AI Act, the European Accessibility Act, consumer and gambling law.
  Passing review is not legal clearance. Name the regimes the app's profile points at in the report's
  last section and audit none of them.
- Other stores (Amazon, Galaxy Store, AppGallery, alternative marketplaces).
- Vulnerabilities — the `security-audit` skill. Code quality — the `code-review` skill.
- An app that was already rejected — the `store-rejection-response` skill.

## Workflow

1. **Find the app and the stores.** Enumerate tracked files only (`git ls-files`).

   | Marker | Store | Rules |
   |---|---|---|
   | `*.xcodeproj`, `*.xcworkspace`, or an `ios/` folder | Apple | [stores/apple.md](./stores/apple.md) |
   | `AndroidManifest.xml`, a Gradle `com.android.application` module, or an `android/` folder | Google Play | [stores/google-play.md](./stores/google-play.md) |
   | An Expo project — `expo` in `package.json` with `app.json` or `app.config.*` — and no tracked native folders | Each store in the config's `platforms`. Unset, that is both `ios` and `android`. | The rules file for each |

   Read the rules file of every store the app ships to, and only those. If the user named one store,
   audit that one. Each rules file has the same sections: **Live values**, **Upload gates**,
   **Reviewer access**, **Privacy declarations**, **Permissions**, **Accounts**, **Payments**,
   **Content and audience**, **Listing**, **Functionality**, and **Console**.

   For a cross-platform app, find where the native configuration is generated from per
   [reference.md](./reference.md) § 3 and audit the source of
   truth, not a stale generated folder.

   Stop and ask which app to audit if the repo holds several and the user named none. Stop and report
   if there is no mobile app.

2. **Refresh the live values.** Fetch each page in the rules file's **Live values** section and read
   off the value it names. Record the value and the page's date. If a page cannot be fetched, use the
   value in the rules file and mark every check that depends on it `unverified`.

3. **Profile the app.** From the code, not the README, record one line each: what the app does;
   sign-in and account creation; what it sells and through which payment path; user-generated or
   AI-generated content; audience (children, mixed, adults); regulated category (health, finance,
   gambling, VPN, crypto); every permission and entitlement in the merged configuration; every
   third-party SDK with what it collects; every outbound host that receives personal data. The profile
   decides which conditional checks apply and feeds Step 5.

4. **Sweep every section — full coverage, no pre-filtering.** For each store, walk the rules file
   section by section. For every check that applies to the profile, record one candidate:

   - **State:** `fail` (evidence shows a violation), `pass`, or `cannot see` (the answer lives in the
     console, on the server, or on a device).
   - **Evidence:** `path:line`, the manifest key, or the metadata file — or, for `cannot see`, exactly
     what a person must look at.
   - **Rule:** the guideline number or policy name from the rules file.

   Record every candidate, however small; Step 6 decides what survives. Never record `pass` for
   something the repo cannot show.

5. **Derive the declarations.** Build the worksheet in
   [reference.md](./reference.md) § 2: one row per data type the app or an SDK
   collects, with what Apple's privacy label and Google's Data safety form must therefore declare.
   A mismatch between declaration and behavior is the most common privacy rejection on both stores,
   and the declaration itself is in the console where this audit cannot read it.

6. **Filter, then rate.** Drop a `fail` that has no evidence or no rule. Rate each survivor once:

   - **Blocker** — the upload is refused, or the rule is explicit and the violation is visible to a
     reviewer or an automated scan.
   - **High** — likely rejection, or a policy strike after release.
   - **Advisory** — depends on reviewer judgment, or will become a blocker on a dated change.

7. **Render the report** per [reference.md](./reference.md) § 1, with the verdict:

   - **Blocked** — at least one Blocker.
   - **Not ready** — no Blocker, at least one High.
   - **Clear in the repo** — neither. The **Confirm in the console** list still stands; say how many
     items it holds. Never write "ready to submit" while that list is non-empty.

8. **Stop.** Offer two follow-ups and do neither unasked: apply the fixes, or draft the reviewer notes
   per [reference.md](./reference.md) § 4.
