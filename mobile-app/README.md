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

The `ios:sim-clean` script is defined in [package.json](/Users/dan/personal/tote/mobile-app/package.json).

`pnpm start` uses:
- `expo start --dev-client --localhost`

This is the preferred path for simulator JS/UI work. It keeps the app on the custom dev client, but avoids the more fragile `CI=1` path we used during recovery.

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
