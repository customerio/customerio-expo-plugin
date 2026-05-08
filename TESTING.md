# Testing

This guide explains how the test suite is layered and **where new tests should go** when you change code in this repo. Read it before adding tests.

## TL;DR

| Command | Runs |
| --- | --- |
| `npm test` | All four Jest projects (see below) |
| `npm run test:scenarios` | Just the fixture-based scenario suite (fast, no setup) |
| `npm run test-plugin apn` / `npm run test-plugin fcm` | Legacy plugin tests; runs `setup-test-app` first |

CI runs:

| Workflow | Trigger | Tests |
| --- | --- | --- |
| `test.yml` | every PR + push to `main`/`beta`/`feature/*` | All four Jest projects (parallel jobs) |
| `validate-plugin-compatibility.yml` | every PR | 3-cell smoke matrix at latest Expo SDK — real `expo prebuild` + native build |
| `validate-plugin-compatibility-matrix.yml` | merge to `main` (release) + manual | Full multi-SDK matrix — real `expo prebuild` + native build |
| `reusable_build_sample_apps.yml` | release / sample-app distribution | Full Android + iOS app builds shipped to Firebase |

## The four Jest projects

Defined in `jest.config.js`. Each is a separate `displayName` and runs as its own Jest project:

| Project | Lives in | Purpose |
| --- | --- | --- |
| `plugin` | `plugin/__tests__/` | Tests inside the published plugin package itself |
| `test-app` | `test-app/__tests__/` | Tests against the dev test-app shell |
| `root-tests` | `__tests__/` (excluding `__tests__/scenarios/`) | Legacy mock-heavy unit tests + snapshot tests. Tests under `__tests__/{ios,android}/` snapshot against generated test-app artifacts and require `npm run setup-test-app` to have run first; `__tests__/utils/` does not |
| `scenarios` | `__tests__/scenarios/` | **Pure-function transformer tests against hand-curated fixtures.** No setup, no mocks. The direction we're moving toward. |

Run a single project: `npx jest --selectProjects <name>`.

## Where do new tests go?

| You're editing… | Add a test in… |
| --- | --- |
| A pure transformer (`modifyAppDelegateForPushHandler`, `injectCustomerIOInitializerIntoMainApplication`, Podfile/Gradle/Manifest mutators, …) | **`__tests__/scenarios/{ios,android}/`** — scenario test against a fixture |
| A helper / utility (`fileManagement`, plugin-config parsing, version helpers) | `__tests__/utils/` |
| Native build wiring that mutates a generated file (Podfile target, NSE Xcode setup, MainApplication injection) | Scenario test using the relevant fixture (e.g. `__tests__/fixtures/ios/pbxproj/`) |
| A new pod / `AndroidManifest.xml` entry / Gradle dep | Scenario test for the file content. The compatibility matrix already covers "does it actually build" — you do **not** need to add a matrix variant |
| The plugin's public TypeScript API | `plugin/__tests__/` |

If you can express the change as `(input string, options) → output string`, it belongs in **scenarios**. Reach for legacy `__tests__/{ios,android}/` only when the existing test there is what you're updating.

## Adding a scenario test (recipe)

Canonical example: `__tests__/scenarios/android/mainApplication.test.ts`.

1. **Find or add a fixture** under `__tests__/fixtures/{android,ios}/`. Keep fixtures minimal and hand-curated — do not paste output of `expo prebuild`. Existing fixtures: `MainApplication.kt`, `project_build.gradle`, `AppDelegate.h`, `AppDelegate.m`, `AppDelegate.swift`, `pbxproj/`.
2. **Import the transformer** from `plugin/src/`. Scenarios test pure functions directly — no plugin-host harness.
3. **Load the fixture** with `getFixturePath(area, name)` from `__tests__/utils.js` (line 33):
   ```ts
   import * as fs from 'fs';
   import { getFixturePath } from '../../utils';
   const baseline = fs.readFileSync(getFixturePath('android', 'MainApplication.kt'), 'utf8');
   ```
4. **Assert with an inline snapshot** — `expect(transform(baseline)).toMatchInlineSnapshot(\`…\`)`. Run `npx jest --selectProjects scenarios -u` to fill it in the first time.
5. **Add an idempotency case** when relevant: running the transformer twice should equal running it once. See `mainApplication.test.ts` for an example.

## Fixtures

- Location: `__tests__/fixtures/{android,ios}/`
- Format: minimal real source files — Swift, Objective-C, Kotlin, Gradle, `pbxproj`
- Loaded via `getFixturePath(area, name)` (`__tests__/utils.js:33`)
- **Do not** generate fixtures by running `expo prebuild`. They're meant to be small, stable, and explicit so a diff against a snapshot tells a clear story
- Add a new fixture only when an existing one can't represent the input shape you need

## Snapshots

- **Scenarios** use inline snapshots (`toMatchInlineSnapshot`) — visible in the test source
- **Legacy tests** under `__tests__/{ios,android}/` use `__snapshots__/` directories
- Update with `jest -u` (or `npx jest --selectProjects scenarios -u` for just scenarios)
- A scenario snapshot that needs many lines of context is a smell — usually means the test is asserting too much or the fixture is too big

## Mocks

- **Scenarios do not use mocks.** Transformers are pure string-in/string-out, fixtures replace any need for `fs` or plugin-host mocks
- **Legacy tests** mock filesystem and plugin internals (e.g. `__tests__/utils/android.test.ts:9` mocks `fileManagement` and the native-files-path helper). Only reach for mocks if you're working in the legacy tree

## The compatibility matrix — what it does and doesn't cover

`validate-plugin-compatibility.yml` (PR) and `validate-plugin-compatibility-matrix.yml` (release/manual) run a real `expo prebuild` against generated test apps and then `xcodebuild` / Gradle. They catch:

- CocoaPods resolution failures across Expo SDK versions
- Gradle / AGP version skew
- iOS/Android build regressions that depend on real toolchain versions

They **do not** catch line-level correctness of generated files — that's what scenarios are for. The direction of the project is for scenario coverage to grow so the matrix can shrink. Don't add new matrix variants to validate file content; add a scenario.

The compatibility scaffolding scripts live in `scripts/compatibility/` (see its `README.md`). They're for the matrix and for manual local repro — not for unit tests.

## Local commands

```sh
# Fast loop while editing transformers
npm run test:scenarios

# Full suite (matches CI test.yml)
npm test

# Legacy plugin tests (require setup-test-app — slow, native paths)
npm run test-plugin apn   # or fcm
```

iOS push-provider tests (`__tests__/ios/{apn,fcm}/`) need the matching push provider configured locally; failures there without setup are expected and **not** regressions. The compatibility matrix is the source of truth for build correctness across SDK versions.
