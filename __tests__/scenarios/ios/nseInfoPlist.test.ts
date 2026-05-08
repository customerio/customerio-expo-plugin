import { applyBundleVersionToNsePlist } from '../../../plugin/src/ios/withNotificationsXcodeProject';

const baseline = [
  '<string>{{BUNDLE_SHORT_VERSION}}</string>',
  '<string>{{BUNDLE_VERSION}}</string>',
  '',
].join('\n');

describe('ios scenarios — applyBundleVersionToNsePlist', () => {
  it('substitutes both placeholders when both versions are provided', () => {
    expect(
      applyBundleVersionToNsePlist(baseline, {
        bundleShortVersion: '1.2.3',
        bundleVersion: '42',
      })
    ).toMatchInlineSnapshot(`
      "<string>1.2.3</string>
      <string>42</string>
      "
    `);
  });

  it('substitutes only BUNDLE_VERSION when bundleShortVersion is omitted', () => {
    expect(applyBundleVersionToNsePlist(baseline, { bundleVersion: '42' }))
      .toMatchInlineSnapshot(`
      "<string>{{BUNDLE_SHORT_VERSION}}</string>
      <string>42</string>
      "
    `);
  });

  it('substitutes only BUNDLE_SHORT_VERSION when bundleVersion is omitted', () => {
    expect(
      applyBundleVersionToNsePlist(baseline, { bundleShortVersion: '1.2.3' })
    ).toMatchInlineSnapshot(`
      "<string>1.2.3</string>
      <string>{{BUNDLE_VERSION}}</string>
      "
    `);
  });

  it('returns input unchanged when neither version is provided', () => {
    expect(applyBundleVersionToNsePlist(baseline, {})).toEqual(baseline);
  });

  it('is idempotent', () => {
    const once = applyBundleVersionToNsePlist(baseline, {
      bundleShortVersion: '1.2.3',
      bundleVersion: '42',
    });
    const twice = applyBundleVersionToNsePlist(once, {
      bundleShortVersion: '1.2.3',
      bundleVersion: '42',
    });
    expect(twice).toEqual(once);
  });
});
