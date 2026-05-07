import { applyAppGroupIdToNotificationService } from '../../../plugin/src/ios/withNotificationsXcodeProject';

const baseline = [
  'MessagingPushAPN.initializeForExtension(',
  '  withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)',
  '    .region(Env.customerIORegion)',
  '{{APP_GROUP_ID_BUILDER_LINE}}    .build()',
  ')',
  '',
].join('\n');

describe('ios scenarios — applyAppGroupIdToNotificationService', () => {
  it('inserts the appGroupId builder line when an appGroupId is provided', () => {
    expect(
      applyAppGroupIdToNotificationService(baseline, 'group.io.customer.app')
    ).toMatchInlineSnapshot(`
      "MessagingPushAPN.initializeForExtension(
        withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)
          .region(Env.customerIORegion)
              .appGroupId("group.io.customer.app")
          .build()
      )
      "
    `);
  });

  it('removes the placeholder (substitutes empty string) when no appGroupId is provided', () => {
    expect(applyAppGroupIdToNotificationService(baseline, undefined))
      .toMatchInlineSnapshot(`
      "MessagingPushAPN.initializeForExtension(
        withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)
          .region(Env.customerIORegion)
          .build()
      )
      "
    `);
  });

  it('is idempotent when applied twice with the same appGroupId', () => {
    const once = applyAppGroupIdToNotificationService(
      baseline,
      'group.io.customer.app'
    );
    const twice = applyAppGroupIdToNotificationService(
      once,
      'group.io.customer.app'
    );
    expect(twice).toEqual(once);
  });
});
