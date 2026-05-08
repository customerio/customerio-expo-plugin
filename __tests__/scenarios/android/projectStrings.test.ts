import type { ResourceXML } from '@expo/config-plugins/build/android/Resources';
import { addStringsToXml } from '../../../plugin/src/android/withProjectStrings';

// Minimal-but-viable parsed strings.xml — Expo's android Resources parser produces a
// nested object shape with `resources.string` as an array of `{ $: { name }, _: value }`
// entries.
const freshStringsXml = (): ResourceXML => ({
  resources: { string: [{ $: { name: 'app_name' }, _: 'expo testbed' }] },
});

const CIO_RESOURCES = [
  { name: 'customer_io_react_native_sdk_client_source', value: 'Expo' },
  { name: 'customer_io_react_native_sdk_client_version', value: '3.3.0' },
];

describe('android scenarios — addStringsToXml (CIO source/version)', () => {
  it('appends the CIO source and version string resources to the existing array', () => {
    const xml = freshStringsXml();
    addStringsToXml(xml, CIO_RESOURCES);
    expect(xml.resources.string).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "name": "app_name",
          },
          "_": "expo testbed",
        },
        {
          "$": {
            "name": "customer_io_react_native_sdk_client_source",
          },
          "_": "Expo",
        },
        {
          "$": {
            "name": "customer_io_react_native_sdk_client_version",
          },
          "_": "3.3.0",
        },
      ]
    `);
  });

  it('updates the value when a CIO resource already exists with the same name', () => {
    const xml: ResourceXML = {
      resources: {
        string: [
          { $: { name: 'app_name' }, _: 'expo testbed' },
          {
            $: { name: 'customer_io_react_native_sdk_client_source' },
            _: 'old-value',
          },
        ],
      },
    };
    addStringsToXml(xml, CIO_RESOURCES);
    expect(xml.resources.string).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "name": "app_name",
          },
          "_": "expo testbed",
        },
        {
          "$": {
            "name": "customer_io_react_native_sdk_client_source",
          },
          "_": "Expo",
        },
        {
          "$": {
            "name": "customer_io_react_native_sdk_client_version",
          },
          "_": "3.3.0",
        },
      ]
    `);
  });

  it('is idempotent — applying twice equals applying once', () => {
    const onceXml = freshStringsXml();
    addStringsToXml(onceXml, CIO_RESOURCES);
    const twiceXml = JSON.parse(JSON.stringify(onceXml)) as ResourceXML;
    addStringsToXml(twiceXml, CIO_RESOURCES);
    expect(twiceXml).toEqual(onceXml);
  });
});
