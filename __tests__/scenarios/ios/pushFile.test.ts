import { applyConfigToPushFile } from '../../../plugin/src/ios/withNotificationsXcodeProject';
import type { CustomerIOPluginOptionsIOS } from '../../../plugin/src/types/cio-types';

const baseline = [
  '{{REGISTER_SNIPPET}}',
  'static var cdpApiKey = "{{CDP_API_KEY}}"',
  'static var region = "{{REGION}}"',
  'config',
  '  .autoTrackPushEvents({{AUTO_TRACK_PUSH_EVENTS}})',
  '  .autoFetchDeviceToken({{AUTO_FETCH_DEVICE_TOKEN}})',
  '{{APP_GROUP_ID_BUILDER_LINE}}  .showPushAppInForeground({{SHOW_PUSH_APP_IN_FOREGROUND}})',
  '',
].join('\n');

const env = (
  override?: Partial<
    NonNullable<CustomerIOPluginOptionsIOS['pushNotification']>
  >
): CustomerIOPluginOptionsIOS =>
  ({
    pushNotification: {
      provider: 'apn',
      env: { cdpApiKey: 'key-123', region: 'us' },
      ...override,
    },
  } as CustomerIOPluginOptionsIOS);

describe('ios scenarios — applyConfigToPushFile', () => {
  it('substitutes every placeholder with default props', () => {
    expect(applyConfigToPushFile(baseline, env())).toMatchInlineSnapshot(`
      "
      @objc(registerPushNotification)
        public func registerPushNotification() {

          let center  = UNUserNotificationCenter.current()
          center.requestAuthorization(options: [.sound, .alert, .badge]) { (granted, error) in
            if error == nil{
              DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
              }
            }
          }
        }
      static var cdpApiKey = "key-123"
      static var region = "US"
      config
        .autoTrackPushEvents(true)
        .autoFetchDeviceToken(true)
        .showPushAppInForeground(true)
      "
    `);
  });

  it('produces an empty REGISTER_SNIPPET when disableNotificationRegistration is true', () => {
    expect(
      applyConfigToPushFile(
        baseline,
        env({ disableNotificationRegistration: true })
      )
    ).toMatchInlineSnapshot(`
      "
      static var cdpApiKey = "key-123"
      static var region = "US"
      config
        .autoTrackPushEvents(true)
        .autoFetchDeviceToken(true)
        .showPushAppInForeground(true)
      "
    `);
  });

  it('inserts the appGroupId builder line when appGroupId is configured', () => {
    expect(
      applyConfigToPushFile(
        baseline,
        env({ appGroupId: 'group.io.customer.app' })
      )
    ).toMatchInlineSnapshot(`
      "
      @objc(registerPushNotification)
        public func registerPushNotification() {

          let center  = UNUserNotificationCenter.current()
          center.requestAuthorization(options: [.sound, .alert, .badge]) { (granted, error) in
            if error == nil{
              DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
              }
            }
          }
        }
      static var cdpApiKey = "key-123"
      static var region = "US"
      config
        .autoTrackPushEvents(true)
        .autoFetchDeviceToken(true)
              .appGroupId("group.io.customer.app")
        .showPushAppInForeground(true)
      "
    `);
  });

  it('substitutes "false" for autoTrackPushEvents when explicitly disabled', () => {
    expect(applyConfigToPushFile(baseline, env({ autoTrackPushEvents: false })))
      .toMatchInlineSnapshot(`
      "
      @objc(registerPushNotification)
        public func registerPushNotification() {

          let center  = UNUserNotificationCenter.current()
          center.requestAuthorization(options: [.sound, .alert, .badge]) { (granted, error) in
            if error == nil{
              DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
              }
            }
          }
        }
      static var cdpApiKey = "key-123"
      static var region = "US"
      config
        .autoTrackPushEvents(false)
        .autoFetchDeviceToken(true)
        .showPushAppInForeground(true)
      "
    `);
  });

  it('substitutes "false" for autoFetchDeviceToken when explicitly disabled', () => {
    expect(
      applyConfigToPushFile(baseline, env({ autoFetchDeviceToken: false }))
    ).toMatchInlineSnapshot(`
      "
      @objc(registerPushNotification)
        public func registerPushNotification() {

          let center  = UNUserNotificationCenter.current()
          center.requestAuthorization(options: [.sound, .alert, .badge]) { (granted, error) in
            if error == nil{
              DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
              }
            }
          }
        }
      static var cdpApiKey = "key-123"
      static var region = "US"
      config
        .autoTrackPushEvents(true)
        .autoFetchDeviceToken(false)
        .showPushAppInForeground(true)
      "
    `);
  });

  it('substitutes "false" for showPushAppInForeground when explicitly disabled', () => {
    expect(
      applyConfigToPushFile(baseline, env({ showPushAppInForeground: false }))
    ).toMatchInlineSnapshot(`
      "
      @objc(registerPushNotification)
        public func registerPushNotification() {

          let center  = UNUserNotificationCenter.current()
          center.requestAuthorization(options: [.sound, .alert, .badge]) { (granted, error) in
            if error == nil{
              DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
              }
            }
          }
        }
      static var cdpApiKey = "key-123"
      static var region = "US"
      config
        .autoTrackPushEvents(true)
        .autoFetchDeviceToken(true)
        .showPushAppInForeground(false)
      "
    `);
  });

  it('is idempotent', () => {
    const once = applyConfigToPushFile(baseline, env());
    const twice = applyConfigToPushFile(once, env());
    expect(twice).toEqual(once);
  });
});
