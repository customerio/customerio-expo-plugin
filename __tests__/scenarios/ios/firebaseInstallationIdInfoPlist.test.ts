import { applyFirebaseInstallationIdInfoPlist } from '../../../plugin/src/ios/withFirebaseInstallationIdInfoPlist';

describe('ios scenarios — applyFirebaseInstallationIdInfoPlist', () => {
  it('adds the key when enabled', () => {
    expect(applyFirebaseInstallationIdInfoPlist({ CFBundleName: 'App' }, true))
      .toMatchInlineSnapshot(`
      {
        "CFBundleName": "App",
        "FirebaseMessagingInstallationIdEnabled": true,
      }
    `);
  });

  it('overwrites an existing false value when enabled', () => {
    expect(
      applyFirebaseInstallationIdInfoPlist(
        { FirebaseMessagingInstallationIdEnabled: false },
        true
      )
    ).toMatchInlineSnapshot(`
      {
        "FirebaseMessagingInstallationIdEnabled": true,
      }
    `);
  });

  it('removes the key and keeps the rest when disabled', () => {
    expect(
      applyFirebaseInstallationIdInfoPlist(
        { CFBundleName: 'App', FirebaseMessagingInstallationIdEnabled: true },
        false
      )
    ).toMatchInlineSnapshot(`
      {
        "CFBundleName": "App",
      }
    `);
  });

  it('is idempotent', () => {
    const once = applyFirebaseInstallationIdInfoPlist({}, true);
    expect(applyFirebaseInstallationIdInfoPlist({ ...once }, true)).toEqual(
      once
    );
  });
});
