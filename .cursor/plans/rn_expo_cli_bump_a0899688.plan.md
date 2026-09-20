---
name: RN Expo CLI bump
overview: Patch-bump the library and DropdownDemo from React Native 0.86.0 → 0.86.3 (Expo SDK 57’s recommended RN) and RN CLI 20.1.0 → 20.2.0, then verify with root tests and a full on-device walkthrough of the demo cards without changing library source behavior.
todos:
  - id: bump-root-deps
    content: Bump root package.json to RN 0.86.3 + matching @react-native/*; npm install
    status: pending
  - id: bump-demo-deps
    content: Bump DropdownDemo to RN 0.86.3 + CLI 20.2.0; npm install + pod install
    status: pending
  - id: readme-compat
    content: Add Expo SDK 57 / RN 0.86.3 CLI compatibility note in README
    status: pending
  - id: verify-tsc-jest
    content: Run npx tsc --noEmit and npx jest from repo root
    status: pending
  - id: device-authorize
    content: Get adb device authorized (R9ZY80GCB1H currently unauthorized)
    status: pending
  - id: run-android-demo
    content: Start Metro, adb reverse, run-android on attached device
    status: pending
  - id: smoke-demo-cards
    content: Walk SELECTION/SEARCH/LIST/FORM/THEME/POSITIONING/STATES cards on device
    status: pending
isProject: false
---

# Bump to Expo SDK 57 RN + latest CLI (no behavior change)

## Decision (locked)

**Expo-aligned stack:** React Native **0.86.3** + `@react-native-community/cli` **20.2.0**.

- Matches latest Expo SDK **57** (`expo@57.0.24` → RN 0.86.3 / React 19.2.3).
- Patch-only vs current **0.86.0** — lowest regression risk for “do not break working functionality.”
- Not jumping to RN **0.87.1** (Expo not on that line yet).

Library source under `src/` stays untouched except if a type/test fail forces a tiny fix. Peer range stays `react-native >= 0.72` / `react >= 18`.

## Dependency updates

### Root [`package.json`](package.json)

Bump exact versions:

- `react-native`: `0.86.0` → `0.86.3`
- `@react-native/babel-preset`: `0.86.0` → `0.86.3`
- `@react-native/jest-preset`: `0.86.0` → `0.86.3`
- Leave `react` / `react-test-renderer` at `19.2.3` (already correct for Expo 57)

Then `npm install` at repo root and refresh root `package-lock.json`.

### Example [`example/DropdownDemo/package.json`](example/DropdownDemo/package.json)

- `react-native`: `0.86.3`
- All `@react-native/*` (`babel-preset`, `eslint-config`, `jest-preset`, `metro-config`, `typescript-config`): `0.86.3`
- `@react-native-community/cli` + `cli-platform-android` + `cli-platform-ios`: `20.1.0` → `20.2.0`
- Optionally bump `react-native-safe-area-context` to latest compatible (`5.10.0` if peer-ok)

Then `npm install` in `example/DropdownDemo`, and regenerate native locks as needed:

- Android: Gradle will pull new RN via `node_modules`
- iOS: `pod install` in `example/DropdownDemo/ios` (updates `Podfile.lock` from 0.86.0 → 0.86.3)

### Docs (light)

- [`README.md`](README.md): note compatibility with **Expo SDK 57** and **RN CLI / RN 0.86.3** next to the existing peer-deps line (no API changes).
- Do **not** edit gitignored `PROJECT_STATE.md`.

## Verification (required)

1. **Repo root:** `npx tsc --noEmit` and `npx jest` — must stay green.
2. **Device gate:** `adb devices` currently shows `R9ZY80GCB1H` as **unauthorized**. Before run-android, authorize USB debugging on the phone (trust this computer). Re-check until status is `device`.
3. **Run demo:** from `example/DropdownDemo`:
   - Metro: `npx react-native start` (port **8081**)
   - `adb reverse tcp:8081 tcp:8081`
   - `npx react-native run-android`
4. **On-device smoke of each demo category** (32 cards in [`example/DropdownDemo/App.tsx`](example/DropdownDemo/App.tsx)): open/close, select, multi chips, search, create, inline+keyboard, theming, positioning — confirm no regressions vs pre-bump behavior. Keyboard/positioning: do **not** change fragile logic; only report if a regression appears.

## Out of scope

- No library API / feature changes
- No bump to RN 0.87
- No new Expo sample app (docs note only)
- No npm publish / version bump of `react-native-smart-dropdown` unless you ask after verification
