# iOS toolchain compatibility

The plugin's iOS CI runs on two Xcode versions. Which one a job uses depends on the Expo SDK of the app it generates.

| Expo SDK | Xcode | Runner | What the job checks |
| --- | --- | --- | --- |
| 58+ (`latest`) | 27.0 | `xcode-27` | prebuild, plugin tests, native build, then install, launch and 10 s survival on the iOS 27 simulator |
| 54–57 (pinned rows, and the Expo 55 sample app) | 26.6 | `macos-26` | prebuild, plugin tests, native build |

## Why the split

The iOS 27 SDK terminates any app that has not adopted the UIScene life cycle during launch:

```
Application failed to launch: UIScene life cycle is required for apps built with this SDK.
```

Expo SDK 58 and later generate a `SceneDelegate` and a `UIApplicationSceneManifest`, and the plugin
patches that scene host behind `isExpoVersion58OrHigher` (`plugin/src/ios/utils.ts`). Those apps are
built with Xcode 27 and must launch.

Expo SDK 53–57 generate no scene manifest, so their apps cannot launch when built with the iOS 27 SDK.
That is a platform rule the plugin cannot change. Hosts on those SDKs build with Xcode 26, and so does
CI for them. The Xcode 26 jobs stay while those SDKs are supported. They cost nothing extra, since
those jobs exist anyway.

## The launch check

A native build can pass while the app still terminates at launch, for example when its host life
cycle is incompatible with the SDK it was built with. So the Xcode 27 rows go one step further than
the build: `.github/actions/launch-generated-ios-app` resolves the simulator `.app` that
`compatibility:validate-plugin` built (`scripts/compatibility/resolve_simulator_app.py`), then
installs it, launches it, and requires the process to stay alive (shared
`launch-simulator-app` action from `customerio/mobile-ci-tools`). A row opts in with
`launch-ios-major` in its matrix entry. On failure, the launch log and sanitized build settings
are uploaded.

The matrix workflow checks out `inputs.ref` for the code under test but takes the launch check from
its own revision, so a manual run against an older ref still gets it.

A launch check proves generated-project compilation, simulator installation, launch, and short
process survival. It does not prove lifecycle callback forwarding, physical-device push delivery,
signing, export, or App Store acceptance.

## What changed from the preview nightly

Until the move to Xcode 27, a separate nightly (`ios-toolchain-compatibility.yml`) ran these launches
on the Xcode 27 preview runner, plus an Expo 57 leg that asserted the known UIScene launch failure.
Regular CI now does the launches, so the nightly is gone. The Expo 57 leg was dropped. It re-asserted
a platform rule the plugin cannot change, so a flip would leave nothing to act on. Two things went with
it:
- an explicit Expo 57 build: regular CI builds SDK 54 and the SDK 55 sample app;
- the overnight schedule: upstream changes are now caught by the next PR or release run.

`xcode-27` is a hosted public-preview label (actions/runner-images#14404), so jobs on it can queue
longer than `macos-26` ones. Queue time is not covered by job timeouts. A cell that never started is
not a compatibility pass.
