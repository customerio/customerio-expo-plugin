import type { PropertiesItem } from '@expo/config-plugins/build/android/Properties';
import { modifyGradleProperties } from '../../../plugin/src/android/withLocationGradleProperties';

describe('android scenarios — modifyGradleProperties (location)', () => {
  it('appends customerio_location_enabled=true when the property is missing', () => {
    expect(modifyGradleProperties([])).toMatchInlineSnapshot(`
      [
        {
          "key": "customerio_location_enabled",
          "type": "property",
          "value": "true",
        },
      ]
    `);
  });

  it('updates the existing customerio_location_enabled value to "true" when already present', () => {
    const items: PropertiesItem[] = [
      { type: 'property', key: 'customerio_location_enabled', value: 'false' },
    ];
    expect(modifyGradleProperties(items)).toMatchInlineSnapshot(`
      [
        {
          "key": "customerio_location_enabled",
          "type": "property",
          "value": "true",
        },
      ]
    `);
  });

  it('is idempotent', () => {
    const once = modifyGradleProperties([]);
    const twice = modifyGradleProperties(
      JSON.parse(JSON.stringify(once)) as PropertiesItem[]
    );
    expect(twice).toEqual(once);
  });
});
