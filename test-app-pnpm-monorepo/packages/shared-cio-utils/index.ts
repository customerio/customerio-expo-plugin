// This package exists solely so that customerio-reactnative is depended on
// from more than one workspace package. That's what triggers pnpm's
// deduplication and symlinking behavior — the exact shape that surfaced the
// duplicate-pod bug in the support case this app was built for.
//
// WIP (inbox): the dependency spec here must stay byte-identical to the one in
// apps/mobile. Under `node-linker=hoisted` both specs collapse into a single
// root node_modules copy, so a published version here and a git branch there
// makes the published one win — and CocoaPods then sees its older
// `CustomerIO/MessagingInApp` pin fight the branch pods. Restore both to a
// published version together once the Visual Inbox ships.
export function describeWorkspace(): string {
  return 'Shared package depends on customerio-reactnative — exercises pnpm symlink/dedupe.';
}
