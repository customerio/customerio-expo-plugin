# Customer.io Expo plugin

Expo config plugin that wires the Customer.io React Native SDK into an Expo project at prebuild time. Runtime behavior lives in the `customerio-reactnative` repo.

## Layout
- `plugin/`: the config plugin (`plugin/src/`, entry `plugin/app.plugin.js`)
- `__tests__/`: Jest tests, with `fixtures/` and `android/` and `ios/` folders
- `scripts/`: build, setup, and compatibility scripts
- `test-app/`, `test-app-pnpm/`, `test-app-pnpm-monorepo/`: apps used to test the plugin
- `api-extractor-output/`: checked-in public API report

## Commands
Run from the repo root.
- Lint: `npm run lint`
- Type-check: `npm run typescript`
- Test: `npm run setup-test-app && npm test`. The suites under `__tests__/ios/` and `__tests__/android/` snapshot against generated test-app files and need `npm run setup-test-app` first (`TESTING.md`). Scenario tests only: `npm run test:scenarios`, which needs no setup.
- Build: `npm run build`
- Regenerate the API report: `npm run generate-api-docs` (runs `npm install` first)

`TESTING.md` says where new tests go. `local-development-readme.md` covers local setup.

## Conventions
- After changing the exported API, run `npm run generate-api-docs` and commit the updated `api-extractor-output/customerio-expo-plugin.api.md`. The Check API Changes workflow (`.github/workflows/check-api-changes.yml`) runs `npx api-extractor run --verbose` and fails when the report is out of date.
