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
});
