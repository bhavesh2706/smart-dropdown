# DropdownDemo — feature showcase

Interactive demo app for **[react-native-smart-dropdown](../../README.md)**. Each card in `App.tsx` demonstrates one prop or feature — **32 demos** in total, grouped by category.

This app imports the library from the monorepo source (`../../src`), so edits to `src/` hot-reload here without publishing to npm.

The host `ScrollView` wires `markUserTap` and `closeOpenDropdowns` (see [host integration](../../README.md#host-integration-inline--scrollview)) so inline dropdowns close on outside tap or host scroll.

## Preview

### Android

| Selection | Multi-select · searchable | Inline + keyboard |
|:---:|:---:|:---:|
| ![Selection demos](https://raw.githubusercontent.com/bhavesh2706/smart-dropdown/main/docs/assets/SmartDropdownDemo1.gif) | ![Searchable multi-select](https://raw.githubusercontent.com/bhavesh2706/smart-dropdown/main/docs/assets/SmartDropdownDemo2.gif) | ![Inline mode](https://raw.githubusercontent.com/bhavesh2706/smart-dropdown/main/docs/assets/SmartDropdownDemo3.gif) |

### iOS

| Create new / taggable | Multi-select · searchable |
|:---:|:---:|
| ![Create new on iOS](https://raw.githubusercontent.com/bhavesh2706/smart-dropdown/main/docs/assets/SmartDropdowniOSDemo1.gif) | ![Multi-select chips on iOS](https://raw.githubusercontent.com/bhavesh2706/smart-dropdown/main/docs/assets/SmartDropdowniOSDemo2.gif) |

**[Watch all 32 demos on YouTube](https://youtu.be/ZrXf6GZ4fAI)**

---

## Prerequisites

- [React Native environment](https://reactnative.dev/docs/environment-setup) (Android Studio and/or Xcode)
- **Node.js ≥ 18**
- For a **physical Android device**: USB debugging + `adb`

---

## Setup

From this directory (`example/DropdownDemo`):

```bash
npm install
```

**iOS** (first time or after native dep changes):

```bash
cd ios && pod install && cd ..
```

---

## Run

Metro uses the default port **8081**. Start it from **this folder** (not the repo root):

```bash
# Terminal 1 — Metro
npm start
```

```bash
# Terminal 2 — Android emulator or device
adb reverse tcp:8081 tcp:8081   # physical device only
npm run android
```

```bash
# Terminal 2 — iOS simulator
npm run ios
```

Reload after code changes: **R R** (Android) or **Cmd R** (iOS simulator).

---

## Library development workflow

| What you edit | Where |
|---------------|--------|
| Dropdown component / hooks / theme | `../../src/` (repo root `src/`) |
| Demo layout and cards | `App.tsx` (this folder) |
| Metro resolution / watch scope | `metro.config.js` |

`metro.config.js` watches only `../../src` (not the whole repo) and resolves React/RN from this app's `node_modules` — so you get live reload while developing the library.

**Tests and types** run from the **repo root**, not here:

```bash
cd ../..          # repo root
npx tsc --noEmit
npx jest
```

---

## Demo index

Scroll through the app to try each feature. Card numbers are auto-generated in `App.tsx` (`N()`).

### SELECTION

| # | Title | Key props |
|---|--------|-----------|
| 1 | Single select | `value`, `onChange` |
| 2 | Multi-select · count | `mode="multi"` |
| 3 | Multi-select · chips | `multiDisplay="chips"` |
| 4 | Select-all / Unselect-all | `showSelectAll` |
| 5 | Min / max + validation | `minSelections`, `maxSelections` |
| 6 | Chip overflow | `maxVisibleChips` |
| 7 | Off-list selected value | `includeSelectedInList` (default) |

### SEARCH

| # | Title | Key props |
|---|--------|-----------|
| 8 | Local search (panel) | `isSearch`, `searchMode="local"` |
| 9 | Trigger-as-search (autocomplete) | `searchInTrigger` |
| 10 | Hybrid search (local + remote) | `searchMode="hybrid"`, `fetchData` |
| 11 | Remote search · pagination | `searchMode="remote"`, `enablePagination`, `loadOnOpen`, `renderLoading` |
| 12 | Create new / taggable | `allowCreate`, `onCreateOption`, `inline`, `scrollRef` |
| 13 | Multi-select · searchable | `mode="multi"`, `isSearch`, `searchInTrigger` |
| 14 | Persist search on select | `persistSearchOnSelect`, `inline`, `scrollRef` |

### LIST CONTENT

| # | Title | Key props |
|---|--------|-----------|
| 15 | Grouped + custom header | `groupBy`, `renderSectionHeader` |
| 16 | Per-item disabled | `isItemDisabled` |
| 17 | Subtitle + avatar | `descriptionKey`, `imageKey` |
| 18 | Custom row | `renderItem` |

### FORM FIELD

| # | Title | Key props |
|---|--------|-----------|
| 19 | Label · required · error | `label`, `required`, `helperText`, `error` |

### THEMING & ICONS

| # | Title | Key props |
|---|--------|-----------|
| 20 | Theme override (colors) | `theme` (partial override) |
| 21 | Dark mode | `colorScheme="dark"` |
| 22 | Custom font | `theme.fonts` (family-only, iOS-safe) |
| 23 | Custom icons | `caretDownIcon`, `caretUpIcon`, `clearIcon` |
| 24 | RTL | `rtl` |

### POSITIONING & RENDER

| # | Title | Key props |
|---|--------|-----------|
| 25 | Direction · forced up | `direction="up"` |
| 26 | Inline mode | `inline`, `scrollRef` |
| 27 | Virtualized + itemHeight | `virtualizeInline`, `itemHeight` (200 items) |
| 28 | Animated | `animated` |
| 29 | Custom trigger | `renderTrigger` |
| 30 | Controlled open | `open`, `onOpenChange` |
| 31 | Imperative ref | `ref` → `open` / `close` / `clear` |

### STATES

| # | Title | Key props |
|---|--------|-----------|
| 32 | Empty list + action | `emptyText`, `showEmptyAction`, `onEmptyActionPress` |

---

## Using the published package instead

In a real app, install from npm — no monorepo path:

```bash
npm install react-native-smart-dropdown
```

```tsx
import { DropdownSelect } from 'react-native-smart-dropdown';
```

See the [main README](../../README.md) for full API docs, recipes, and theming.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Metro can't find modules | Run `npm install` in this folder |
| iOS build fails | `cd ios && pod install` |
| Android device can't load bundle | `adb reverse tcp:8081 tcp:8081` |
| `EMFILE` / too many open files | Metro watches only `src/` — see `metro.config.js` |
| Touch on iOS simulator | Limited — verify interactions on a real Android device |

More project context: [PROJECT_STATE.md](../../PROJECT_STATE.md).
