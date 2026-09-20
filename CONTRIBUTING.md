# Contributing

Thanks for helping improve **react-native-smart-dropdown**. This library ships with **zero runtime dependencies**; keep that invariant.

## Prerequisites

- Node.js matching the React Native version you test against (see `package.json` / demo `engines`)
- Android Studio and/or Xcode for the interactive demo
- For physical Android: USB debugging + `adb`

## Setup

```bash
# repo root
npm install

# demo app
cd example/DropdownDemo && npm install
cd ios && pod install && cd ../..
```

## Verify every change

From the **repo root** (not the example folder):

```bash
npx tsc --noEmit
npx jest
```

For UI / behavior changes, also run the demo on a **real Android device** (`simctl` has no tap). Keep Metro on port **8081** exclusive to DropdownDemo:

```bash
cd example/DropdownDemo
npx react-native start
# other terminal:
adb reverse tcp:8081 tcp:8081
npx react-native run-android
```

## Dark mode / theming checks

`colorScheme` defaults to `'system'`. Label, helper, and trigger colors come from the active theme.

- Switch the **device** to dark mode and confirm form labels (e.g. demo card **19. Label · required · error**) stay readable.
- Demo cards follow OS appearance so light theme text is not painted on light cards.
- When embedding the dropdown in your app, match the parent surface to `colorScheme`, or set `colorScheme="light"|"dark"` / `labelStyle` / `theme.colors` explicitly.

See the theming note in [README.md](README.md).

## Working rules

1. **No regressions** — re-check previously working flows, not only the new one.
2. **Zero runtime deps** — never add a production dependency.
3. **Opt-in props** — new props must be backward-compatible; defaults preserve current behavior.
4. **Add a unit test** per feature or bugfix when practical.
5. **Keyboard / positioning** — fragile; do not retry documented dead-ends in project notes without device verification.

## Pull requests

- Keep diffs focused; prefer minimal, isolated changes.
- Include what you tested (`tsc`, `jest`, device / demo cards).
- Do not commit local agent memory files (`.claude/`, `CLAUDE.md`, `PROJECT_STATE.md`, PDFs) — they are gitignored.
