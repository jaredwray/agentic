# Apple App Store

Rules for an app submitted through App Store Connect: iOS, iPadOS, and the other Apple platforms that
share its review. Numbers in parentheses are sections of the App Review Guidelines. Checked against
the guidelines dated **October 16, 2026**.

Each check says what fails, then **Look:** where the evidence is. A check whose evidence is not in
the repo is `cannot see` — it goes to the report's console list, never to `pass`.

## Live values

Fetch these before the sweep. The page is right where it differs from this file.

| Page | Read off |
|---|---|
| `https://developer.apple.com/app-store/review/guidelines/` | The "Last Updated" date at the foot. If it is later than the date above, read every section this file cites before failing a check on it. |
| `https://developer.apple.com/news/upcoming-requirements/` | The minimum Xcode and SDK for uploads (Xcode 26 and the 26 SDKs when this was written), the minimum deployment target (iOS 13), and any dated upload requirement not listed here. |
| `https://developer.apple.com/support/third-party-SDK-requirements/` | The SDKs that must ship their own privacy manifest and signature. |
| `https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api` | The required-reason API categories and the approved reason codes for each. |

## Upload gates

These fail at upload or processing, before a person reviews anything.

- **Xcode and SDK floor.** A build made with an older Xcode than the live minimum is refused.
  **Look:** the CI image or `xcode-version`, `.xcode-version`, fastlane `xcodes`/`xcversion`, the EAS
  build `image`; `IPHONEOS_DEPLOYMENT_TARGET` against the minimum deployment target.
- **Purpose strings present.** Every protected resource the binary can reach needs its
  `NS…UsageDescription` key, including resources reached only by an SDK. A missing key fails
  processing. **Look:** `Info.plist` against the APIs linked — camera, microphone, photo library
  (read and add), location (when-in-use and always), contacts, calendars, reminders, Bluetooth,
  motion, HealthKit (share and update), Face ID, speech recognition, local network, Apple Music,
  tracking.
- **Privacy manifest.** The app target ships `PrivacyInfo.xcprivacy` declaring, under
  `NSPrivacyAccessedAPITypes`, an approved reason for each required-reason API category the app's own
  code uses (file timestamp, system boot time, disk space, active keyboards, user defaults). Every SDK
  on Apple's list ships its own manifest and signature. **Look:** the manifest file; grep app code for
  `UserDefaults`, `NSFileSystemFreeSize`/`volumeAvailableCapacity`, `systemUptime`/`mach_absolute_time`,
  file `creationDate`/`modificationDate`, `activeInputModes`; the lockfile (`Podfile.lock`,
  `Package.resolved`, `pubspec.lock`) against the live SDK list, and each listed SDK's version for the
  release that added its manifest.
- **Export compliance key.** `ITSAppUsesNonExemptEncryption` absent leaves every build waiting on a
  manual answer in App Store Connect. **Look:** `Info.plist`. `false` is correct for an app that only
  uses the system's encryption or HTTPS; `true` needs the documentation the console then asks for.
- **App icon.** The 1024-pixel marketing icon has no alpha channel and no transparency.
  **Look:** the `AppIcon` asset.
- **No `UIWebView`.** Any reference, including inside an old SDK, is refused. **Look:** grep the
  project and vendored frameworks.
- **Version and build.** `CFBundleShortVersionString` is higher than the live version and the build
  number has not been uploaded before. **Look:** the build settings and the CI step that sets them.
- **Capabilities match the profile.** Every entitlement is one the App ID has enabled, and each
  `UIBackgroundModes` entry backs a feature that exists (2.5.4). **Look:** `*.entitlements`,
  `Info.plist`.
- **Mac App Store only.** The app is sandboxed (2.4.5(i)) and no file in the bundle carries the
  `com.apple.quarantine` attribute. **Look:** `com.apple.security.app-sandbox` in the entitlements.

## Reviewer access

Apple attributes over 40% of unresolved review issues to guideline 2.1. Most of them are here.

- **A way in.** An app with sign-in provides an active demo account, or a full-featured demo mode
  Apple approved in advance (2.1(a)). The account passes sign-in with no second factor, emailed code,
  or expiry, and holds enough data to show every feature. **Look:** whether a sign-in wall exists;
  `fastlane/metadata/review_information/` if tracked. The credentials themselves are `cannot see`.
