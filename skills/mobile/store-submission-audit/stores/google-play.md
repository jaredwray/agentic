# Google Play

Rules for an app published through Play Console. Names in parentheses are policies in the Google Play
Developer Program Policies or Play Console requirements. Checked on **November 17, 2026**.

Each check says what fails, then **Look:** where the evidence is. A check whose evidence is not in
the repo is `cannot see` — it goes to the report's console list, never to `pass`.

Every policy page lives under `https://support.google.com/googleplay/android-developer/answer/<id>`;
the ids are given so a rule can be read in full.

## Live values

Fetch these before the sweep. The page is right where it differs from this file.

| Page | Read off |
|---|---|
| answer `11926878` — Target API level requirements | The minimum `targetSdk` for new apps and updates. When this was written: API 36 for phone and tablet apps since August 31, 2026, with an extension to November 1, 2026 on request; API 35 for Wear OS and Android Automotive OS; API 34 for Android TV and Android XR. |
| `https://developer.android.com/google/play/billing/deprecation-faq` | The minimum Play Billing Library major version. When this was written: version 8, on the same dates. |
| answer `9888170` — Permissions and APIs that Access Sensitive Information | The "Changes are coming" notice at the top: restrictions with a future effective date. When this was written it announced, from January 27, 2027, the location button and a fine-location declaration for apps targeting API 37, and the Contact Picker in place of broad contacts access; later dates cover the local network and manage-contacts permissions. Report an affected permission as Advisory with its date. |
| answer `14151465` — App testing requirements | The closed-test numbers for new personal accounts. |

## Upload gates

These stop a release in Play Console before any review.

- **Target API level.** `targetSdk` below the live minimum cannot be uploaded (Target API level
  requirements). **Look:** `targetSdk` / `targetSdkVersion` in the app module's Gradle file, the
  version catalog, `gradle.properties`, `expo-build-properties`, `android/variables.gradle`, or the
  pinned Flutter SDK's default.
- **App bundle, release-signed.** New apps upload an Android App Bundle, not an APK, signed with the
  upload key and not debuggable. **Look:** the CI task (`bundleRelease`), the release `signingConfig`,
  `android:debuggable` and `debuggable true` in the release build type.
- **Version code** is higher than every one uploaded before. **Look:** `versionCode` and the CI step
  that sets it.
- **64-bit.** An app with native code ships 64-bit libraries for each 32-bit ABI it ships.
  **Look:** `abiFilters`, `ndk` blocks, and prebuilt `.so` folders under `jniLibs`.
- **16 KB page size.** An app targeting API 35 or higher with native code supports 16 KB memory
  pages. **Look:** the Android Gradle Plugin and NDK versions, and old prebuilt `.so` files from SDKs.
- **Billing library floor.** An app using Play Billing is on a supported major version.
  **Look:** `com.android.billingclient:billing` in the dependency tree, including the copy a
  purchases SDK or cross-platform plugin brings in.
