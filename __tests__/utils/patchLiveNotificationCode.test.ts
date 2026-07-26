import { PLATFORM } from '../../plugin/src/helpers/constants/common';
import {
  ALL_LIVE_NOTIFICATION_TYPES,
  generateWidgetBundleSwift,
  isRemoteLogo,
  patchLiveNotificationPlaceholders,
  resolveLiveNotificationTypes,
  validateLiveNotificationBranding,
} from '../../plugin/src/helpers/utils/patchLiveNotificationCode';
import { isLiveNotificationsEnabled } from '../../plugin/src/helpers/utils/liveNotificationsEnabled';
import { LIVE_NOTIFICATION_TYPES } from '../../plugin/src/types/cio-types';

const SEGMENTS = LIVE_NOTIFICATION_TYPES.segments;
const COUNTDOWN = LIVE_NOTIFICATION_TYPES.countdownTimer;

const IOS_TEMPLATE = `import CioDataPipelines
{{LIVE_NOTIFICATION_MODULE_IMPORT}}

class CustomerIOSDKInitializer {
    static func initialize() {
        let builder = SDKConfigBuilder(cdpApiKey: "key")

        {{LIVE_NOTIFICATION_MODULE_INIT}}
        CustomerIO.initialize(withConfig: builder.build())
    }
}
`;

const ANDROID_TEMPLATE = `package io.customer.sdk.expo

import io.customer.messagingpush.ModuleMessagingPushFCM
{{LIVE_NOTIFICATION_MODULE_IMPORT}}

object CustomerIOSDKInitializer {
    fun initialize(application: Application) {
        addCustomerIOModule(
            ModuleMessagingPushFCM(
                MessagingPushModuleConfig.Builder()
                    {{LIVE_NOTIFICATION_MODULE_INIT}}
                    .build()
            )
        )
    }
}
`;