- **Backend up.** The release configuration points at production services that are running
  (2.1(a)). **Look:** release build config and environment files for `localhost`, `127.0.0.1`,
  `10.0.2.2`, `staging`, `dev.`, `ngrok`, `.local`, and test API keys.
- **No unfinished content.** Placeholder text, empty screens, "coming soon" features, test menus,
  and dead links fail (2.1(a)). **Look:** grep for `lorem`, `TODO`, `coming soon`, `placeholder`,
  `test@`, debug screens reachable in release.
- **Purchases reviewable.** Every in-app purchase is complete, visible, and functional in the build;
  any that cannot be reached is explained in the notes (2.1(b)). An app's first in-app purchase is
  submitted with a new app version. **Look:** product IDs in code against the StoreKit configuration
  file; the console state is `cannot see`.
- **Notes say what is new and non-obvious.** New features are described with specificity in the
  review notes; generic descriptions are rejected (2.3.1(a)). Anything needing hardware, a QR code,
  or a location ships with the means to review it.
- **Nothing hidden.** No hidden, dormant, or undocumented feature, and no functionality switched on
  after approval (2.5.19, 2.3.1). **Look:** remote flags that gate whole features, branches on
  review-like conditions (date, region, a "review" build flag), obfuscated code paths.
- **iPad.** A target that includes iPad is reviewed on iPad; the layout works there (2.4.1).
  **Look:** `TARGETED_DEVICE_FAMILY`, `UIRequiresFullScreen`, supported orientations.
- **IPv6.** The app works on an IPv6-only network (2.5.5). **Look:** hard-coded IPv4 literals and
  IPv4-only socket code.

## Privacy declarations

- **Privacy policy in both places.** A link in the App Store Connect metadata and one easy to reach
  inside the app. The policy names the data collected, how, every use, the third parties it goes to,
  retention, and how to revoke consent or request deletion (5.1.1(i)). **Look:** the in-app link;
  `privacy_url.txt` if tracked.
- **Privacy label matches behavior.** The App Privacy answers in App Store Connect cover everything
  the app and its SDKs collect (2.3, 5.1.1). **Look:** the Step 5 worksheet against
  `NSPrivacyCollectedDataTypes` in the app's and SDKs' manifests. The console answers are
  `cannot see`.
- **Tracking asks first.** Any tracking — sharing user or device data with data brokers, or linking
  it with third-party data for advertising — happens only after the App Tracking Transparency prompt
  is granted (5.1.2(i)). **Look:** `requestTrackingAuthorization` called before any ad or attribution
  SDK initializes; `NSUserTrackingUsageDescription`; `NSPrivacyTracking` and
  `NSPrivacyTrackingDomains` in the manifests.
- **Third-party AI is disclosed and consented.** Where personal data goes to a third party,
  including a third-party AI service, the app says where and gets explicit permission first
  (5.1.2(i)). **Look:** requests to AI provider hosts carrying user content, and the consent step
  that precedes the first one.
- **Consent, and a way to withdraw it.** Collecting user or usage data needs consent, and paid
  functionality does not depend on granting it (5.1.1(ii)). Data collected for one purpose is not
  reused for another without new consent (5.1.2(ii)).
- **Only what the feature needs.** Data access is limited to the core functionality; the
  out-of-process picker replaces full Photos or Contacts access where it can (5.1.1(iii)).
  **Look:** `PHPickerViewController` and `CNContactPickerViewController` against full-library
  authorization requests.
- **Contacts and installed apps.** No contact database built from the address book, no "select all"
  when messaging contacts, no collecting the list of installed apps for analytics or ads
  (5.1.2(iv), (v)). **Look:** bulk contact uploads; `canOpenURL` probes over many schemes.
- **Recording is visible.** Recording or logging user activity — camera, microphone, screen, input —
  needs explicit consent and a clear indication while it happens (2.5.14). **Look:** session-replay
  SDKs.
- **Health data.** Not used for advertising or data mining, not stored in iCloud, never written
  falsely into HealthKit (5.1.2(vi), 5.1.3).
- **Children's data.** See [Content and audience](#content-and-audience).

## Permissions

