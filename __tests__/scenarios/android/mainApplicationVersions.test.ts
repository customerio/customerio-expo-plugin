import * as fs from 'fs';
import { injectCustomerIOInitializerIntoMainApplication } from '../../../plugin/src/android/withMainApplicationModifications';
import { getFixturePath } from '../../utils';

describe('MainApplication.kt — Expo SDK 54 vanilla baseline', () => {
  const baseline = fs.readFileSync(
    getFixturePath('android', 'MainApplication.sdk54.kt'),
    'utf8'
  );

  it('injects CustomerIOSDKInitializer import + onCreate call', () => {
    expect(injectCustomerIOInitializerIntoMainApplication(baseline))
      .toMatchInlineSnapshot(`
      "package io.customer.expo.fixture

      import android.app.Application
      import android.content.res.Configuration

      import com.facebook.react.PackageList
      import com.facebook.react.ReactApplication
      import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
      import com.facebook.react.ReactNativeHost
      import com.facebook.react.ReactPackage
      import com.facebook.react.ReactHost
      import com.facebook.react.common.ReleaseLevel
      import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
      import com.facebook.react.defaults.DefaultReactNativeHost

      import expo.modules.ApplicationLifecycleDispatcher
      import expo.modules.ReactNativeHostWrapper

      import io.customer.sdk.expo.CustomerIOSDKInitializer

      class MainApplication : Application(), ReactApplication {

        override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
            this,
            object : DefaultReactNativeHost(this) {
              override fun getPackages(): List<ReactPackage> =
                  PackageList(this).packages.apply {
                    // Packages that cannot be autolinked yet can be added manually here, for example:
                    // add(MyReactNativePackage())
                  }

                override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

                override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

                override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            }
        )

        override val reactHost: ReactHost
          get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

        override fun onCreate() {
          super.onCreate()
          DefaultNewArchitectureEntryPoint.releaseLevel = try {
            ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
          } catch (e: IllegalArgumentException) {
            ReleaseLevel.STABLE
          }
          loadReactNative(this)
          ApplicationLifecycleDispatcher.onApplicationCreate(this)
        
          // Auto Initialize Native Customer.io SDK
          CustomerIOSDKInitializer.initialize(this)
        }

        override fun onConfigurationChanged(newConfig: Configuration) {
          super.onConfigurationChanged(newConfig)
          ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
        }
      }
      "
    `);
  });
});

describe('MainApplication.kt — Expo SDK 55 vanilla baseline', () => {
  const baseline = fs.readFileSync(
    getFixturePath('android', 'MainApplication.sdk55.kt'),
    'utf8'
  );

  it('injects CustomerIOSDKInitializer import + onCreate call', () => {
    expect(injectCustomerIOInitializerIntoMainApplication(baseline))
      .toMatchInlineSnapshot(`
      "package io.customer.expo.fixture

      import android.app.Application
      import android.content.res.Configuration

      import com.facebook.react.PackageList
      import com.facebook.react.ReactApplication
      import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
      import com.facebook.react.ReactPackage
      import com.facebook.react.ReactHost
      import com.facebook.react.common.ReleaseLevel
      import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

      import expo.modules.ApplicationLifecycleDispatcher
      import expo.modules.ExpoReactHostFactory

      import io.customer.sdk.expo.CustomerIOSDKInitializer

      class MainApplication : Application(), ReactApplication {

        override val reactHost: ReactHost by lazy {
          ExpoReactHostFactory.getDefaultReactHost(
            context = applicationContext,
            packageList =
              PackageList(this).packages.apply {
                // Packages that cannot be autolinked yet can be added manually here, for example:
                // add(MyReactNativePackage())
              }
          )
        }

        override fun onCreate() {
          super.onCreate()
          DefaultNewArchitectureEntryPoint.releaseLevel = try {
            ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
          } catch (e: IllegalArgumentException) {
            ReleaseLevel.STABLE
          }
          loadReactNative(this)
          ApplicationLifecycleDispatcher.onApplicationCreate(this)
        
          // Auto Initialize Native Customer.io SDK
          CustomerIOSDKInitializer.initialize(this)
        }

        override fun onConfigurationChanged(newConfig: Configuration) {
          super.onConfigurationChanged(newConfig)
          ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
        }
      }
      "
    `);
  });
});