describe('Live Notifications config', () => {
  describe('resolveLiveNotificationTypes()', () => {
    test('returns every built-in type when none are listed', () => {
      expect(resolveLiveNotificationTypes(undefined)).toEqual(
        ALL_LIVE_NOTIFICATION_TYPES
      );
    });

    test('keeps only the recognized identifiers, in order', () => {
      expect(resolveLiveNotificationTypes([COUNTDOWN, SEGMENTS])).toEqual([
        COUNTDOWN,
        SEGMENTS,
      ]);
    });

    test('de-duplicates repeated identifiers', () => {
      expect(resolveLiveNotificationTypes([SEGMENTS, SEGMENTS])).toEqual([
        SEGMENTS,
      ]);
    });

    // A template shipped by a newer native SDK must not turn into a Swift/Kotlin symbol that
    // doesn't exist in this plugin build — that would be a compile error, not a soft failure.
    test('ignores an unknown identifier with a warning and keeps the known ones', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(resolveLiveNotificationTypes(['io.example.unknown', SEGMENTS])).toEqual([
        SEGMENTS,
      ]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('io.example.unknown')
      );

      warn.mockRestore();
    });

    test('an entirely unknown list resolves to nothing', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveLiveNotificationTypes(['io.example.unknown'])).toEqual([]);
      warn.mockRestore();
    });

    test('an explicitly empty list resolves to nothing', () => {
      expect(resolveLiveNotificationTypes([])).toEqual([]);
    });
  });

  describe('isLiveNotificationsEnabled()', () => {
    const cdpApiKey = 'key';

    test('auto initialization: config presence is enough, no enabled flag', () => {
      expect(
        isLiveNotificationsEnabled(undefined, {
          cdpApiKey,
          liveNotifications: { types: [SEGMENTS] },
        })
      ).toBe(true);
    });

    test('auto initialization: branding-only config still enables every built-in', () => {
      expect(
        isLiveNotificationsEnabled(undefined, {
          cdpApiKey,
          liveNotifications: { branding: { accentColorHex: '#00A0DF' } },
        })
      ).toBe(true);
    });

    test('JavaScript initialization: enabled flag with no SDK config', () => {
      expect(isLiveNotificationsEnabled({ enabled: true }, undefined)).toBe(true);
    });

    test('off when neither is set', () => {
      expect(isLiveNotificationsEnabled(undefined, { cdpApiKey })).toBe(false);
      expect(isLiveNotificationsEnabled({}, { cdpApiKey })).toBe(false);
    });

    test('off when every configured type is unrecognized', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(
        isLiveNotificationsEnabled(undefined, {
          cdpApiKey,
          liveNotifications: { types: ['io.example.unknown'] },
        })
      ).toBe(false);
      warn.mockRestore();
    });
  });

  describe('isRemoteLogo()', () => {
    test.each([
      ['https://cdn.example.com/logo.png', true],
      ['http://example.com/logo.png', true],
      ['./assets/brand-logo.png', false],
      ['assets/brand-logo.png', false],
    ])('%s -> %s', (logo, expected) => {
      expect(isRemoteLogo(logo)).toBe(expected);
    });
  });

  describe('validateLiveNotificationBranding()', () => {
    test('accepts valid hex colors', () => {
      expect(() =>
        validateLiveNotificationBranding({
          backgroundColorHex: '#101010',
          textColorHex: '#FFFFFF',
          accentColorHex: '#00a0df',
        })
      ).not.toThrow();
    });

    // Caught at prebuild so it can't become a Color.parseColor that throws on device.
    test.each(['00A0DF', '#FFF', '#GGGGGG', 'blue'])(
      'rejects %s at prebuild',
      (color) => {
        expect(() =>
          validateLiveNotificationBranding({ accentColorHex: color })
        ).toThrow(/accentColorHex/);
      }
    );
  });

  describe('patchLiveNotificationPlaceholders() - iOS', () => {
    test('registers each enabled type behind the 16.2 availability guard', () => {
      const result = patchLiveNotificationPlaceholders(
        IOS_TEMPLATE,
        PLATFORM.IOS,
        { types: [SEGMENTS, COUNTDOWN] }
      );

      expect(result).toContain('import CioLiveActivities');
      expect(result).toContain('if #available(iOS 16.2, *)');
      expect(result).toContain('builder.addModule(LiveActivitiesModule(config:');
      expect(result).toContain('.register(CIOSegmentsAttributes.self)');
      expect(result).toContain('.register(CIOCountdownTimerAttributes.self)');
      // Registration must precede initialize, or push-to-start never registers a token.
      expect(result.indexOf('addModule')).toBeLessThan(
        result.indexOf('CustomerIO.initialize')
      );
    });

    test('registers only the listed type', () => {
      const result = patchLiveNotificationPlaceholders(
        IOS_TEMPLATE,
        PLATFORM.IOS,
        { types: [COUNTDOWN] }
      );

      expect(result).toContain('.register(CIOCountdownTimerAttributes.self)');
      expect(result).not.toContain('CIOSegmentsAttributes');
    });

    test('leaves no placeholders behind when unconfigured', () => {
      const result = patchLiveNotificationPlaceholders(
        IOS_TEMPLATE,
        PLATFORM.IOS,
        undefined
      );

      expect(result).not.toContain('{{LIVE_NOTIFICATION');
      expect(result).not.toContain('LiveActivitiesModule');
    });
  });

  describe('patchLiveNotificationPlaceholders() - Android', () => {
    test('enables each type on the push module config builder', () => {
      const result = patchLiveNotificationPlaceholders(
        ANDROID_TEMPLATE,
        PLATFORM.ANDROID,
        { types: [SEGMENTS, COUNTDOWN] }
      );

      expect(result).toContain(
        'import io.customer.messagingpush.livenotification.LiveNotificationType'
      );
      expect(result).toContain('.enableLiveNotificationTypes(');
      expect(result).toContain('LiveNotificationType.SEGMENTS,');
      expect(result).toContain('LiveNotificationType.COUNTDOWN_TIMER,');
      expect(result).toContain('.build()');
    });

    test('applies branding with a bundled drawable resolved at runtime', () => {
      const result = patchLiveNotificationPlaceholders(
        ANDROID_TEMPLATE,
        PLATFORM.ANDROID,
        {
          types: [SEGMENTS],
          branding: {
            companyName: 'Acme',
            logo: './assets/brand-logo.png',
            accentColorHex: '#00A0DF',
          },
        }
      );

      expect(result).toContain('.setLiveNotificationBranding(');
      expect(result).toContain('companyName = "Acme"');
      expect(result).toContain('Color.parseColor("#00A0DF")');
      expect(result).toContain('getIdentifier("cio_live_notification_logo"');
      expect(result).toContain('LiveNotificationAsset::Drawable');
    });

    test('a remote logo becomes a RemoteUrl asset', () => {
      const result = patchLiveNotificationPlaceholders(
        ANDROID_TEMPLATE,
        PLATFORM.ANDROID,
        {
          types: [SEGMENTS],
          branding: { logo: 'https://cdn.example.com/logo.png' },
        }
      );

      expect(result).toContain(
        'LiveNotificationAsset.RemoteUrl("https://cdn.example.com/logo.png")'
      );
      expect(result).not.toContain('getIdentifier(');
    });

    test('omits branding entirely when none is configured', () => {
      const result = patchLiveNotificationPlaceholders(
        ANDROID_TEMPLATE,
        PLATFORM.ANDROID,
        { types: [SEGMENTS] }
      );

      expect(result).not.toContain('setLiveNotificationBranding');
      expect(result).not.toContain('LiveNotificationBranding');
    });

    // Apps that don't use the feature must get exactly the output they got before it existed.
    test('collapses the builder chain back to one line when unconfigured', () => {
      const result = patchLiveNotificationPlaceholders(
        ANDROID_TEMPLATE,
        PLATFORM.ANDROID,
        undefined
      );

      expect(result).not.toContain('{{LIVE_NOTIFICATION');
      expect(result).toContain('MessagingPushModuleConfig.Builder().build()');
    });
  });

  describe('generateWidgetBundleSwift()', () => {
    test('renders one widget per enabled type', () => {
      const swift = generateWidgetBundleSwift([SEGMENTS, COUNTDOWN], undefined);

      expect(swift).toContain('struct CIOLiveActivityWidgetBundle: WidgetBundle');
      expect(swift).toContain('CIOSegmentsLiveActivity()');
      expect(swift).toContain('CIOCountdownTimerLiveActivity()');
      // No branding configured, so no color helper is emitted.
      expect(swift).not.toContain('init(hex:');
    });

    test('compiles branding into each widget', () => {
      const swift = generateWidgetBundleSwift([SEGMENTS, COUNTDOWN], {
        logo: './assets/brand-logo.png',
        backgroundColorHex: '#101010',
        textColorHex: '#FFFFFF',
        accentColorHex: '#00A0DF',
      });

      expect(swift).toContain('logo: Image("cio_live_notification_logo")');
      expect(swift).toContain('background: Color(hex: 0x101010)');
      expect(swift).toContain('textColor: Color(hex: 0xFFFFFF)');
      // Only Segments has a progress bar to tint.
      expect(swift).toContain('progressCompleteStyle: Color(hex: 0x00A0DF)');
      expect(
        swift.match(/progressCompleteStyle/g)
      ).toHaveLength(1);
      expect(swift).toContain('init(hex: UInt32)');
    });

    test('omits the logo for a remote URL, which a compiled widget cannot resolve', () => {
      const swift = generateWidgetBundleSwift([SEGMENTS], {
        logo: 'https://cdn.example.com/logo.png',
        accentColorHex: '#00A0DF',
      });

      expect(swift).not.toContain('Image(');
      expect(swift).toContain('progressCompleteStyle: Color(hex: 0x00A0DF)');
    });
  });
});