- **Purpose strings explain.** Each string says clearly and completely what the data is used for
  (5.1.1(ii)). "This app needs access to your camera" fails. **Look:** every `NS…UsageDescription`
  value and its translations in `InfoPlist.strings` / string catalogs.
- **Asked for a reason the user can see.** The request follows the action that needs it, the app
  respects a refusal, and it does not trick or force consent or tie one feature to an unrelated
  permission (5.1.1(iv)). **Look:** permission requests fired at launch; flows that dead-end on
  denial where a manual alternative is possible (typing an address instead of sharing location).
- **Nothing unused.** A permission key, entitlement, or background mode with no feature behind it is
  removed (5.1.1(iii), 2.5.4). **Look:** each declared key against a call site.
- **Location.** Used only where directly relevant to the app's features, with the purpose explained
  in the app (5.1.5). "Always" access needs a background feature the user can name.
- **System features are optional.** The app does not require push notifications, location services,
  or tracking to be enabled in order to work or to earn a reward (5.1.2(i)). Push is not required to
  function, and marketing pushes need an explicit opt-in and an in-app opt-out (4.5.4).

## Accounts

- **Sign-in only where it earns it.** An app without significant account-based features works
  without signing in (5.1.1(v)).
- **Deletion in the app.** An app that supports account creation lets the user start deleting the
  account inside the app (5.1.1(v)). Deactivating is not enough; the option is easy to find; if a
  website finishes the job the link goes straight to that page; outside highly regulated industries
  the flow does not require a phone call, an email, or a support chat. **Look:** an account-settings
  action that calls a real delete endpoint; for Sign in with Apple, a token revocation call.
- **Equivalent login option.** An app that uses a third-party or social login for the primary
  account also offers a login service that limits collection to name and email, lets the user keep
  the email private, and does not collect interactions for advertising without consent (4.8). Sign in
  with Apple qualifies. Exempt: the company's own accounts only, an existing education or enterprise
  account, a government or industry-backed ID, or a client for one specific third-party service.
  **Look:** the sign-in screen's provider list.
- **Sign in with Apple, used properly.** Reviewers reject, under guideline 4, an app that asks again
  for the name or email Sign in with Apple just returned. The app also accepts a private relay
  address as the user's email.
- **Sign-up stays in the app.** Sending people to the default browser to register or sign in is
  treated as a poor experience under guideline 4.
- **Social network credentials.** Signing in with a social network is not required unless the app is
  for that network; credentials can be revoked in the app and tokens are not stored off the device
  (5.1.1(v)).
- **Face authentication** uses `LocalAuthentication`, with an alternative for users under 13
  (2.5.13).

## Payments

- **Digital goods use in-app purchase.** Unlocking features, content, subscriptions, or in-game
  currency inside the app goes through in-app purchase; license keys, QR codes, and cryptocurrency
  are not substitutes (3.1.1). **Look:** a card form or web checkout (Stripe, PayPal, Braintree, a
  WebView on a pricing page) reachable from a digital purchase.
- **No steering outside the allowed storefronts.** Buttons, links, or calls to action pointing to
  another way to pay are allowed on the United States storefront, and elsewhere only under an
  external purchase link entitlement in the storefronts it covers (3.1.1(a), 3.1.3). **Look:** such
  links in the app and the listing, and whether they are gated by storefront.
- **Goods and services used outside the app do not use in-app purchase** (3.1.3(e)). Real-time
  one-to-one services between two people may use other payment; one-to-many must use in-app purchase
  (3.1.3(d)).
- **Restore.** Restorable purchases have a restore mechanism (3.1.1). **Look:** a restore action
  calling `AppStore.sync()` / `restoreCompletedTransactions`, or the wrapper SDK's equivalent.
- **Subscriptions.** At least seven days long, giving ongoing value, working on all the user's
  devices (3.1.2(a)). Before the purchase the screen states what the user gets, the subscription's
  name, length, and price, and links a working privacy policy and terms of use; both links are also
  in the listing (3.1.2(c) and Schedule 2 of the Program License Agreement). Reviewers also reject
  a paywall where a per-week or per-month breakdown is more prominent than the amount billed.
  **Look:** the paywall view.
