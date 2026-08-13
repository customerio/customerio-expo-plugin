# iOS toolchain compatibility

The pull-request `Validate Plugin Compatibility` workflow generates the latest supported Expo app and builds APN and FCM configurations on the supported Xcode 26.5 toolchain and the floating Xcode 27 preview runner. Android remains a separate matrix cell.

The stable cells are required regression evidence. Preview cells are experimental and non-blocking until Xcode 27 is supported as a stable toolchain. The workflow records the hosted image, macOS, architecture, exact Xcode build, SDK versions, and installed runtimes through the shared `mobile-ci-tools` action. It verifies toolchain families rather than copying an exact beta-image pin into this repository.

The release workflow intentionally continues to call the stable-only full Expo SDK matrix. A preview image change therefore cannot block npm deployment. When Xcode 27 becomes stable, add it to the full release matrix as a supported cell, make it blocking, and remove preview wording.

Exact beta-image validation belongs in a temporary, explicitly test-only PR. A compatibility pass proves generated-project compilation for the named Expo/provider combination. It does not prove app launch, lifecycle callback forwarding, physical-device push delivery, signing, export, or App Store acceptance.
