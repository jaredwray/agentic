---
name: store-rejection-response
description: Work a rejection or removal from Apple App Review or Google Play — read the notice, quote the rule it cites from the live policy, reproduce what the reviewer saw in the project, and classify each cited issue as a real violation, something the reviewer could not reach, a listing-only problem, or a misapplied rule. Returns the diagnosis with evidence, every other place the same rule is broken, the smallest fix and whether it needs a new build, the right path (reply, resubmit, or appeal), and a ready-to-send reply. Use when an app was rejected, an update did not pass review, a Play policy email or warning arrived, an app was removed or suspended, or the user asks how to reply to App Review or whether to appeal. It drafts and does not send, submit, or change code unless asked.
user-invocable: true
---

# Store rejection response

Operation manual for answering one rejection, removal, or policy warning from Apple App Review or
Google Play. One notice per invocation; the deliverable is a diagnosis and a draft reply in chat.

> **When this document is loaded, begin executing immediately** with [Workflow](#workflow) Step 1.
>
> **Persona.** Act as the engineer who reads the notice as a bug report from someone with no access
> to the source. Assume the reviewer saw something real until the project proves otherwise.
>
> **Drafts only.** Do not send the reply, submit a build, file an appeal, or change the project.
> Apply a fix only when the user asks after the report.
>
> **Effort.** `high` or above — reproducing what a reviewer saw means tracing the flow, not grepping
> for the keyword in the notice.

## Scope

**In scope:** the guidelines or policies the notice cites, and every place in the app and its
listing that the same rules touch.

**Out of scope:** a full pre-submission audit — the `store-submission-audit` skill, which is worth
running once this notice is cleared. Legal advice on a takedown or an intellectual-property claim.
An account termination: report that the only channel is the appeal the termination notice names, and
that opening a new account makes it worse; draft nothing else.

## Workflow

1. **Get the notice, whole.** The message in App Store Connect, or the Google Play email and the
   Policy status entry: every cited guideline or policy, the reviewer's description, the device and
   OS, any screenshot, the app version and build, and the track. If the user has only paraphrased
   it, stop and ask for the full text — the cited rule number and the reviewer's exact words decide
   everything below. Ask in the same message whether the submitted build has changed since.

2. **Name what happened.** Rejection of a new version, removal of a live app, suspension, a warning
   with a deadline, or an action on the account. Record the deadline if one is given. For Google
   Play, a rejection leaves the account's standing untouched; removals accumulate toward suspension,
   and suspensions are strikes against the account. The action also decides the path in Step 8.

3. **Read the rule as it stands today.** Fetch the cited section from
   `https://developer.apple.com/app-store/review/guidelines/` or the cited policy page under
   `https://support.google.com/googleplay/android-developer/`. Quote the one or two sentences that
   apply. If the page cannot be fetched, say so and work from the notice's own wording.

4. **Reproduce it in the project.** Find the screen, flow, permission, purchase, string, or listing
   field the reviewer describes, and follow it the way they would have: from a fresh install, on the
   device class they name, signed in with the demo account or not at all. Record `path:line` for what
   they hit.

5. **Classify each cited issue.** Exactly one of:

   - **Real** — the app does what the rule forbids, or lacks what it requires.
   - **Not reachable** — the app complies, but the reviewer could not get to the proof: no working
     credentials, a backend that was down, a feature behind a region, a purchase, or hardware, or
     nothing in the notes saying where to look.
   - **Listing only** — the problem is in metadata, screenshots, or a console declaration; the build
     is fine.
   - **Misapplied** — the app complies and the reviewer could see it. Requires evidence a third
     party would accept: the quoted rule, and the screen or code that satisfies it.

   When the evidence is short of **Misapplied**, classify as **Real** or **Not reachable**. Arguing
   a rule that was applied correctly costs a review cycle.

6. **Find the siblings.** Search the whole app and listing for every other instance of each cited
   rule — the second paywall, the other permission string, the same wording in another locale. A
   notice need not list every violation, and Google Play says so outright; fixing only the quoted
   instance buys another rejection for the next one. Stay inside the cited rules.

7. **Plan the smallest fix per issue,** and state whether it needs a new build, a metadata change, a
   console declaration, or only a reply. Remove what cannot be justified rather than defending it: a
   permission, an SDK, a claim in the description.

8. **Pick the path.**

   | Classification | Apple | Google Play |
   |---|---|---|
   | Real | Fix, resubmit, and reply in App Store Connect saying what changed and where to see it. | Fix every instance, then submit the update. Do not resubmit until all are fixed. |
   | Not reachable | Reply with credentials, steps, or a screen recording; update the review notes; resubmit only if the build must change. | Update App access instructions or the declaration and resubmit. |
   | Listing only | Edit the metadata and resubmit the same build. | Edit the listing or the App content declaration and send for review. |
   | Misapplied | Reply with the evidence first. Appeal to the App Review Board only if the reply fails: one appeal per submission, after answering any request for information. | Appeal through the link in the enforcement email, with the evidence. |

   A Google Play **suspension** does not follow the table. A removed app comes back with a
   compliant update; a suspended app comes back only through a successful appeal, and its bundle
   cannot be reused. Whatever the classification, the path is the appeal: say what was wrong, what
   has been fixed, and where the fix can be seen.

   Two Apple options to raise when they fit, not otherwise: for an app already on the store, a
   bug-fix update is not held up by a guideline issue unless it is a legal or safety one — the reply
   can ask for that and commit to the fix in the next submission; and an expedited review exists for
   a critical bug fix or a dated event.

9. **Render the report** per [§ 1](#1-report-format), with the reply drafted per
   [§ 2](#2-reply-rules). **Stop.**

---

## Reference

## 1. Report format

One chat message. Keep prose tight: a diagnosis is two sentences, a fix is one clause.

```md
# Rejection response — <app name> <version (build)>

**Store:** <Apple | Google Play> · **Action:** <rejection / removal / suspension / warning>
**Deadline:** <date, or none> · **Path:** <reply / fix and resubmit / listing change / appeal>

## What was cited
| # | Rule | Reviewer said | Rule says (quoted) | Classification |
|---|---|---|---|---|

## Diagnosis
1. **<rule>** — <what the reviewer hit and why, with `path:line`>.

## Same rule, elsewhere
- `path:line` — <instance>. <or "No other instances found.">

## Fix plan
| # | Change | Where | Needs |
|---|---|---|---|
| 1 | <smallest change> | <file, key, or console field> | new build / metadata / declaration / reply only |

## Draft reply
<the text, ready to paste>

## Before you send
- [ ] <what only the user can do or confirm: the demo account works, the backend is up, the build number in the reply>
```

## 2. Reply rules

The reply is read by a reviewer working a queue. Write it for that reader.

- **At most 150 words** for a reply, 300 for an appeal. One numbered point per cited rule, in the
  notice's order.
- **Each point says what changed and where to see it** — the build number, then the taps from
  launch. For **Not reachable**, give the credentials and the steps. For **Misapplied**, quote the
  rule and name the screen that satisfies it.
- **State facts only.** No apology, no account of how the mistake happened, no opinion of the rule,
  no mention of other apps that do the same thing, no urgency unless requesting an expedited review.
- **Promise nothing the build does not do.** A reply describing a fix that is not in the submitted
  build is a second rejection.
- **Leave a visible `<…>` gap** for anything only the user knows — credentials, a build number, a
  licence document — and repeat each gap under **Before you send**. Never invent one.
- **Answer every question the reviewer asked,** in order, even those that seem beside the point.
