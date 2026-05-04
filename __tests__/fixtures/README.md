# Scenario-suite fixtures

Hand-curated, **version-pinned** native-project file fragments used by the Jest scenario suite under `__tests__/scenarios/`. Each fixture represents the relevant slice of an Expo prebuild output for a *frozen* SDK version.

## Why pinned, not `latest`

Pinned-SDK fixtures don't drift: once a fixture for SDK 54 is committed it stays valid for SDK 54 forever, because the SDK 54 template is frozen. Coverage of the *current* SDK (`latest`) comes from the real-build tiers (smoke matrix + release-gated full matrix), not from this directory.

## Layout

- `android/` — pinned Android fixtures. Filenames carry the SDK suffix when relevant (e.g. `MainApplication_kt_sdk54.kt`).
- `cio-artifacts/` — vendor-supplied artifact stubs (`google-services.json`, `GoogleService-Info.plist`) used by side-effect helpers.
- (iOS fixtures land under `ios/` in PR 4.)

## When to refresh

- Add a new fixture variant when an Expo SDK ships a new template shape we want to keep covering. Don't replace the old one — keep both, parameterized by SDK suffix in the filename.
- Don't touch a frozen-SDK fixture once shipped; that breaks the pinning guarantee.
