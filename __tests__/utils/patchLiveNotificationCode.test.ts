import { PLATFORM } from '../../plugin/src/helpers/constants/common';
import {
  ALL_LIVE_NOTIFICATION_TYPES,
  generateWidgetBundleSwift,
  isRemoteLogo,
  patchLiveNotificationPlaceholders,
  resolveCustomLiveNotificationType,
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

  describe('resolveCustomLiveNotificationType()', () => {
    test('keeps the app identifier, trimmed', () => {
      expect(resolveCustomLiveNotificationType('  com.myapp.rideshare ')).toBe(
        'com.myapp.rideshare'
      );
    });

    test.each([undefined, '', '   '])('treats %p as unconfigured', (value) => {
      expect(resolveCustomLiveNotificationType(value)).toBeUndefined();
    });

    // Registering CIOCustomAttributes under a built-in identifier would make every event for that
    // template resolve to whichever attributes type was registered first.
    test('refuses a built-in identifier with a warning', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(resolveCustomLiveNotificationType(SEGMENTS)).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(SEGMENTS));

      warn.mockRestore();
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

    test('auto initialization: a config without types still enables every built-in', () => {
      expect(
        isLiveNotificationsEnabled(undefined, {
          cdpApiKey,
          liveNotifications: {},
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

    // A custom template needs the same native artifacts as a built-in one, so either half of the
    // custom config turns the setup on — the missing half is then reported while generating.
    test('a custom type alone is enough, with no built-in types', () => {
      expect(
        isLiveNotificationsEnabled(undefined, {
          cdpApiKey,
          liveNotifications: { types: [], customType: 'com.myapp.rideshare' },
        })
      ).toBe(true);
    });

    test('a custom type alone is enough, with no built-in types', () => {
      expect(
        isLiveNotificationsEnabled(undefined, {
          cdpApiKey,
          liveNotifications: { types: [], customType: 'com.myapp.rideshare' },
        })
      ).toBe(true);
    });

    test('a custom widget alone does not enable it — it is a build-time option', () => {
      // `customWidget` says how to render, never whether the feature is on. A
      // JavaScript-initialized app pairs it with `enabled`; an auto-initialized one with
      // `config.liveNotifications.customType`.
      expect(
        isLiveNotificationsEnabled(
          {
            customWidget: {
              sourceFile: './ios-widgets/RideshareLiveActivity.swift',
              structName: 'RideshareLiveActivity',
            },
          },
          undefined
        )
      ).toBe(false);
    });

    test('off when the custom type is blank and no built-in type is listed', () => {
      expect(
        isLiveNotificationsEnabled(undefined, {
          cdpApiKey,
          liveNotifications: { types: [], customType: '   ' },
        })
      ).toBe(false);
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

    // On the auto-initialization path this generated code *is* the runtime registration, so without
    // it a custom activity would never get a push-to-start token.
    test('registers the SDK attributes type under the app custom identifier', () => {
      const result = patchLiveNotificationPlaceholders(IOS_TEMPLATE, PLATFORM.IOS, {
        types: [SEGMENTS],
        customType: 'com.myapp.rideshare',
      });

      expect(result).toContain('.register(CIOSegmentsAttributes.self)');
      expect(result).toContain(
        '.register(CIOCustomAttributes.self, identifier: "com.myapp.rideshare")'
      );
      expect(result.indexOf('addModule')).toBeLessThan(
        result.indexOf('CustomerIO.initialize')
      );
    });

    test('registers a custom type on its own, with no built-in types enabled', () => {
      const result = patchLiveNotificationPlaceholders(IOS_TEMPLATE, PLATFORM.IOS, {
        types: [],
        customType: 'com.myapp.rideshare',
      });

      expect(result).toContain('if #available(iOS 16.2, *)');
      expect(result).toContain(
        '.register(CIOCustomAttributes.self, identifier: "com.myapp.rideshare")'
      );
      expect(result).not.toContain('CIOSegmentsAttributes');
      expect(result).not.toContain('{{LIVE_NOTIFICATION');
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
        { types: [SEGMENTS] },
        {
          companyName: 'Acme',
          logo: './assets/brand-logo.png',
          accentColorHex: '#00A0DF',
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
        { types: [SEGMENTS] },
        { logo: 'https://cdn.example.com/logo.png' }
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

    test('allowlists a custom type alongside the built-in ones', () => {
      const result = patchLiveNotificationPlaceholders(
        ANDROID_TEMPLATE,
        PLATFORM.ANDROID,
        { types: [SEGMENTS], customType: 'com.myapp.rideshare' }
      );

      expect(result).toContain('.enableLiveNotificationTypes(');
      expect(result).toContain(
        '.enableCustomLiveNotificationTypes("com.myapp.rideshare")'
      );
    });

    // The enum overload is what needs the import; a custom type is passed as a plain string, so an
    // unused import would be left behind.
    test('a custom type alone omits the built-in enum call and its import', () => {
      const result = patchLiveNotificationPlaceholders(
        ANDROID_TEMPLATE,
        PLATFORM.ANDROID,
        { types: [], customType: 'com.myapp.rideshare' }
      );

      expect(result).toContain(
        '.enableCustomLiveNotificationTypes("com.myapp.rideshare")'
      );
      expect(result).not.toContain('.enableLiveNotificationTypes(');
      expect(result).not.toContain(
        'import io.customer.messagingpush.livenotification.LiveNotificationType'
      );
      // No import to add means the placeholder's whole line goes, not just its contents.
      expect(result).not.toContain('\n\n\n');
      expect(result).not.toContain('{{LIVE_NOTIFICATION');
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

    // Branding is compiled into the SDK's templates; a view the app wrote styles itself, so its
    // entry must stay a bare initializer or the widget won't compile.
    test("adds the app's widget struct with no branding argument", () => {
      const swift = generateWidgetBundleSwift(
        [SEGMENTS],
        { accentColorHex: '#00A0DF' },
        'RideshareLiveActivity'
      );

      expect(swift).toContain('CIOSegmentsLiveActivity(branding: CIOSegmentsBranding(');
      expect(swift).toContain('RideshareLiveActivity()');
      expect(swift).not.toContain('RideshareLiveActivity(branding');
    });

    test('renders a custom widget on its own, with no built-in templates', () => {
      const swift = generateWidgetBundleSwift([], undefined, 'RideshareLiveActivity');

      expect(swift).toContain('RideshareLiveActivity()');
      expect(swift).not.toContain('CIOSegmentsLiveActivity');
      expect(swift).not.toContain('CIOCountdownTimerLiveActivity');
    });

    // A WidgetBundle body has to return at least one widget, so an unrenderable config can't be
    // emitted as an empty bundle — it wouldn't compile.
    test('falls back to the built-in templates when nothing resolved', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const swift = generateWidgetBundleSwift([], undefined, undefined);

      expect(swift).toContain('CIOSegmentsLiveActivity()');
      expect(swift).toContain('CIOCountdownTimerLiveActivity()');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('falling back'));

      warn.mockRestore();
    });
  });
});
