import { PLATFORM } from '../../plugin/src/helpers/constants/common';
import { patchGeofencePlaceholders } from '../../plugin/src/helpers/utils/patchGeofenceCode';

const IOS_TEMPLATE = `import CioMessagingInApp
{{GEOFENCE_MODULE_IMPORT}}

class Init {
    static func initialize() {
        let builder = SDKConfigBuilder(cdpApiKey: "x")
        {{GEOFENCE_MODULE_INIT}}
        CustomerIO.initialize(withConfig: builder.build())
    }
}
`;

const ANDROID_TEMPLATE = `import io.customer.reactnative.sdk.messaginginapp.ReactInAppEventListener
{{GEOFENCE_MODULE_IMPORT}}
import io.customer.sdk.CustomerIOBuilder

object Init {
    fun initialize() {
        addCustomerIOModule(x)
        {{GEOFENCE_MODULE_INIT}}

        build()
    }
}
`;

describe('patchGeofencePlaceholders', () => {
  describe('iOS', () => {
    it('strips placeholders when geofence is disabled', () => {
      const out = patchGeofencePlaceholders(IOS_TEMPLATE, PLATFORM.IOS, { enabled: false });
      expect(out).not.toContain('{{GEOFENCE_MODULE_IMPORT}}');
      expect(out).not.toContain('{{GEOFENCE_MODULE_INIT}}');
      expect(out).not.toContain('CioLocationGeofence');
      expect(out).not.toContain('GeofenceModule');
      // The geofence init line is removed without leaving a stray blank line.
      expect(out).toContain('"x")\n        CustomerIO.initialize');
    });

    it('strips placeholders when options are omitted', () => {
      const out = patchGeofencePlaceholders(IOS_TEMPLATE, PLATFORM.IOS);
      expect(out).not.toContain('{{GEOFENCE');
      expect(out).not.toContain('GeofenceModule');
    });

    it('omits locationMode when unset (defers to SDK default), background delivery on', () => {
      const out = patchGeofencePlaceholders(IOS_TEMPLATE, PLATFORM.IOS, { enabled: true });
      expect(out).toContain('import CioLocationGeofence');
      expect(out).toContain('GeofenceModule(config: GeofenceModuleConfig())');
      expect(out).not.toContain('locationMode:');
      expect(out).toContain('builder.allowBackgroundDelivery(true)');
    });

    it('honors MANUAL locationMode and explicit allowBackgroundDelivery=false', () => {
      const out = patchGeofencePlaceholders(IOS_TEMPLATE, PLATFORM.IOS, {
        enabled: true,
        locationMode: 'MANUAL',
        allowBackgroundDelivery: false,
      });
      expect(out).toContain('GeofenceModuleConfig(locationMode: .manual)');
      expect(out).toContain('builder.allowBackgroundDelivery(false)');
    });

    it('omits locationMode for an unknown value (defers to SDK default)', () => {
      const out = patchGeofencePlaceholders(IOS_TEMPLATE, PLATFORM.IOS, {
        enabled: true,
        locationMode: 'bogus' as never,
      });
      expect(out).toContain('GeofenceModuleConfig()');
      expect(out).not.toContain('locationMode:');
    });
  });

  describe('Android', () => {
    it('strips placeholders when geofence is disabled', () => {
      const out = patchGeofencePlaceholders(ANDROID_TEMPLATE, PLATFORM.ANDROID, { enabled: false });
      expect(out).not.toContain('{{GEOFENCE_MODULE_IMPORT}}');
      expect(out).not.toContain('{{GEOFENCE_MODULE_INIT}}');
      expect(out).not.toContain('io.customer.geofence');
      // Blank line before build() is preserved.
      expect(out).toContain('addCustomerIOModule(x)\n\n        build()');
    });

    it('injects ModuleGeofence guarded by CIO_GEOFENCE_ENABLED when enabled', () => {
      const out = patchGeofencePlaceholders(ANDROID_TEMPLATE, PLATFORM.ANDROID, {
        enabled: true,
        locationMode: 'MANUAL',
      });
      expect(out).toContain('import io.customer.geofence.ModuleGeofence');
      expect(out).toContain('io.customer.reactnative.sdk.BuildConfig.CIO_GEOFENCE_ENABLED');
      expect(out).toContain('GeofenceLocationMode.MANUAL');
    });

    it('omits setLocationMode and its import when locationMode is unset', () => {
      const out = patchGeofencePlaceholders(ANDROID_TEMPLATE, PLATFORM.ANDROID, { enabled: true });
      expect(out).toContain('GeofenceModuleConfig.Builder().build()');
      expect(out).not.toContain('setLocationMode');
      expect(out).not.toContain('import io.customer.geofence.GeofenceLocationMode');
    });
  });
});