- **Declared permissions have their declarations.** A bundle requesting a permission that needs a
  Permissions Declaration blocks every change to the app until the declaration is filed or the
  permission is removed — on test tracks too (Declare permissions for your app, answer `9214102`).
  See [Permissions](#permissions) for the list.
- **App content complete.** Every declaration on the App content page is filed. See
  [Console](#console).

## Reviewer access

- **A way in.** If any part of the app is behind sign-in, a paywall, or a location, the App access
  section holds working credentials or instructions (Prepare your app for review, answer `9859455`).
  The account needs no second factor and does not expire. **Look:** whether a sign-in wall exists;
  the credentials are `cannot see`.
- **It works.** Apps that crash, freeze, or do not respond are rejected (Minimum Functionality).
  The release build points at production services. **Look:** release config for `localhost`,
  `10.0.2.2`, `staging`, `ngrok`, and test keys; placeholder text and unreachable screens.
- **Demonstrations exist.** Each permission declaration and each foreground service type declared
  needs a video showing the user triggering the feature (answers `9214102`, `13392821`).

## Privacy declarations

- **Privacy policy everywhere.** Every app links one in the listing and inside the app, even if it
  collects nothing. The page is public, on HTTPS, reachable worldwide without sign-in, a web page
  rather than a PDF, and specific to this app (User Data, answer `10144311`; answer `9859455`).
  **Look:** the in-app link and the URL it opens.
- **Data safety form matches behavior.** The form covers everything the app and its SDKs collect
  and share (User Data; Data safety, answer `10787469`). **Look:** the Step 5 worksheet. The form is
  `cannot see`.
- **Prominent disclosure before unexpected collection.** Where collection would not be expected —
  in the background, or for a purpose unrelated to the visible feature — the app shows an in-app
  disclosure and gets an affirmative action before the permission request. A privacy policy or terms
  of service does not count (User Data). **Look:** the screen shown before each sensitive permission
  request.
- **No sale of personal and sensitive data,** by the app or any SDK in it. Third-party AI
  integrations are held to the same disclosure, consent, and limited-use rules (User Data).
- **Identifiers.** Persistent device identifiers are not linked to the advertising ID or to personal
  data. The advertising ID is used only for advertising and analytics; an app targeting API 33 or
  higher that reads it declares `com.google.android.gms.permission.AD_ID`. **Look:** the merged
  manifest; code reading `ANDROID_ID`, IMEI, or serial alongside the advertising ID.
- **Encrypted in transit.** Personal and sensitive data moves over modern cryptography (User Data).
  **Look:** `android:usesCleartextTraffic="true"`, a network security config that permits cleartext,
  `http://` endpoints.
- **Age signals stay narrow.** Data from the Play Age Signals API is not used for advertising,
  analytics, or profiling (answer `9888170`).

## Permissions

Read the **merged** manifest: SDKs add permissions the app's own manifest never names.

- **Core, promoted, in context.** A sensitive permission is necessary for a feature the listing
  promotes, requested at the moment that feature needs it, and the app accommodates a refusal
  (Permissions and APIs that Access Sensitive Information, answer `9888170`). **Look:** each
  `<uses-permission>` against a call site and a listing claim; remove with `tools:node="remove"` what
  an SDK adds and the app does not use.
- **Restricted permissions.** Each needs the stated justification, and most need a Play Console
  declaration:

  | Permission or API | Allowed when |
  |---|---|
  | SMS and Call Log groups (`READ_SMS`, `SEND_SMS`, `READ_CALL_LOG`, …) | The app is the device's default SMS, Phone, or Assistant handler, or its core function is one of the exceptions the policy lists (answer `10208820`) — among them backup and restore, caller ID and spam blocking, a connected-device companion, cross-device sync — with no other way to provide it. Either way it is declared; whether an exception was approved is `cannot see`. With neither, the permissions may not appear in the manifest at all. |
  | `ACCESS_BACKGROUND_LOCATION` | A core feature that benefits the user needs location in the background; declared in the console; preceded by a prominent disclosure. Ask for the least: coarse over fine, foreground over background. |
  | `MANAGE_EXTERNAL_STORAGE` | The Storage Access Framework and MediaStore cannot provide the core feature; declared. |
  | `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` | The system photo picker cannot provide the core feature; declared. |
  | `QUERY_ALL_PACKAGES` | The core purpose needs awareness of all installed apps; declared. Otherwise use a targeted `<queries>` element. |
  | `REQUEST_INSTALL_PACKAGES` | The core purpose is sending, receiving, or installing app packages initiated by the user. Never for self-update. |
  | AccessibilityService API | Not for changing settings without consent, working around platform controls, or deceptive UI. `isAccessibilityTool` only for tools built for people with disabilities; every other use needs a prominent disclosure, a declaration, and a mention in the listing (answer `10964491`). |
  | `VpnService` | VPN is the core function, or the app is parental control, usage tracking, device security, a network tool, or a browser; documented in the listing; traffic encrypted to the tunnel endpoint. |
  | `USE_EXACT_ALARM` | The core function is an alarm, timer, or calendar. |
  | `USE_FULL_SCREEN_INTENT` | The core function is calls or alarms; otherwise declared. |
  | Body sensors, Health Connect | A health or fitness use the policy lists, limited to that use, under the User Data and Health apps policies. |

- **Foreground services.** On API 34 and higher every `<service>` that runs in the foreground
  declares `android:foregroundServiceType` and the matching `FOREGROUND_SERVICE_<TYPE>` permission,
  and each type is declared in the console with a description, the impact of deferral, and a video
  (Device and Network Abuse, answer `9888379`; answer `13392821`). **Look:** `startForeground` call
  sites against the manifest.

## Accounts

- **Deletion in the app and on the web.** An app that lets users create an account gives them an
  in-app path to delete the account and its data, and a web link where they can request the same
  without the app. Freezing or deactivating an account does not count (User Data; account deletion
  requirements, answer `13327111`). **Look:** an account-settings action that calls a real delete
  endpoint, and a public deletion page. The web link is also entered in the Data safety form.

## Payments

- **Digital goods use Play billing.** Payment for in-app features, digital content, subscriptions,
  or virtual currency goes through Google Play's billing system (Payments, answer `9858738`).
  **Look:** a card form or web checkout reachable from a digital purchase.
- **Physical goods and services do not.** Play billing is not used for physical goods or services,
  peer-to-peer payments, tax-exempt donations, or gambling (Payments).
- **No leading users elsewhere to pay** — in the listing, in-app promotions, WebViews, buttons,
  links, or sign-up flows — unless the developer is enrolled in an alternative billing or
  external-offers program for the user's region (Payments). **Look:** links to a pricing or
  account-upgrade page.
- **Prices and terms are plain.** In-app pricing matches what the Play purchase sheet shows; the
  listing says when a described feature costs extra; random items disclose odds close to the
  purchase; virtual currency stays in the title it was bought for (Payments).
- **Subscriptions.** The offer screen states the terms, the cost, the billing frequency, that it
  renews, and whether a subscription is required to use the app, without a further tap. A trial or
  introductory offer says how long it lasts, what it costs afterward, and how to cancel. The offer
  can be dismissed. The app says how to manage or cancel, and its account settings give access to an
  online way to cancel (Subscriptions, answer `9900533`).
  **Look:** the paywall view and its close control.
- **Ads do not ambush.** No full-screen interstitial appearing unexpectedly — at launch, mid-task,
  or at the start of a level — and none that cannot be closed after 15 seconds unless the user opted
  in (Ads, answer `9857753`). **Look:** where the interstitial `show` call sits in the flow.

## Content and audience

Apply only the checks the Step 3 profile calls for.

- **Target audience is declared truthfully.** If children are among the audience the Families
  Policy applies: only Families Self-Certified Ads SDKs, no advertising ID or precise location from
  children, ad formats and content suited to them, and a neutral age screen in a mixed-audience app
  (Families, answer `9893335`). **Look:** ad and analytics SDKs in an app whose design or listing
  addresses children.
- **User-generated content.** Users accept terms that define and prohibit objectionable content
  before posting; the app has in-app reporting of content and users, blocking wherever users can
  reach each other directly, and moderation that acts on reports (User Generated Content, answer
  `9876937`). **Look:** report and block actions on every surface that shows another user's content.
- **AI-generated content.** The app prevents generation of restricted content and lets users report
  or flag offensive output without leaving the app (AI-Generated Content, answer `13985936`).
- **Social, dating, and anonymous or random chat apps** meet the Child Safety Standards policy:
  published standards against child sexual abuse and exploitation, an in-app way to report, and a
  named point of contact (answer `14747720`).
- **Restricted content.** Nothing the Inappropriate Content policy bars (answer `9878810`).
  Real-money gambling, financial services, health, and crypto features meet their own policy pages,
  with licences where required and the matching console declaration — read the page for the category
  before failing or passing it.
- **Other people's work.** No impersonation of another app or brand, and rights to the content
  shown (Impersonation, Intellectual Property).

## Listing

**Look:** `fastlane/metadata/android/<locale>/` (`title.txt`, `short_description.txt`,
`full_description.txt`, `changelogs/`, `images/`), a Gradle Play Publisher `src/main/play/` folder,
or another tracked export. If the listing is not in the repo, every check here is `cannot see`.
Check every locale.

- **Title** is at most 30 characters. Title, icon, and developer name carry no emoji, emoticons, or
  repeated special characters, no ALL CAPS unless it is the brand, and nothing indicating ranking
  ("#1", "best"), price or promotion ("free", "sale"), or a Play program (Metadata, answer
  `9898842`).
- **Short description** is at most 80 characters; the **full description** at most 4,000.
- **Description** is clear and accurate: no unattributed testimonials, no blocks or lists of
  keywords, no claim the app does not deliver (Metadata).
- **Graphics** suit a general audience and show the app; the icon has no misleading badge such as a
  fake notification dot (Metadata).
- **Required mentions.** Use of `VpnService` or the AccessibilityService API is documented in the
  description.
- **Ads declared.** An app showing any ad, including house ads, is declared as containing ads
  (answer `9859455`).

## Functionality

- **More than a wrapper.** A WebView on a site the developer does not own or have permission for,
  or one whose main purpose is affiliate traffic, is spam; so are near-identical apps published
  repeatedly (Spam; Minimum Functionality). **Look:** a single-activity WebView on a remote URL;
  sibling application IDs built from one codebase with only content swapped.
- **Updates come from Play.** The app does not modify, replace, or update itself outside Google
  Play's mechanism, and does not download executable code — dex, JAR, `.so` — from anywhere else.
  Code running in an interpreter or virtual machine with only indirect access to Android APIs, such
  as JavaScript in a WebView or a JavaScript runtime, is the stated exception (Device and Network
  Abuse, answer `9888379`). **Look:** `DexClassLoader`, `System.load` on a downloaded path, an
  in-app APK downloader; over-the-air JavaScript updaters are within the exception as long as what
  they ship stays within policy.
- **Leaves the device and other apps alone.** No interfering with other apps, the network, or
  device settings without consent, and no bypassing another app's `FLAG_SECURE` (Device and Network
  Abuse).
- **Does what it says.** No misleading claims about functionality, and no hidden behavior
  (Deceptive Behavior).

## Console

Every item here is `cannot see`. Put each in the report's console list.

- The developer account's identity and contact details are verified.
- **A personal account created after November 13, 2023** has run a closed test with at least 12
  testers opted in continuously for 14 days, and production access has been granted (answer
  `14151465`).
- **App content** has nothing under "Needs attention": privacy policy, ads, app access, target
  audience and content, content rating, Data safety including the data deletion questions, and any
  declaration the app's category requires — advertising ID, financial features, health, news,
  government (answer `9859455`).
- **Data safety** answers agree with the Step 5 worksheet.
- The **content rating** questionnaire is complete; an unrated app can be removed.
- **Permission and foreground-service declarations** are filed for everything in the merged
  manifest, with their videos.
- No test track holds an older bundle that still requests an undeclared restricted permission — it
  blocks publishing on every track (answer `9214102`).
- The **Policy status** page shows no open issue on this app or another app in the account;
  repeated rejections and removals count against the account (Enforcement Process, answer
  `9899234`).
- Enrollment is in place for any alternative billing or external-offers program the app relies on.
