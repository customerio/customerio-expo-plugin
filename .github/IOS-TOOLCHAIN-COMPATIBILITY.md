# iOS toolchain compatibility

`Xcode 27 preview compatibility` generates apps with the latest published Expo SDK and with Expo SDK 57, builds them on the floating Xcode 27 preview runner, installs each generated simulator product, and launches it. The latest-SDK APN and FCM apps must remain alive for the configured survival window; the SDK 57 app is expected to fail in a known way (see below). It runs nightly at 07:17 UTC, on manual dispatch, and when its workflow or generated-app resolver changes. Ordinary source pull requests and pushes do not trigger it; a pull request changing those preview-only files intentionally opts into the preview jobs.

The existing `Validate Plugin Compatibility` pull-request workflow remains the required stable-Xcode regression coverage for APN and FCM, and the release workflow continues to run the stable full Expo SDK matrix. Repeating those stable builds in the preview workflow would consume scarce hosted macOS capacity without adding a distinct release gate.

Nightly preview flips are recorded as failed scheduled or manually dispatched runs, and this
repository's Actions history is the source of truth. A pull request specifically changing Expo's
iOS toolchain integration can be
validated before merge with a manual dispatch or an explicitly test-only workflow change. The
workflow records the hosted image, macOS, architecture, exact Xcode build, SDK versions, and
installed runtimes through shared `mobile-ci-tools` actions. It verifies toolchain families rather
than copying an exact beta-image pin into this repository. A hosted preview label can become
unavailable before a job starts, and job timeouts do not cover queue time; neither state is a
compatibility pass. If an expected result is absent, check this repository's Actions history before
treating the nightly as healthy.

## Which legs must launch, and which are expected to fail

The iOS 27 SDK terminates any app that has not adopted the UIScene life cycle during launch with:

```
Application failed to launch: UIScene life cycle is required for apps built with this SDK.
```

Expo SDK 58 and later generate a `SceneDelegate` and a `UIApplicationSceneManifest`, and the plugin
patches that scene host behind `isExpoVersion58OrHigher` (`plugin/src/ios/utils.ts`). The
**launch legs** (`expo-version: latest`, APN and FCM) are therefore ordinary checks: the generated app
must build, install, launch, and survive the window, and any failure turns the job red.

Expo SDK 53–57 generate no scene manifest and no `SceneDelegate`, so their apps cannot launch on the
iOS 27 SDK. This is not a plugin defect, and it cannot be fixed from the plugin. While those SDKs are
supported, one **legacy-host leg** (`expo-version: 57`, APN only, since the failure does not depend
on the push provider) keeps watching that known failure.

The legacy leg's launch step carries `continue-on-error`, and a following step **asserts** the known
failure instead of letting it redden the job. A permanently-red job is not a signal — it trains
everyone to ignore the result, which is exactly how a real regression would slip through. The
assertion is inverted rather than muted: the defect stays visible, but a *change* in it is what turns
the job red.

**Green on the legacy leg means the known defect is unchanged. It does NOT mean SDK 57 works on iOS
27.** The generated app still fails to launch on every green run; the job is asserting that it fails
in precisely the tracked way.

A run goes red, and the scheduled run notifies `#mobile-deployments`, with one of these reasons:

| reason | leg | meaning | what to do |
| --- | --- | --- | --- |
| `launch-leg-failed` | launch | an SDK 58+ app failed to build, install, launch, or survive | a regression; triage it as a normal failure |
| `launch-now-succeeds` | legacy | the SDK 57 app launched and survived the window | hosts without UIScene now launch on iOS 27; retire the legacy-host gate |
| `signature-changed` | legacy | the launch still fails, but not with the UIScene signature | a genuinely new problem; triage it as a normal failure |
| `expo-sdk-moved` | legacy | the legacy app is no longer on Expo SDK 57 | the matrix entry is wrong; SDK 58+ hosts belong on the launch legs |
| `expo-version-unresolved` | legacy | the gate could not read the app's Expo version | a probe bug in this workflow, not an Expo change |
| `job-failed-before-assertion` | legacy | the legacy leg broke before its launch step | triage it as a normal failure |

The assertion is gated on the launch step's `outcome`, not on the shared action's `failure-reason`
output, because a failing composite step does not reliably propagate its outputs. The action still
publishes the bounded simulator log, and that log is what the signature check reads; it is uploaded
as an artifact on every run either way.

Pull-request runs of this workflow (it is triggered by changes to itself) stay silent. The Slack
post uses an incoming webhook, which needs no `GITHUB_TOKEN` scope, so this workflow keeps
`permissions: contents: read`.

Do not "fix" a red run by relaxing the assertion, and do not restore the always-red behaviour. Drop
the legacy-host leg when SDK 57 leaves the supported range.

The review invariant is the launch, not merely a successful build: an Xcode 27 product can compile and still terminate during launch when its generated host lifecycle is incompatible. That is why every leg launches the app rather than stopping at the build. When Xcode 27 becomes stable, remove this temporary preview workflow and add Xcode 27 to the normal required compatibility and release paths. Exact beta-image validation belongs in a temporary, explicitly test-only PR. A compatibility pass proves generated-project compilation, simulator installation, launch, and short process survival for the named Expo/provider combination. It does not prove lifecycle callback forwarding, authenticated UI paths, physical-device push delivery, signing, export, or App Store acceptance.
