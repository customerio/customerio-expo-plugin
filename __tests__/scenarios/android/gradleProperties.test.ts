import type { PropertiesItem } from '@expo/config-plugins/build/android/Properties';
import { modifyGradleProperties } from '../../../plugin/src/android/withLocationGradleProperties';

// Minimal-but-viable parsed gradle.properties — Expo prebuild produces a list of
// PropertiesItems; comments are { type: 'comment', value } and properties are
// { type: 'property', key, value }. The helper writes a single property entry.
const baseline = (): PropertiesItem[] => [
  { type: 'comment', value: 'newArchEnabled=true' },
  { type: 'property', key: 'newArchEnabled', value: 'true' },
  { type: 'property', key: 'hermesEnabled', value: 'true' },
];

describe('android scenarios — modifyGradleProperties (location)', () => {
  it('appends customerio_location_enabled=true when the property is missing', () => {
    expect(modifyGradleProperties(baseline())).toMatchInlineSnapshot(`
      [
        {
          "type": "comment",
          "value": "newArchEnabled=true",
        },
        {
          "key": "newArchEnabled",
          "type": "property",
          "value": "true",
        },
        {
          "key": "hermesEnabled",
          "type": "property",
          "value": "true",
        },
        {
          "key": "customerio_location_enabled",
          "type": "property",
          "value": "true",
        },
      ]
    `);
  });

  it('updates the existing customerio_location_enabled value when already present', () => {
    const items: PropertiesItem[] = [
      ...baseline(),
      { type: 'property', key: 'customerio_location_enabled', value: 'false' },
    ];
    expect(modifyGradleProperties(items)).toMatchInlineSnapshot(`
      [
        {
          "type": "comment",
          "value": "newArchEnabled=true",
        },
        {
          "key": "newArchEnabled",
          "type": "property",
          "value": "true",
        },
        {
          "key": "hermesEnabled",
          "type": "property",
          "value": "true",
        },
        {
          "key": "customerio_location_enabled",
          "type": "property",
          "value": "true",
        },
      ]
    `);
  });

  it('is idempotent', () => {
    const once = modifyGradleProperties(baseline());
    const twice = modifyGradleProperties(
      JSON.parse(JSON.stringify(once)) as PropertiesItem[]
    );
    expect(twice).toEqual(once);
  });
});
