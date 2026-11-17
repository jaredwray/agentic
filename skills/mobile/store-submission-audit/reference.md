# Store submission audit — reference

## 1. Report format

One chat message. A finding is one table row, not a paragraph. No praise, no restating what the app
does, no general advice about the stores.

```md
# Store submission audit — <app name> (<bundle ID / application ID>)

**Stores:** <Apple | Google Play | both> · **Verdict:** Blocked / Not ready / Clear in the repo
**Policy read:** <App Review Guidelines, last updated <date>> · <Play target API page, <value>>
<one line per `unverified` live value, or omit>

## Summary
<2–3 sentences: the reason for the verdict, the headline problem first.>

## Findings
| # | Sev | Store | Rule | Finding | Evidence | Smallest fix |
|---|---|---|---|---|---|---|
| 1 | Blocker | Apple | 5.1.1(v) | Account creation with no in-app deletion | `src/screens/Settings.tsx` — no delete path | Add a delete-account action that removes the record server-side |

## Declarations to match
| Data | Collected by | Linked to user | Used for | Apple privacy label | Play Data safety |
|---|---|---|---|---|---|

## Confirm in the console
- [ ] <store> — <what to open, what it must say>. <rule>

## Section sweep
- **Upload gates:** <"2 findings" / "no findings" / "unverified: <why>">
- …one line per rules-file section, per store.

## Not audited — law
<one line: the regimes this app's profile points at, e.g. "COPPA (child audience), GDPR (EU
storefronts)". No analysis.>
```

Rules:

- **Order findings** Blocker, High, Advisory; within a severity, upload gates first.
- **Every finding has evidence and a rule.** A row without both is not a finding.
- **Smallest fix** names the file, key, or console field to change — one clause. "Review your privacy
  practices" is not a fix.
- **Confirm in the console** holds every `cannot see` candidate, one line each, phrased as a thing to
  open and a value to expect. Order by cost of being wrong: reviewer access and privacy declarations
  first.
- **Section sweep** lists every section of every rules file read, including the ones with no findings.
- A check that depends on an unfetched live value is reported as `unverified`, never as `pass`.

## 2. Declaration worksheet

Fill the report's **Declarations to match** table from the Step 3 profile. One row per data type; if
two SDKs collect the same type, name both in **Collected by**.

| Column | Value |
|---|---|
| Data | The type in plain words: precise location, email address, device ID, purchase history, crash logs, photos, contacts, health data, user content sent to an AI provider. |
| Collected by | App code (`path`) or the SDK by name. An SDK's own privacy manifest or the vendor's data-disclosure page is the source for what it collects. |
| Linked to user | `yes` if stored or sent with an account ID, device ID, or anything that ties it to the person; otherwise `no`. |
| Used for | App functionality, analytics, advertising, personalization, fraud prevention. Name every purpose that applies. |
| Apple privacy label | The data type and purpose to select in App Store Connect, whether it is "linked to you", and whether it is "used to track you" (shared with a data broker, or combined with third-party data for advertising). |
| Play Data safety | The data type to declare as **collected**, whether it is also **shared** (transferred to a third party that is not a service provider acting for the developer), whether collection is optional, and whether it is encrypted in transit. |

Data that never leaves the device is not collected under either store's definition; leave it out and
say so under the table if the app holds sensitive data on-device only.

## 3. Where the native configuration lives

The stores review the built app. In a cross-platform project the built `Info.plist` and
`AndroidManifest.xml` are generated, so audit the file they are generated from.

| Project | iOS source of truth | Android source of truth |
|---|---|---|
| Native | `Info.plist`, `*.entitlements`, `PrivacyInfo.xcprivacy`, the `.pbxproj` build settings | `AndroidManifest.xml` of every module, `build.gradle` / `build.gradle.kts`, version catalog |
| Expo, no tracked `ios/` or `android/` (prebuild) | `app.json` / `app.config.*`: `ios.infoPlist`, `ios.entitlements`, `ios.privacyManifests`, config plugins | `app.json` / `app.config.*`: `android.permissions`, `android.blockedPermissions`, `expo-build-properties`, config plugins |
| Expo or React Native with tracked native folders | `ios/<App>/Info.plist` and the rest of the native set | `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle` |
| Flutter | `ios/Runner/Info.plist`, `ios/Runner/*.entitlements` | `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle*`; `targetSdk` may resolve to `flutter.targetSdkVersion` from the pinned Flutter SDK |
| Capacitor, Cordova | `ios/App/App/Info.plist`; Cordova `config.xml` `<edit-config>` | `android/app/src/main/AndroidManifest.xml`, `android/variables.gradle`; Cordova `config.xml` |

Two things the app's own files never show:

- **Permissions and API use added by dependencies.** A plugin or SDK can add a permission, link a
  protected API, or call a required-reason API. On Android the merged manifest is the truth
  (`./gradlew :app:processReleaseMainManifest`, then the file under `build/intermediates/merged_manifests/`);
  when it cannot be built, read each dependency's own manifest. On iOS, read each dependency's
  `PrivacyInfo.xcprivacy` and podspec or package manifest.
- **Code shipped after review.** An over-the-air JavaScript updater (`expo-updates`, CodePush and
  its successors) is in scope for the **Functionality** section of both rules files.

## 4. Reviewer notes

Draft only when the user asks. The notes go in App Store Connect under **App Review Information**
and, for Google Play, in **App content → App access**. Keep the whole draft under 250 words; a
reviewer reads it once.

```text
WHAT THE APP DOES
<one or two sentences, in the words the listing uses>

HOW TO GET IN
Account: <user> / <password>   (no 2FA, no email verification; valid through <date>)
<or: no sign-in needed>
<or: demo mode — how to enter it>

WHERE TO FIND WHAT NEEDS REVIEWING
1. <feature> — <taps from launch>
2. <each in-app purchase> — <where it is offered>
3. <each permission> — <the screen that asks, and the feature that needs it>
4. Delete account — <taps from launch>

ANYTHING THAT NEEDS EXPLAINING
<hardware, a region lock, a feature that depends on time or location, why a restricted
permission or entitlement is needed, licenses for a regulated category>

CONTACT
<name, phone with country code, email>
```

- Fill every line from the code and the profile; leave a visible `<…>` gap for anything only the
  user knows, and list those gaps under the draft.
- Never invent credentials. If no demo account exists, say so and stop — that is a finding, not a
  field to fill.
- For an update, replace the first section with what changed in this version, specifically. A
  generic "bug fixes and improvements" is acceptable only when that is all the update contains.
