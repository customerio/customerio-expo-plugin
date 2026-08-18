# MBL-2232 Expo 57 lifecycle fixture

This is test-only instrumentation for the pinned Expo 57 topology. It is not
included by `package.json`'s published `files` list and it does not change the
Customer.io production config plugin.

## Canonical contract

The contract is vendored at the same repo-relative paths as the immutable
content commit named by `pinned_content_commit` in
`docs/dev-notes/ios27-lifecycle-contract-v1.lock.json`.
The ordered 18-file bundle is locked by
`docs/dev-notes/ios27-lifecycle-contract-v1.lock.json`. The lock and
`scripts/ios27_lifecycle_contract.py` are byte-identical to the native repo.

```sh
python3 scripts/ios27_lifecycle_contract.py verify --root .
python3 scripts/ios27_lifecycle_contract.py sync \
  --source-root /path/to/customerio-ios-descending-from-the-pinned-content \
  --destination-root .
```

There is no second Expo schema or JavaScript validator. Run the canonical
Python validator and its checked vectors. Runtime records may claim only
`diagnostic`, `L2`, or `L3`. Source inspection and compile/link checks are
reported separately as L0 and L1 review evidence.

## Observer architecture

The generated fixture contains one local pod, `CioLifecycleProbe`:

- its recorder and harness use only Apple SDK frameworks;
- its Expo module exposes harness context/control only;
- the shared platform observer type is compiled but never instantiated by the
  Expo bootstrap or module; the Expo-specific observer is the sole recorder
  consumer and terminal owner;
- it declares no `apple.appDelegateSubscribers` entry;
- it implements no Expo `NotificationDelegate`;
- it never installs or replaces a production delegate;
- it never wraps, retains, calls, or inspects a production completion handler.

Exact-hash fixture-only patches add synchronous Foundation notification posts
to existing framework or generated-app seats. One observer feeds the single
Swift recorder. The patches never compile recorder copies into Expo,
ExpoModulesCore, or ExpoNotifications.

Expo 57 otherwise defaults to a precompiled `ExpoModulesCore` XCFramework,
which would make a source patch look compiled while bypassing it at runtime.
The same exact-hash patcher therefore changes only the generated fixture's
`ios/Podfile.properties.json` from `EXPO_USE_PRECOMPILED_MODULES=true` to
`false` before `pod install`. Runtime validation requires the resolved local
podspec to contain source files, the Pods project to compile
`ExpoAppDelegateSubscriberManager.swift`, and no `ExpoModulesCore.xcframework`
reference. An unknown template or precompiled graph fails closed.

Cold bootstrap posts are gated by the closed canonical cold-scenario set.
Starting the recorder at process load for a warm harness run therefore does not
mislabel AppDelegate launch, Expo loader/will-finish/did-finish, or initial RCT
bootstrap callbacks as part of the warm scenario.

The pinned seats are:

- `AppDelegatesLoaderDelegate`, after real subscriber and React handler
  registration;
- `ExpoAppDelegate` will/did-finish forwarding;
- `ExpoAppDelegateSubscriberManager` lifecycle, URL, activity, notification,
  token, background-fetch, and quick-action forwarding methods;
- ExpoNotifications `NotificationCenterManager` UN delegate entries;
- ExpoNotifications `EmitterModule` OnCreate, event sends, and last-response
  pull;
- the generated `AppDelegate` raw callbacks that actually exist for the
  selected APN, FCM, or no-push variant.

No scene callback is added because the Expo 57 template has no scene delegate
and Expo 57 has no iOS scene forwarding seat. No raw quick-action callback is
added because the generated AppDelegate has none. The known production
`#if canImport(EXNotifications)` compatibility gap is not repaired by this
fixture.

This fixture therefore declares `host_topology=app-delegate-only`. The harness
must provide the same value through `CIO_LIFECYCLE_HOST_TOPOLOGY`; declaring a
UIScene topology against this source graph fails the canonical manifest and
startup evidence checks rather than inferring support from missing callbacks.

## JavaScript receipts

`javascript/LifecycleReceipts.ts` observes only public app-level APIs:

