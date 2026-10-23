import {
  applyApiHostToNotificationService,
  applyAppGroupIdToNotificationService,
} from '../../../plugin/src/ios/withNotificationsXcodeProject';

const baseline = [
  'MessagingPushAPN.initializeForExtension(',
  '  withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)',
  '    .region(Env.customerIORegion)',
  '{{API_HOST_BUILDER_LINE}}{{APP_GROUP_ID_BUILDER_LINE}}    .build()',
  ')',
  '',
].join('\n');

describe('ios scenarios — applyApiHostToNotificationService', () => {
  it('inserts the apiHost builder line when an apiHost is provided', () => {
    expect(
      applyAppGroupIdToNotificationService(
        applyApiHostToNotificationService(baseline, 'proxy.example.com/v1'),
        undefined
      )
    ).toMatchInlineSnapshot(`
      "MessagingPushAPN.initializeForExtension(
        withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)
          .region(Env.customerIORegion)
              .apiHost("proxy.example.com/v1")
          .build()
      )
      "
    `);
  });

  it('removes the placeholder (substitutes empty string) when no apiHost is provided', () => {
    expect(
      applyAppGroupIdToNotificationService(
        applyApiHostToNotificationService(baseline, undefined),
        undefined
      )
    ).toMatchInlineSnapshot(`
      "MessagingPushAPN.initializeForExtension(
        withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)
          .region(Env.customerIORegion)
          .build()
      )
      "
    `);
  });

  it('treats an empty apiHost as not provided', () => {
    expect(applyApiHostToNotificationService(baseline, '')).toEqual(
      applyApiHostToNotificationService(baseline, undefined)
    );
  });

  it('keeps both builder lines when apiHost and appGroupId are provided', () => {
    expect(
      applyAppGroupIdToNotificationService(
        applyApiHostToNotificationService(baseline, 'https://proxy.example.com/v1'),
        'group.io.customer.app'
      )
    ).toMatchInlineSnapshot(`
      "MessagingPushAPN.initializeForExtension(
        withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)
          .region(Env.customerIORegion)
              .apiHost("https://proxy.example.com/v1")
              .appGroupId("group.io.customer.app")
          .build()
      )
      "
    `);
  });

  it('escapes the apiHost as a Swift string literal', () => {
    expect(applyApiHostToNotificationService(baseline, 'proxy.example.com/"v1"')).toContain(
      '.apiHost("proxy.example.com/\\"v1\\"")'
    );
  });

  it('is idempotent when applied twice with the same apiHost', () => {
    const once = applyApiHostToNotificationService(baseline, 'proxy.example.com/v1');
    const twice = applyApiHostToNotificationService(once, 'proxy.example.com/v1');
    expect(twice).toEqual(once);
  });
});


describe('NSE apiHost literal generation', () => {
  it.each(['$&', "$'", '$`', '$$', '\\(secret)', '"quoted"'])('preserves %s literally', (suffix) => {
    const host = `proxy.example.com/${suffix}`;
    const swift = applyApiHostToNotificationService(baseline, host);
    const escaped = host.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    expect(swift).toContain(`.apiHost("${escaped}")`);
    expect(swift).not.toContain('{{API_HOST_BUILDER_LINE}}');
  });

  it('trims surrounding whitespace before generating the host', () => {
    expect(applyApiHostToNotificationService(baseline, '  proxy.example.com/v1  '))
      .toContain('.apiHost("proxy.example.com/v1")');
  });

  it.each(['   ', 123, null])('rejects invalid host %p in strict mode', (host) => {
    const previous = process.env.CUSTOMERIO_STRICT_MODE;
    process.env.CUSTOMERIO_STRICT_MODE = 'true';
    try {
      expect(() => applyApiHostToNotificationService(baseline, host as string)).toThrow('apiHost must be a non-empty string');
    } finally {
      if (previous === undefined) delete process.env.CUSTOMERIO_STRICT_MODE;
      else process.env.CUSTOMERIO_STRICT_MODE = previous;
    }
  });
});
