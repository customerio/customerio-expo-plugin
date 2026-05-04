import * as fs from 'fs';
import { modifyAppBuildGradle } from '../../../plugin/src/android/withAppGoogleServices';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(getFixturePath('android', 'app_build.gradle'), 'utf8');

describe('android scenarios — modifyAppBuildGradle', () => {
  it('injects the Google Services plugin apply line under the android.application apply line', () => {
    const result = modifyAppBuildGradle(baseline);
    const appliedLine = result.match(/^apply plugin: "com\.google\.gms\.google-services".*$/m);
    expect(appliedLine).not.toBeNull();
    // It should sit immediately after the android.application apply line
    const lines = result.split('\n');
    const androidIdx = lines.findIndex((l) => l === 'apply plugin: "com.android.application"');
    expect(lines[androidIdx + 1]).toMatchInlineSnapshot(
      `"apply plugin: "com.google.gms.google-services"  // Google Services plugin"`,
    );
  });

  it('is idempotent — applying twice equals applying once', () => {
    const once = modifyAppBuildGradle(baseline);
    const twice = modifyAppBuildGradle(once);
    expect(twice).toEqual(once);
  });
});
