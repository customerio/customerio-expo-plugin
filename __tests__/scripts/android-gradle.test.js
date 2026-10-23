const {
  readGradleProperty,
  removeKotlinAndroidPlugin,
  setGradleProperties,
} = require('../../scripts/utils/android-gradle');

// Lines 73-78 of the android/gradle.properties that `expo prebuild` generates
// for Expo SDK 58 (expo 58.0.16, captured 2026-10-20).
const SDK_58_TEMPLATE = [
  '# Opt out of built-in kotlin and new DSL behavior that ships with AGP 9.',
  '# Starting from AGP 10.x these opt outs will be removed.',
  'android.builtInKotlin=false',
  'android.newDsl=false',
  '',
  'expo.inlineModules.watchedDirectories=[]',
  '',
].join('\n');

const AGP9_DEFAULTS = {
  'android.builtInKotlin': 'true',
  'android.newDsl': 'true',
};

describe('readGradleProperty', () => {
  it('reads the template opt-out', () => {
    expect(readGradleProperty(SDK_58_TEMPLATE, 'android.builtInKotlin')).toBe('false');
    expect(readGradleProperty(SDK_58_TEMPLATE, 'android.newDsl')).toBe('false');
  });

  it('returns undefined for a property the file does not set', () => {
    expect(readGradleProperty(SDK_58_TEMPLATE, 'android.useAndroidX')).toBeUndefined();
  });

  it('accepts whitespace and the colon separator', () => {
    expect(readGradleProperty('  android.newDsl : true\n', 'android.newDsl')).toBe('true');
  });

  it('uses the last definition, as Gradle does', () => {
    const contents = 'android.newDsl=false\nandroid.newDsl=true\n';
    expect(readGradleProperty(contents, 'android.newDsl')).toBe('true');
  });

  it('does not treat the dot in a key as a wildcard', () => {
    expect(readGradleProperty('androidXnewDsl=true\n', 'android.newDsl')).toBeUndefined();
  });
});

describe('setGradleProperties', () => {
  it('flips the template opt-out in place', () => {
    expect(setGradleProperties(SDK_58_TEMPLATE, AGP9_DEFAULTS)).toBe(
      [
        '# Opt out of built-in kotlin and new DSL behavior that ships with AGP 9.',
        '# Starting from AGP 10.x these opt outs will be removed.',
        'android.builtInKotlin=true',
        'android.newDsl=true',
        '',
        'expo.inlineModules.watchedDirectories=[]',
        '',
      ].join('\n')
    );
  });

  it('appends properties the file does not set', () => {
    expect(setGradleProperties('org.gradle.parallel=true', AGP9_DEFAULTS)).toBe(
      'org.gradle.parallel=true\nandroid.builtInKotlin=true\nandroid.newDsl=true\n'
    );
  });

  it('replaces every definition so no stale value wins', () => {
    const updated = setGradleProperties(
      'android.newDsl=false\nother=1\n android.newDsl : false\n',
      { 'android.newDsl': 'true' }
    );
    expect(updated).toBe('android.newDsl=true\nother=1\nandroid.newDsl=true\n');
    expect(readGradleProperty(updated, 'android.newDsl')).toBe('true');
  });
});

describe('removeKotlinAndroidPlugin', () => {
  // First lines of the android/app/build.gradle that `expo prebuild` generates
  // for Expo SDK 58 with this plugin's Google Services line (captured 2026-10-20).
  const SDK_58_APP_BUILD_GRADLE = [
    'apply plugin: "com.android.application"',
    'apply plugin: "com.google.gms.google-services"  // Google Services plugin',
    'apply plugin: "org.jetbrains.kotlin.android"',
    'apply plugin: "com.facebook.react"',
    '',
  ].join('\n');

  it('drops the template\'s Kotlin Android plugin and keeps the rest', () => {
    expect(removeKotlinAndroidPlugin(SDK_58_APP_BUILD_GRADLE)).toBe(
      [
        'apply plugin: "com.android.application"',
        'apply plugin: "com.google.gms.google-services"  // Google Services plugin',
        'apply plugin: "com.facebook.react"',
        '',
      ].join('\n')
    );
  });

  it('drops the short plugin ID with single quotes', () => {
    expect(
      removeKotlinAndroidPlugin("apply plugin: 'com.android.library'\napply plugin: 'kotlin-android'\n")
    ).toBe("apply plugin: 'com.android.library'\n");
  });

  it('keeps other Kotlin plugins', () => {
    const contents = "apply plugin: 'org.jetbrains.kotlin.plugin.compose'\n";
    expect(removeKotlinAndroidPlugin(contents)).toBe(contents);
  });

  it('is a no-op when the plugin is not applied', () => {
    expect(removeKotlinAndroidPlugin('apply plugin: "com.android.application"\n')).toBe(
      'apply plugin: "com.android.application"\n'
    );
  });
});
