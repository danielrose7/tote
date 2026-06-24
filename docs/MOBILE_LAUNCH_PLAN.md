# iOS App Launch Plan

## Costs

| Item                    | Cost                                                       |
| ----------------------- | ---------------------------------------------------------- |
| Apple Developer Program | $99/year (recurring) — required for TestFlight + App Store |

## Phase 1 — Demo on Device

**Prerequisite:** Apple Developer Program enrollment (covers App Groups + Associated Domains entitlements needed for Share Extension and deep links).

Steps:

1. Enroll at developer.apple.com
2. Open `mobile-app/ios/Tote.xcworkspace` in Xcode
3. Set signing team on both targets: `Tote` and `ToteShareExtension`
4. Plug in iPhone → select as run target → Build & Run
5. Replace `XXXXXXXXXX` in `src/app/.well-known/apple-app-site-association/route.ts` with your Apple Team ID (found at developer.apple.com → Account → Membership), then deploy web app so Universal Links work

## Phase 2 — TestFlight (Beta)

- Archive the app in Xcode (Product → Archive)
- Upload to App Store Connect
- Add yourself as an internal tester
- Distribute via TestFlight link to others

## Phase 3 — App Store Submission

### Assets needed

| Asset                                 | Status | Notes                         |
| ------------------------------------- | ------ | ----------------------------- |
| App icon (1024×1024)                  | Done   | `assets/icon.png` + xcassets  |
| Splash screen                         | Done   | `assets/splash-icon.png`      |
| Screenshots — iPhone 6.7" (1290×2796) | Done   | Uploaded to App Store Connect |
| Screenshots — iPhone 6.1" (1179×2556) | Done   | Auto-resized from 6.7"        |
| Privacy policy URL                    | Done   | tote.tools/privacy            |

### App Store Connect metadata

- [x] App name: Tote
- [x] Subtitle (30 chars max)
- [x] Description
- [x] Keywords (100 chars max)
- [x] Category: Shopping (primary) or Productivity
- [x] Age rating questionnaire
- [x] Support URL
- [x] Review notes explaining the Share Extension

### Pre-submission checklist

- [x] Universal Links working (`apple-app-site-association` deployed with Team ID `8RCZXVFHYN`)
- [x] Bundle identifier confirmed: `tools.tote.app`
- [x] Version and build number set in Xcode (1.1.2)
- [x] Privacy policy live at a public URL (tote.tools/privacy)
- [ ] Tested on a real device via TestFlight
