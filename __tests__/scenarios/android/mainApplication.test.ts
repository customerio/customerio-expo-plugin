import * as fs from 'fs';
import { injectCustomerIOInitializerIntoMainApplication } from '../../../plugin/src/android/withMainApplicationModifications';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(
  getFixturePath('android', 'MainApplication.kt'),
  'utf8'
);

describe('android scenarios — injectCustomerIOInitializerIntoMainApplication', () => {
  it('adds the SDK initializer import and injects the onCreate call', () => {
    expect(injectCustomerIOInitializerIntoMainApplication(baseline))
      .toMatchInlineSnapshot(`
      "package io.customer.testbed.expo

      import android.app.Application
      import com.facebook.react.PackageList

      import io.customer.sdk.expo.CustomerIOSDKInitializer

      class MainApplication : Application() {
        override fun onCreate() {
          super.onCreate()
        
          // Auto Initialize Native Customer.io SDK
          CustomerIOSDKInitializer.initialize(this)
        }
      }
      "
    `);
  });

  it('is idempotent — running twice equals running once', () => {
    const once = injectCustomerIOInitializerIntoMainApplication(baseline);
    const twice = injectCustomerIOInitializerIntoMainApplication(once);
    expect(twice).toEqual(once);
  });

  // Customer's MainApplication.kt has no existing imports — only the package line.
  // Helper should insert the SDK initializer import right after the package line.
  it('inserts the import after the package line when no existing imports are present', () => {
    const noImports = [
      'package io.customer.testbed.expo',
      '',
      'class MainApplication : Application() {',
      '  override fun onCreate() {',
      '    super.onCreate()',
      '  }',
      '}',
      '',
    ].join('\n');
    expect(injectCustomerIOInitializerIntoMainApplication(noImports))
      .toMatchInlineSnapshot(`
      "package io.customer.testbed.expo


      import io.customer.sdk.expo.CustomerIOSDKInitializer
      class MainApplication : Application() {
        override fun onCreate() {
          super.onCreate()
        
          // Auto Initialize Native Customer.io SDK
          CustomerIOSDKInitializer.initialize(this)
        }
      }
      "
    `);
  });

  // Negative-template: customer's MainApplication.kt has neither a package line nor any
  // imports — addImportToFile has nothing to anchor on. The helper currently still injects
  // the onCreate call even though the import couldn't be added, producing output that
  // references CustomerIOSDKInitializer without importing it. Snapshotted as-is so a
  // reviewer can decide whether to harden the helper to bail on no-anchor inputs.
  it('injects the onCreate call but no import when there is no package or imports to anchor to', () => {
    const noPackageNoImports = [
      'class MainApplication : Application() {',
      '  override fun onCreate() {',
      '    super.onCreate()',
      '  }',
      '}',
      '',
    ].join('\n');
    expect(injectCustomerIOInitializerIntoMainApplication(noPackageNoImports))
      .toMatchInlineSnapshot(`
      "class MainApplication : Application() {
        override fun onCreate() {
          super.onCreate()
        
          // Auto Initialize Native Customer.io SDK
          CustomerIOSDKInitializer.initialize(this)
        }
      }
      "
    `);
  });

  // Negative-template: customer's MainApplication.kt is missing override fun onCreate()
  // (e.g., they removed it for a custom subclass). Import gets added but the call
  // injection is a no-op; helper still returns valid Kotlin.
  it('adds the import but no onCreate call when override fun onCreate() is missing', () => {
    const noOnCreate = [
      'package io.customer.testbed.expo',
      '',
      'import android.app.Application',
      '',
      'class MainApplication : Application()',
      '',
    ].join('\n');
    expect(injectCustomerIOInitializerIntoMainApplication(noOnCreate))
      .toMatchInlineSnapshot(`
      "package io.customer.testbed.expo

      import android.app.Application

      import io.customer.sdk.expo.CustomerIOSDKInitializer

      class MainApplication : Application()
      "
    `);
  });
});