- **Trials.** A free trial states its length and what is charged when it ends. A non-subscription
  trial is a price-tier-0 non-consumable named "XX-day Trial" (3.1.1).
- **Random items disclose odds** before purchase (3.1.1). **Purchased credits do not expire**
  (3.1.1).
- **Reviews and ratings.** The app does not require a rating, review, or another app's download to
  unlock anything (3.2.2(x)), and asks for reviews only through the StoreKit review API (5.6.1).
- **Built-in capabilities are not for sale** — push, the camera, iCloud storage (4.10).
- **By category.** Wallets come from an organization, mining is off-device, exchanges are licensed
  where offered (3.1.5). Loans disclose terms, cap APR at 36% including fees, and do not require
  full repayment within 60 days (3.2.2(ix)). In-app purchase does not buy credit for real-money
  gaming (5.3.3). Fundraising inside the app is for approved nonprofits (3.2.1(vi), 3.2.2(iv)).
  Apple Pay recurring payments disclose term, what is provided, charges, and how to cancel (4.9).

## Content and audience

Apply only the checks the Step 3 profile calls for.

- **User-generated content** — including AI content creation — has a filter for objectionable
  material, a way to report content with timely responses, the ability to block abusive users, and
  published contact information (1.2). Apps used mainly for pornographic content, random or anonymous
  chat, or bullying do not belong on the store. **Look:** report and block actions on every surface
  that shows another user's or a model's output.
- **Chatbots, mini apps, plug-ins, emulators** follow 4.7: the same moderation, an index of the
  software offered, no native API exposure without permission, and an age-restriction mechanism for
  content above the app's rating (4.7.1–4.7.5). Creator content needs the same age mechanism
  (1.2.1(a)).
- **Kids Category.** No links out, purchases, or other distractions outside a parental gate; no
  personally identifiable or device information to third parties; no third-party analytics or
  advertising beyond the limited cases the guideline allows (1.3, 5.1.4). An app outside the category
  does not use "For Kids" or imply children are its main audience (2.3.8). **Look:** ad and analytics
  SDKs in a kids target.
- **Health and medical.** Accuracy claims come with disclosed data and methodology; no measuring
  blood pressure, temperature, glucose, or oxygen from the device's sensors alone; the app reminds
  users to check with a doctor; regulatory clearance is linked (1.4.1). Dosage calculators come from
  an approved entity (1.4.2).
- **Regulated fields** — banking, healthcare, gambling, legal cannabis, air travel, crypto
  exchanges — are submitted by the legal entity that provides the service, not an individual
  (5.1.1(ix)). Trading and investing apps come from the financial institution and are licensed where
  offered (3.2.1(viii)); derivatives trading is licensed in every jurisdiction served and binary
  options are not allowed (3.2.2(viii)).
- **Real-money gaming and lotteries** are licensed, geo-restricted to where the licence applies, and
  free on the store (5.3.4). Sweepstakes and contests are sponsored by the developer and show
  official rules stating Apple is not involved (5.3.1, 5.3.2).
- **VPN apps** use `NEVPNManager`, come from an organization, declare data collection on screen
  before use, and sell or disclose no data (5.4).
- **Objectionable content.** None of what 1.1 lists; no prank or fake-functionality features
  (1.1.6); nothing encouraging tobacco, vaping, illegal drugs, or excessive alcohol (1.4.3).
- **Ads** stay in the main app binary, suit the age rating, are marked as ads when they interrupt,
  have a visible close control, and can be reported from the app (2.5.18).
- **Other people's content.** The app has the rights to what it shows and uses third-party services
  within their terms (5.2.1, 5.2.2); it does not save or convert media from third-party sources
  without authorization (5.2.3).

## Listing

**Look:** `fastlane/metadata/<locale>/` (`name.txt`, `subtitle.txt`, `keywords.txt`,
`description.txt`, `promotional_text.txt`, `release_notes.txt`, `privacy_url.txt`,
`support_url.txt`), `fastlane/screenshots/`, or another tracked export. If the listing is not in the
repo, every check here is `cannot see`. Check every locale.

- **Name** is unique and at most 30 characters; the **subtitle** is at most 30. Neither, nor the
  keywords, carries trademarked terms, other apps' names, prices, or irrelevant phrases (2.3.7).
