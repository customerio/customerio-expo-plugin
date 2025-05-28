import type { ConfigPlugin } from '@expo/config-plugins';
import { withStringsXml } from '@expo/config-plugins';
import { getPluginVersion } from '../helpers/utils/pluginUtils';

/**
 * Adds or updates string resources in Android's strings.xml required by the plugin
 */
export const withProjectStrings: ConfigPlugin = (config) => {
  return withStringsXml(config, (config) => {
    const stringsXml = config.modResults;
    const pluginVersion = getPluginVersion();

    // Updating meta-data in AndroidManifest.xml fails on Manifest merging, so we're updating
    // the strings here instead
    // These strings are added to the strings.xml file by Customer.io's React Native SDK
    // We're updating them here to include the Expo client source and version so user agent
    // can be generated correctly for Expo apps
    addStringsToXml(stringsXml, [
      { name: 'customer_io_react_native_sdk_client_source', value: 'Expo' },
      { name: 'customer_io_react_native_sdk_client_version', value: pluginVersion },
    ]);

    return config;
  });
};

/**
 * Adds or updates multiple string resources in Android's strings.xml
 * @param stringsXml - Parsed strings.xml object
 * @param stringResources - Array of string resources to add or update
 * @returns Updated strings.xml object
 */
export function addStringsToXml(
  stringsXml: any,
  stringResources: { name: string, value: string }[]
) {
  // Ensure the resource exists
  if (!stringsXml.resources) {
    stringsXml.resources = { string: [] };
  }

  stringResources.forEach(({ name, value }) => {
    const existingStringIndex = stringsXml.resources.string.findIndex(
      (item: { $: { name: string } }) => item.$?.name === name
    );

    if (existingStringIndex !== -1) {
      // Update the existing string
      stringsXml.resources.string[existingStringIndex]._ = value;
    } else {
      // Add a new string resource
      stringsXml.resources.string.push({
        $: { name },
        _: value,
      });
    }
  });
}
