import * as fs from 'fs';
import { modifyProjectBuildGradleAndroid16Support } from '../../../plugin/src/android/withProjectBuildGradle';
import { modifyProjectBuildGradleForGoogleServices } from '../../../plugin/src/android/withProjectGoogleServices';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(
  getFixturePath('android', 'project_build.gradle'),
  'utf8'
);

describe('android scenarios — modifyProjectBuildGradleAndroid16Support', () => {
  it('injects the resolutionStrategy block inside allprojects when the flag is true', () => {
    expect(
      modifyProjectBuildGradleAndroid16Support(baseline, {
        disableAndroid16Support: true,
      })
    ).toMatchInlineSnapshot(`
      "// Top-level build file where you can add configuration options common to all sub-projects/modules.

      buildscript {
          repositories {
              google()
              mavenCentral()
          }
          dependencies {
              classpath('com.android.tools.build:gradle')
          }
      }

      allprojects {
          configurations.all {
              resolutionStrategy {
                  // Disable Android 16 support by forcing older androidx versions
                  // Compatible with API 35 and AGP 8.8.2 (prevents API 36/AGP 8.9.1+ requirement)
                  force 'androidx.core:core-ktx:1.13.1'
                  force 'androidx.lifecycle:lifecycle-process:2.8.7'
              }
          }
          repositories {
              google()
              mavenCentral()
          }
      }
      "
    `);
  });

  it('returns input unchanged when the flag is false', () => {
    expect(
      modifyProjectBuildGradleAndroid16Support(baseline, {
        disableAndroid16Support: false,
      })
    ).toEqual(baseline);
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
  it('injects the Google Services classpath into buildscript.dependencies', () => {
    expect(modifyProjectBuildGradleForGoogleServices(baseline))
      .toMatchInlineSnapshot(`
      "// Top-level build file where you can add configuration options common to all sub-projects/modules.

      buildscript {
          repositories {
              google()
              mavenCentral()
          }
          dependencies {
              classpath "com.google.gms:google-services:4.3.13"  // Google Services plugin
              classpath('com.android.tools.build:gradle')
          }
      }

      allprojects {
          repositories {
              google()
              mavenCentral()
          }
      }
      "
    `);
  });

  it('is idempotent', () => {
    const once = modifyProjectBuildGradleForGoogleServices(baseline);
    const twice = modifyProjectBuildGradleForGoogleServices(once);
    expect(twice).toEqual(once);
  });
});
