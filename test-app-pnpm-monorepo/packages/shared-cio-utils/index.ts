// This package exists solely so that customerio-reactnative is depended on
// from more than one workspace package. That's what triggers pnpm's
// deduplication and symlinking behavior — the exact shape that surfaced the
// duplicate-pod bug in the Good Neighbor support case.
export function describeWorkspace(): string {
  return 'Shared package depends on customerio-reactnative — exercises pnpm symlink/dedupe.';
}