- **Screenshots** show the app in use — not title art, a login page, or a splash screen (2.3.3).
  **Previews** are screen captures of the app (2.3.4). Account data shown is fictional (2.3.9).
- **Suitable for everyone.** Icons, screenshots, and previews meet a 4+ standard whatever the app's
  rating (2.3.8).
- **No other platforms.** No names, icons, or imagery of other mobile platforms or alternative
  marketplaces in the app or its metadata (2.3.10). **Look:** "Android", "Google Play", and device
  imagery in copy, screenshots, and in-app strings.
- **Says what costs extra.** The description, screenshots, and previews indicate which featured
  items need an additional purchase (2.3.2).
- **Only what the app does.** No feature the build lacks and no false price (2.3.1(a)).
- **What's New** describes significant changes specifically (2.3.12).
- **Creative assets** pertain to the app or its brand and carry no misleading references to other
  apps, unverifiable claims, or specific or discounted prices (2.3.14).
- **Support URL** works and gives a way to reach the developer (1.5). Every URL in the metadata
  resolves (2.1(a)).
- **No Apple endorsement** implied, and nothing confusingly similar to an Apple product or interface
  (5.2.4, 5.2.5).
- **Category** fits (2.3.5).

## Functionality

- **More than a website.** Features, content, and UI beyond a repackaged site (4.2). An app that is
  mainly marketing material, a web clipping, or a collection of links fails (4.2.2). **Look:** a root
  view that is a single `WKWebView` on a remote URL; a Capacitor or Cordova shell with
  `server.url` set.
- **Works alone.** It does not need another app installed, and it states the size and asks before a
  large first-launch download (4.2.3).
- **Not a template or a duplicate.** Apps from a commercial template or generation service are
  submitted by the owner of the content (4.2.6). One app per concept — not several bundle IDs for
  variants — and something meaningfully different in a saturated category (4.3). No copying another
  app's name, icon, or interface (4.1).
- **No new code after review.** The app does not download, install, or execute code that introduces
  or changes its features (2.5.2). An over-the-air JavaScript update may fix and adjust within the
  app's reviewed purpose; shipping a feature the reviewer never saw this way also breaks 2.5.19.
  **Look:** `expo-updates`, CodePush-style SDKs, remote bundle URLs, and what the release process
  pushes through them.
- **Public APIs only,** running on the current OS, with deprecated frameworks phased out and each
  framework used for its purpose (2.5.1). Web content uses WebKit unless the app holds the alternative
  browser engine entitlement (2.5.6).
- **Leaves the system alone.** No altering hardware switches or standard behaviors (2.5.9), no
  suggesting a restart or unrelated settings changes (2.4.4), no background work unrelated to the
  app such as mining (2.4.2).
- **Extensions, widgets, notifications, App Clips** relate to the app's function; extensions carry
  no ads or purchases; keyboard extensions work without full access (2.5.16, 4.4, 4.4.1).
- **Open to its audience.** No arbitrary restriction of who may use the app, such as by carrier
  (3.2.2(v)).
- **Mac App Store.** Xcode-packaged and self-contained, no auto-launch without consent, no
  downloaded code or separate updater, no licence screen or own copy protection, all localizations
  in one bundle (2.4.5(ii)–(ix)).

## Console

Every item here is `cannot see`. Put each in the report's console list.

- Program membership is active and the latest Program License Agreement is accepted; a pending
  agreement blocks submission.
- The Paid Apps Agreement, tax forms, and banking are in effect before a paid app or any in-app
  purchase is submitted — without them the products do not load for the reviewer.
- The account type fits the app: an organization for wallets (3.1.5(i)), VPN (5.4), and regulated
  fields (5.1.1(ix)).
- **App Review Information** holds working demo credentials, a contact name, phone, and email, and
  notes covering every non-obvious feature and purchase.
- **App Privacy** answers are published and agree with the Step 5 worksheet.
- The **age rating** questionnaire is answered honestly and is current (2.3.6).
- For distribution in the EU, **trader status** under the Digital Services Act is declared.
- Export compliance and content rights questions are answered.
- In-app purchases and subscriptions are in a submittable state and attached to this version.
- Any entitlement the app depends on (external purchase link, alternative browser engine, a managed
  capability) is granted to this App ID.