- `Notifications.addNotificationReceivedListener` for foreground delivery;
- `Notifications.addNotificationResponseReceivedListener` for warm taps;
- `Notifications.getLastNotificationResponseAsync` for cold taps only;
- `Linking.addEventListener("url")` for warm links;
- `Linking.getInitialURL` for cold links only;
- `AppState` for app lifecycle receipts.

The scenario from the harness selects exactly one cold or warm branch. There
is no warm-listener/cold-pull deduplication heuristic. JavaScript emits nothing
unless the native context bridge supplies all harness-issued identities,
including its distinct stream ID. It never mints an ID or infers provider,
scenario, evidence level, integration, runtime, host topology, or activation
occurrence. Every non-control JavaScript record carries the harness-issued
activation occurrence used by the Swift stream.

The bridge requires these additional harness inputs for the JavaScript stream:

```text
CIO_LIFECYCLE_JAVASCRIPT_STREAM_ID
CIO_LIFECYCLE_JAVASCRIPT_INTEGRATION=expo
CIO_LIFECYCLE_JAVASCRIPT_RUNTIME=javascript
CIO_LIFECYCLE_JAVASCRIPT_OUTPUT_PATH
```

After the selected JavaScript receipt drains, the no-seat bridge only polls for
the native post-drain receipt. JavaScript never starts or ends the Swift stream.
The native observer schedules one close only after a supported real terminal
seat is recorded. Route intent is never terminal; the first route result can
close, and later results cannot schedule another close. Neither path
participates in an Expo or Apple lifecycle completion handler.

The fixture supports icon launch, push/local taps, custom and universal links,
Live Activity taps, token registration, registration failure, and app
background/foreground. It refuses foreground-presentation, background-fetch,
notification-settings, and quick-action runs because this topology does not
have the required observable result/terminal or raw host seat. A harness must
stop instead of relabeling those scenarios as L2.

The no-push generated variant has no Customer.io URL handler, so its patched
AppDelegate deliberately emits no `customerio.route-deep-link`. No-push Live
Activity attribution is unsupported. A Live Activity run must stop unless its
exact generated variant compiles the existing Customer.io routing handler.

## Exact generated variants

Versions are frozen at Expo 57.0.12, ExpoModulesCore 57.0.10,
ExpoNotifications 57.0.10, React Native 0.86.2, and
customerio-reactnative 6.6.2. Original sources, podspecs, and module config are
under `__tests__/fixtures/ios/expo57-generated`. Patched APN, FCM, and no-push
outputs are under `__tests__/fixtures/ios/expo57-patched`.

`scripts/expo57-source-patch.lock.json` pins every accepted pre/post hash. The
patcher refuses unknown input and unknown output bytes.

```sh
mise exec node@24 -- node lifecycle-fixture/scripts/install-probe.js \
  --app-path=ci-test-apps/LifecycleFixture_Expo57

cd ci-test-apps/LifecycleFixture_Expo57
CI=1 mise exec node@24 -- npx expo prebuild --clean --platform ios --no-install
cd ../..

mise exec node@24 -- node lifecycle-fixture/scripts/pin-expo-fixture-sources.js \
  --app-path=ci-test-apps/LifecycleFixture_Expo57
mise exec node@24 -- node lifecycle-fixture/scripts/patch-expo57-sources.js \
  --app-path=ci-test-apps/LifecycleFixture_Expo57 --snapshot=apn

cd ci-test-apps/LifecycleFixture_Expo57/ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  mise exec node@24 -- pod install
cd ../../..
mise exec node@24 -- node \
  lifecycle-fixture/scripts/patch-customerio-pod-sources.js \
  --app-path=ci-test-apps/LifecycleFixture_Expo57 --snapshot=apn
```

`patch-expo57-sources.js` supports the `apn`, `fcm`, and `nopush` snapshots.
`patch-customerio-pod-sources.js` applies only to the `apn` and `fcm`
snapshots; the no-push graph contains no Customer.io push pod to patch.

Use `--snapshot=fcm` or `--snapshot=nopush` only after configuring and
prebuilding that exact variant. `scripts/compatibility/configure-plugin.js`
accepts `--ios-no-push` for the no-push fixture.

## Validation

