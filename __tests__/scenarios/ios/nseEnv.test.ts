import { applyRichPushConfigToEnv } from '../../../plugin/src/ios/withNotificationsXcodeProject';

const baseline = [
  'static var customerIOCdpApiKey: String = "{{CDP_API_KEY}}"',
  'static var customerIORegion: Region = {{REGION}}',
  '',
].join('\n');

describe('ios scenarios — applyRichPushConfigToEnv', () => {
  it('substitutes cdpApiKey and Region.US when region is "us"', () => {
    expect(
      applyRichPushConfigToEnv(baseline, { cdpApiKey: 'key-123', region: 'us' })
    ).toMatchInlineSnapshot(`
      "static var customerIOCdpApiKey: String = "key-123"
      static var customerIORegion: Region = Region.US
      "
    `);
  });

  it('substitutes cdpApiKey and Region.EU when region is "eu"', () => {
    expect(
      applyRichPushConfigToEnv(baseline, { cdpApiKey: 'key-123', region: 'eu' })
    ).toMatchInlineSnapshot(`
      "static var customerIOCdpApiKey: String = "key-123"
      static var customerIORegion: Region = Region.EU
      "
    `);
  });

  it('accepts case-insensitive region keys (US, Us, etc.)', () => {
    expect(
      applyRichPushConfigToEnv(baseline, { cdpApiKey: 'key-123', region: 'US' })
    ).toEqual(
      applyRichPushConfigToEnv(baseline, { cdpApiKey: 'key-123', region: 'us' })
    );
  });

  it('falls back to Region.US and warns when region is invalid', () => {
    expect(
      applyRichPushConfigToEnv(baseline, {
        cdpApiKey: 'key-123',
        region: 'asia',
      })
    ).toMatchInlineSnapshot(`
      "static var customerIOCdpApiKey: String = "key-123"
      static var customerIORegion: Region = Region.US
      "
    `);
  });

  it('falls back to Region.US when region is undefined', () => {
    expect(applyRichPushConfigToEnv(baseline, { cdpApiKey: 'key-123' }))
      .toMatchInlineSnapshot(`
      "static var customerIOCdpApiKey: String = "key-123"
      static var customerIORegion: Region = Region.US
      "
    `);
  });

  it('substitutes "MISSING_API_KEY" when cdpApiKey is empty', () => {
    expect(applyRichPushConfigToEnv(baseline, { cdpApiKey: '', region: 'us' }))
      .toMatchInlineSnapshot(`
      "static var customerIOCdpApiKey: String = "MISSING_API_KEY"
      static var customerIORegion: Region = Region.US
      "
    `);
  });

  it('falls back on every placeholder when no rich-push config is provided', () => {
    expect(applyRichPushConfigToEnv(baseline, undefined))
      .toMatchInlineSnapshot(`
      "static var customerIOCdpApiKey: String = "MISSING_API_KEY"
      static var customerIORegion: Region = Region.US
      "
    `);
  });

  it('sets the extension log level, and leaves an unknown or missing one unset', () => {
    const template = 'static var customerIOLogLevel: CioLogLevel? = {{LOG_LEVEL}}\n';
    expect(
      applyRichPushConfigToEnv(template, { cdpApiKey: 'key-123', logLevel: 'debug' })
    ).toBe('static var customerIOLogLevel: CioLogLevel? = CioLogLevel.debug\n');
    // `.none` would read as Optional.none, so the level is always written in full.
    expect(
      applyRichPushConfigToEnv(template, { cdpApiKey: 'key-123', logLevel: 'none' })
    ).toBe('static var customerIOLogLevel: CioLogLevel? = CioLogLevel.none\n');
    expect(
      applyRichPushConfigToEnv(template, { cdpApiKey: 'key-123', logLevel: 'verbose' })
    ).toBe('static var customerIOLogLevel: CioLogLevel? = nil\n');
    expect(applyRichPushConfigToEnv(template, { cdpApiKey: 'key-123' })).toBe(
      'static var customerIOLogLevel: CioLogLevel? = nil\n'
    );
  });

  it('is idempotent', () => {
    const cfg = { cdpApiKey: 'key-123', region: 'us' as const };
    const once = applyRichPushConfigToEnv(baseline, cfg);
    const twice = applyRichPushConfigToEnv(once, cfg);
    expect(twice).toEqual(once);
  });
});
