# Tote Mobile App Notes

This file captures the iOS recovery flow we used when simulator builds or Metro state got stuck.

## Fast paths

- Daily iOS simulator dev loop:
  - `cd mobile-app`
  - `pnpm start`
- Start Metro with a clear cache:
  - `cd mobile-app`
  - `pnpm start:clear`
- Clean simulator build:
  - `cd mobile-app`
  - `pnpm ios:sim-clean`
- Re-apply fragile generated iOS overrides:
  - `cd mobile-app`
  - `pnpm ios:sync-overrides`
- Check whether generated iOS files drifted from our source-of-truth copies:
  - `cd mobile-app`
  - `pnpm ios:check-overrides`

The `ios:sim-clean` script is defined in [package.json](/Users/dan/personal/tote/mobile-app/package.json).

`pnpm start` uses:
- `expo start --dev-client --localhost`

This is the preferred path for simulator JS/UI work. It keeps the app on the custom dev client, but avoids the more fragile `CI=1` path we used during recovery.

## Generated iOS overrides

Some iOS files are effectively generated or rewritten during prebuild / share-extension setup,
but we still need local app-specific edits in them for the Safari -> Tote share handoff to work.

Source of truth:
- [ios-overrides](/Users/dan/personal/tote/mobile-app/ios-overrides)

Current protection:
- `pnpm ios`
- `pnpm ios:sim-clean`

Both now run `pnpm ios:sync-overrides` first, so those fragile files get copied back into `ios/`
before building.

If you run `expo prebuild` manually or something rewrites the extension files again:
1. run `pnpm ios:sync-overrides`
2. optionally run `pnpm ios:check-overrides`
3. rebuild

## Screen chrome

For collection detail-style screens, prefer modern in-screen chrome over the default stacked iOS nav bar look:

- hide the native stack header when the screen has its own visual top treatment
- use compact floating controls near the safe-area top edge
  - circular back button on the left
  - circular menu/action buttons on the right
  - a tinted or dark pill for strong completion actions like `Done`
- put the actual page title in the screen flow near the top of the content, not centered in the nav bar
- keep metadata like item count / mode under the title in a lighter secondary row
- avoid dense rows of top-bar actions or heavy divider-based headers

Current example:
- [CollectionDetailScreen.tsx](/Users/dan/personal/tote/mobile-app/src/screens/CollectionDetailScreen.tsx)

## Deep reset (when JS changes do not show up)

Run from repo root unless noted:

1. Quit app in simulator.
2. Kill Metro.
3. Clear local caches:
   - `rm -rf mobile-app/.expo mobile-app/.expo-shared`
   - `rm -rf mobile-app/node_modules/.cache`
   - `rm -rf mobile-app/ios/build`
   - `rm -rf ~/Library/Developer/Xcode/DerivedData`
   - `rm -rf ~/Library/Caches/Metro`
4. Start Metro again:
   - `cd mobile-app`
   - `pnpm start:clear`
5. Rebuild and reinstall simulator app:
   - `pnpm ios:sim-clean`
   - `xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/Tote.app`
   - `xcrun simctl launch booted tools.tote.app`

## When rebuilds should be necessary

Rebuild for:
- native dependency changes
- `Podfile` or pods changes
- Expo config/plugin changes
- Reanimated/Worklets/native module setup changes

Reload should be enough for:
- JS/TS logic
- React UI/styling
- most screen/component changes

If a JS-only change does not show up after `pnpm start:clear` and relaunching the app, treat that as a dev-loop issue rather than the normal expected path.

## Known iOS codegen pitfall

Symptom:
- `Build input file cannot be found: .../ReactCodegen/CojsonCoreRnSpec/CojsonCoreRnSpec-generated.mm`

Cause:
- RN codegen sometimes discovers `cojson-core-rn` but does not place generated `CojsonCoreRnSpec` files in the expected ReactCodegen output folder before compile.

Current project workaround:
- [Podfile](/Users/dan/personal/tote/mobile-app/ios/Podfile) patches the `ReactCodegen` "Generate Specs" phase to copy `CojsonCoreRnSpec` files from temp codegen output into:
  - `ios/build/generated/ios/ReactCodegen/CojsonCoreRnSpec`
- Keep this in mind if running `pod install` or regenerating iOS config.

## Expo Swift build note

`ExpoModulesCore` may require these build settings in post-install on this project:

- `SWIFT_VERSION = 5`
- `SWIFT_STRICT_CONCURRENCY = minimal`

These are also set in [Podfile](/Users/dan/personal/tote/mobile-app/ios/Podfile).

## App Store checklist

Before shipping Tote to the App Store, we should verify all of the following:

Build/tooling:
- app builds cleanly from `pnpm ios:sim-clean`
- release/archive build succeeds in Xcode
- app is built with the current required iOS SDK for submission
- starting in April 2026, iOS apps uploaded to App Store Connect must be built with the iOS 26 SDK or later

Branding/assets:
- final app icon set is in `ios/Tote/Images.xcassets`
- launch/splash assets are final
- any App Store marketing images are prepared

Product page metadata:
- app name
- subtitle
- description
- keywords
- primary category and secondary category if needed
- support URL
- marketing URL if we want one
- privacy policy URL

Screenshots / previews:
- at least one complete iPhone screenshot set is ready
- use the latest required App Store Connect screenshot sizes
- screenshots match the actual current UI
- optional app preview video if we want one

Privacy / compliance:
- App Privacy answers are completed in App Store Connect
- privacy policy is published and accurate
- permission usage strings are present and reviewed
- third-party SDK data collection is included in privacy answers
- export compliance is answered

App review readiness:
- sign in works for Apple / Google / email
- logout/session expiry works cleanly
- Safari share extension works reliably
- collection share / publish / unpublish flow works
- destructive actions are deliberate and recoverable enough
- no debug banners, placeholder copy, test names, or temporary alerts remain
- app can be reviewed without a developer machine or Metro running
- review notes and demo/test credentials are prepared if App Review needs them

Account / business setup:
- Apple Developer account is active
- App Store Connect app record exists
- bundle identifier / signing / certificates are correct
- Paid Apps agreement / tax / banking are complete if needed

Release controls:
- version and build number are updated
- age rating is set
- content rights / licensing questions are answered if applicable
- TestFlight build is distributed for final QA
- do one final device pass on at least one recent iPhone before submission

Useful Apple references:
- [Submit your apps and games today](https://developer.apple.com/app-store/submitting/)
- [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow)
- [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Upload app previews and screenshots](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [App Review Guidelines](https://developer.apple.com/appstore/resources/approval/guidelines.html)
- [App Store submissions now open for the latest OS releases](https://developer.apple.com/news/?id=6lxhtioi)
