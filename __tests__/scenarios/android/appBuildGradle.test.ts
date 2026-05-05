import { modifyAppBuildGradle } from '../../../plugin/src/android/withAppGoogleServices';

// Minimal-but-viable slice of an Expo prebuild app/build.gradle.
// The helper looks for the `apply plugin: "com.android.application"` line and
// inserts the Google Services apply line right after it.
const baseline = [
  'apply plugin: "com.android.application"',
  'apply plugin: "org.jetbrains.kotlin.android"',
  'apply plugin: "com.facebook.react"',
  '',
].join('\n');

describe('android scenarios — modifyAppBuildGradle', () => {
  it('injects the Google Services apply line under the android.application apply line', () => {
    expect(modifyAppBuildGradle(baseline)).toMatchInlineSnapshot(`
      "apply plugin: "com.android.application"
      apply plugin: "com.google.gms.google-services"  // Google Services plugin
      apply plugin: "org.jetbrains.kotlin.android"
      apply plugin: "com.facebook.react"
      "
    `);
  });

  it('is idempotent — applying twice equals applying once', () => {
    const once = modifyAppBuildGradle(baseline);
    const twice = modifyAppBuildGradle(once);
    expect(twice).toEqual(once);
  });

  // Negative-template: customer's app/build.gradle doesn't have the anchor line.
  // Helper should leave the file untouched rather than producing malformed output.
  it('returns input unchanged when there is no com.android.application apply line', () => {
    const noAndroidPlugin = [
      'apply plugin: "com.facebook.react"',
      'apply plugin: "org.jetbrains.kotlin.android"',
      '',
    ].join('\n');
    expect(modifyAppBuildGradle(noAndroidPlugin)).toEqual(noAndroidPlugin);
  });
});