```sh
# Contract identity and checked vectors
python3 scripts/ios27_lifecycle_contract.py verify --root .
python3 -m unittest docs/dev-notes/test_validate_ios27_lifecycle_trace.py
mise exec node@24 -- node lifecycle-fixture/scripts/test-javascript-recorder.js
python3 lifecycle-fixture/scripts/test-expo-producer-captures.py
python3 lifecycle-fixture/scripts/test-expo-runtime-capture.py

# Source/hash/API tests under the pinned Node runtime
mise exec node@24 -- npx jest --selectProjects scenarios --runInBand \
  __tests__/scenarios/ios/lifecycleFixture.test.ts \
  __tests__/scenarios/ios/appDelegateSwiftSdkVersions.test.ts

# Focused JavaScript typecheck. The whole generated app currently has two
# unrelated Expo template CSS declaration errors.
cd ci-test-apps/LifecycleFixture_Expo57
mise exec node@24 -- npx tsc --ignoreConfig --noEmit --skipLibCheck \
  --target ES2022 --module Preserve --moduleResolution Bundler \
  --jsx react-jsx src/lifecycle/LifecycleReceipts.ts

# Swift support check and then the generated application build
cd ../..
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  lifecycle-fixture/scripts/typecheck-probe.sh
xcrun simctl list devices available
```

After CocoaPods installs each APN, FCM, or no-push generated variant, run the
real dependency-provenance integration check before patching or building it:

```sh
python3 lifecycle-fixture/scripts/test-expo-runtime-capture.py --integration \
  --source-root . --app-path ci-test-apps/LifecycleFixture_Expo57 \
  --variant apn
```

Repeat with `--variant fcm` and `--variant nopush` against those exact generated
apps. A single generated directory represents only one variant at a time.

For an actual L2/L3 run, first obtain the exact fixture-checkout provenance
object and generated-fixture digest. Put the returned `fixture_source` object
in the manifest. Keep `repositories.customerio-expo-plugin` and its framework
commit pinned to the audited production 3.7.1 topology, rather than relabeling
fixture-only commits as production plugin code. Then validate the native and
JavaScript NDJSON plus their separate post-drain receipts:

```sh
python3 lifecycle-fixture/scripts/validate-expo-runtime-capture.py \
  --source-root . \
  --app-path ci-test-apps/LifecycleFixture_Expo57 \
  --variant apn --print-provenance

python3 lifecycle-fixture/scripts/validate-expo-runtime-capture.py \
  --source-root . \
  --app-path ci-test-apps/LifecycleFixture_Expo57 \
  --variant apn \
  --validator-python /path/to/python-with-jsonschema-format \
  --manifest /outside/source/manifest.json \
  --native-trace /outside/source/swift.ndjson \
  --native-receipt /outside/source/swift.ndjson.receipt.json \
  --javascript-trace /outside/source/javascript.ndjson \
  --javascript-receipt /outside/source/javascript.receipt.json
```

The validator compares every compiled fixture patch seat, installed probe
source, JavaScript receipt source, variant config, and Customer.io pod patch to
the pinned snapshots. It additionally rejects Expo's precompiled-modules mode
and verifies the resolved Pods project compiles the patched ExpoModulesCore
subscriber manager from source. It also derives the installed Expo, ExpoModulesCore,
ExpoNotifications, React Native, Customer.io wrapper/plugin, Customer.io iOS,
push-provider, and Firebase Messaging versions from package manifests,
`package-lock.json`, and `Podfile.lock`, then requires exact manifest framework
versions. The explicitly selected validator Python must provide
`jsonschema[format]>=4.18,<5`. The repository-owned contract verifier must then
validate the byte-locked 18-file canonical bundle before the non-overridable
canonical validator is invoked. The manifest's `fixture_source` records the
actual current checkout commit and dirty state. When dirty, its snapshot hashes
all tracked and untracked, non-ignored outer-repository source, including those
snapshots and patch inputs. This closes the otherwise invisible `ci-test-apps`
provenance gap without weakening the audited production topology.
The printed generated-fixture SHA is only a diagnostic comparison aid, not a
second or unrecorded manifest provenance field.

A green source test is L0. A successful compile/link is L1. Neither proves a
callback fired. Only a complete, zero-drop simulator capture with a validating
manifest is L2, and only an equivalent physical-device capture is L3. This
branch contains no L2 or L3 capture.
