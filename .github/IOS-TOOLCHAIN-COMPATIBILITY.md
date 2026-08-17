# iOS toolchain compatibility

`Xcode 27 preview compatibility` generates an app with the latest published Expo SDK, builds APN and FCM configurations on the floating Xcode 27 preview runner, installs each generated simulator product, launches it, and verifies that the expected executable remains alive for the configured survival window. It runs nightly at 07:17 UTC, on manual dispatch, and when its workflow or generated-app resolver changes. Ordinary source pull requests and pushes do not trigger it; a pull request changing those preview-only files intentionally opts into the preview jobs.

The existing `Validate Plugin Compatibility` pull-request workflow remains the required stable-Xcode regression coverage for APN and FCM, and the release workflow continues to run the stable full Expo SDK matrix. Repeating those stable builds in the preview workflow would consume scarce hosted macOS capacity without adding a distinct release gate.

Nightly preview failures are recorded as failed scheduled or manually dispatched runs. Native iOS
[PR #1216](https://github.com/customerio/customerio-ios/pull/1216) adds the separate Ubuntu
watchdog that will check the iOS, Flutter, and Expo scheduled results after their normal completion
window and alert the Mobile team for a failed, incomplete, or missing run. Until that dependency
merges and passes a cross-repository manual dispatch, repository Actions history is the source of
truth. A pull request specifically changing Expo's iOS toolchain integration can be
validated before merge with a manual dispatch or an explicitly test-only workflow change. The
workflow records the hosted image, macOS, architecture, exact Xcode build, SDK versions, and
installed runtimes through shared `mobile-ci-tools` actions. It verifies toolchain families rather
than copying an exact beta-image pin into this repository. A hosted preview label can become
unavailable before a job starts, and job timeouts do not cover queue time; neither state is a
compatibility pass. If an expected result or watchdog alert is absent, check this repository's
Actions history and the pending native watchdog PR before treating the nightly as healthy.

The current generated APN and FCM apps are expected to report `generated-app-launch-failed` or
`generated-app-exited-early` until Expo UIScene host-lifecycle support lands. Which classification
appears depends on whether UIKit rejects launch immediately or terminates shortly afterward. That known red result is the compatibility defect this
nightly is intended to preserve visibly; do not interpret it as a healthy baseline or suppress it.

The review invariant is the known failure mode, not merely a successful build: an Xcode 27 product can compile and still terminate during launch when its generated host lifecycle is incompatible. When Xcode 27 becomes stable, remove this temporary preview workflow and add Xcode 27 to the normal required compatibility and release paths. Exact beta-image validation belongs in a temporary, explicitly test-only PR. A compatibility pass proves generated-project compilation, simulator installation, launch, and short process survival for the named Expo/provider combination. It does not prove lifecycle callback forwarding, authenticated UI paths, physical-device push delivery, signing, export, or App Store acceptance.
