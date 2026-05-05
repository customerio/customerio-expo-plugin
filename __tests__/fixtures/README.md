# Scenario-suite fixtures

Hand-curated **minimal-but-viable** native-project file fragments used by the Jest scenario suite under `__tests__/scenarios/`. Each fixture is just large enough to look like real Expo prebuild output and exercise the anchors the helper under test searches for — and no larger. The whole *output* of the helper is then captured as an inline snapshot in the test, which is only readable when the fixture is small.

## Two principles

1. **Minimal but viable.** A fixture should still read as something a developer would recognize — not a stripped-out token soup. Trim everything the helper doesn't need to find, but keep enough surrounding context that it's clearly a recognizable Gradle / Kotlin / Swift / Plist file slice.
2. **Snapshot the whole transformed output, not extracted slices.** Because fixtures are small, the output is small, and `toMatchInlineSnapshot()` on the whole result fits inline in the test file. No regex extraction, no structural assertions across braces — just "this input → this output, exactly."

## Why minimal-but-viable, not realistic-full-template

Realistic-full-template fixtures make the helper output too large to inline-snapshot, which forces tests into one of two unsafe paths: (a) external whole-file snapshots that get auto-updated with `-u` instead of read, or (b) regex / position assertions that can be too loose to catch real bugs. Minimal-but-viable inputs keep the assertion in the test file and verifiable at a glance.

Realistic-shaped coverage — the kind that catches bugs only triggered by surrounding context — comes from the legacy snapshot tier in `__tests__/android/{snapshot tests}` for now, and from the smoke + release-gated real-build matrices later in the rollout. The scenario tier is *not* trying to cover that surface.

## Layout

- `android/` — Android fixtures (Gradle, Kotlin).
- `cio-artifacts/` — vendor-supplied artifact stubs (`google-services.json`, `GoogleService-Info.plist`) used by side-effect helpers.
- (iOS fixtures land under `ios/` in PR 4.)

## When to refresh

Only when a real Expo SDK template change breaks the helper's anchor regex — at which point you add a new variant (e.g., `MainApplication_sdkNN.kt`) rather than replacing the existing fixture, so historical coverage is preserved.
