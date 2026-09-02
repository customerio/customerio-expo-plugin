# iOS toolchain compatibility

`Xcode 27 preview compatibility` generates an app with the latest published Expo SDK, builds APN and FCM configurations on the floating Xcode 27 preview runner, installs each generated simulator product, launches it, and verifies that the expected executable remains alive for the configured survival window. It runs nightly at 07:17 UTC, on manual dispatch, and when its workflow or generated-app resolver changes. Ordinary source pull requests and pushes do not trigger it; a pull request changing those preview-only files intentionally opts into the preview jobs.

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

## The expected failure, and how to read this job

The generated APN and FCM apps are expected to fail the shared launch action until Expo UIScene
host-lifecycle support lands. The Expo SDK 57 template ships no `UIApplicationSceneManifest` and no
`SceneDelegate`, so on the iOS 27 SDK the process is terminated during launch with:

```
Application failed to launch: UIScene life cycle is required for apps built with this SDK.
```

This is not a plugin defect. The Customer.io plugin is already SDK-58-ready and gates its scene work
behind `isExpoVersion58OrHigher` (`plugin/src/ios/utils.ts`); Expo 58 exists only as a canary.

The launch step therefore carries `continue-on-error: true`, and a following step **asserts** that
known failure instead of letting it redden the job. A permanently-red job is not a signal — it
trains everyone to ignore the result, which is exactly how a real regression would slip through. The
assertion is inverted rather than muted: the defect stays visible, but a *change* in it is what
turns the job red.

**Green here means the known defect is unchanged. It does NOT mean Expo works on iOS 27.** The
generated apps still fail to launch on every green run; the job is asserting that they fail in
precisely the tracked way.

The job goes red when any of three conditions stops holding, and the failure names which one:

| flip reason | meaning | what to do |
| --- | --- | --- |
| `launch-now-succeeds` | the app launched and survived the window | Expo's UIScene host lifecycle landed — enable scene support and retire this gate |
| `signature-changed` | the launch still fails, but not with the UIScene signature | a genuinely new problem; triage it as a normal failure |
| `expo-sdk-moved` | the generated app is no longer on Expo SDK 57 | this gate's premise is stale; on SDK 58+ the plugin's own scene support takes over |

The assertion is gated on the launch step's `outcome`, not on the shared action's `failure-reason`
output, because a failing composite step does not reliably propagate its outputs. The action still
publishes the bounded simulator log, and that log is what the signature check reads; it is uploaded
as an artifact on every run either way.

A flip on the **scheduled** run notifies `#mobile-deployments` with the reason above. Pull-request
runs of this workflow (it is triggered by changes to itself) stay silent. The Slack post uses an
incoming webhook, which needs no `GITHUB_TOKEN` scope, so this workflow keeps
`permissions: contents: read`.

Do not "fix" a red run by relaxing the assertion, and do not restore the always-red behaviour.

The review invariant is the known failure mode, not merely a successful build: an Xcode 27 product can compile and still terminate during launch when its generated host lifecycle is incompatible. That is why the job asserts the launch failure rather than the build. When Xcode 27 becomes stable, remove this temporary preview workflow and add Xcode 27 to the normal required compatibility and release paths. Exact beta-image validation belongs in a temporary, explicitly test-only PR. A compatibility pass proves generated-project compilation, simulator installation, launch, and short process survival for the named Expo/provider combination. It does not prove lifecycle callback forwarding, authenticated UI paths, physical-device push delivery, signing, export, or App Store acceptance.
