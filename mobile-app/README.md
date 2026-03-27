# Tote Mobile App Notes

This file captures the iOS recovery flow we used when simulator builds or Metro state got stuck.

## Fast paths

- Start Metro with a clear cache:
  - `cd mobile-app`
  - `CI=1 npx expo start --dev-client --clear --port 8081`
- Clean simulator build:
  - `cd mobile-app`
  - `pnpm ios:sim-clean`

The `ios:sim-clean` script is defined in [package.json](/Users/dan/personal/tote/mobile-app/package.json).

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
   - `CI=1 npx expo start --dev-client --clear --port 8081`
5. Rebuild and reinstall simulator app:
   - `pnpm ios:sim-clean`
   - `xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/Tote.app`
   - `xcrun simctl launch booted tools.tote.app`

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
