import * as fs from 'fs';
import { modifyProjectBuildGradleForGoogleServices } from '../../../plugin/src/android/withProjectGoogleServices';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(
  getFixturePath('android', 'project_build.gradle'),
  'utf8'
);

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

  // Negative-template: customer's project build.gradle doesn't have a buildscript+dependencies
  // block. Helper should leave the file untouched.
  it('returns input unchanged when there is no buildscript+dependencies block', () => {
    const noBuildscript = [
      'allprojects {',
      '    repositories {',
      '        google()',
      '    }',
      '}',
      '',
    ].join('\n');
    expect(modifyProjectBuildGradleForGoogleServices(noBuildscript)).toEqual(
      noBuildscript
    );
  });
});
