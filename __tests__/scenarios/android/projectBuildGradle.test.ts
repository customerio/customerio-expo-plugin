import * as fs from 'fs';
import { modifyProjectBuildGradleAndroid16Support } from '../../../plugin/src/android/withProjectBuildGradle';
import { modifyProjectBuildGradleForGoogleServices } from '../../../plugin/src/android/withProjectGoogleServices';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(getFixturePath('android', 'project_build.gradle'), 'utf8');

describe('android scenarios — modifyProjectBuildGradleAndroid16Support', () => {
  it('injects the resolutionStrategy block when disableAndroid16Support is true', () => {
    const result = modifyProjectBuildGradleAndroid16Support(baseline, {
      disableAndroid16Support: true,
    });
    expect(result).toContain("force 'androidx.core:core-ktx:1.13.1'");
    expect(result).toContain("force 'androidx.lifecycle:lifecycle-process:2.8.7'");
    // Block lives inside the allprojects { ... } scope
    expect(result).toMatch(/allprojects\s*\{[\s\S]*configurations\.all[\s\S]*resolutionStrategy/);
  });

  it('returns input unchanged when the flag is false', () => {
    const result = modifyProjectBuildGradleAndroid16Support(baseline, {
      disableAndroid16Support: false,
    });
    expect(result).toEqual(baseline);
  });

  it('is idempotent when the flag is true', () => {
    const once = modifyProjectBuildGradleAndroid16Support(baseline, {
      disableAndroid16Support: true,
    });
    const twice = modifyProjectBuildGradleAndroid16Support(once, {
      disableAndroid16Support: true,
    });
    expect(twice).toEqual(once);
  });
});

describe('android scenarios — modifyProjectBuildGradleForGoogleServices', () => {
  it('injects the Google Services classpath under buildscript.dependencies', () => {
    const result = modifyProjectBuildGradleForGoogleServices(baseline);
    expect(result).toContain('classpath "com.google.gms:google-services:4.3.13"');
    // It should sit inside the buildscript { ... dependencies { ... } block
    expect(result).toMatch(
      /buildscript\s*\{[\s\S]*dependencies\s*\{[\s\S]*com\.google\.gms:google-services/,
    );
  });

  it('is idempotent', () => {
    const once = modifyProjectBuildGradleForGoogleServices(baseline);
    const twice = modifyProjectBuildGradleForGoogleServices(once);
    expect(twice).toEqual(once);
  });
});
