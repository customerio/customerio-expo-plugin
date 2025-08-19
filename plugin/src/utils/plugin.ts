import fs from 'fs';
import path from 'path';

const findPluginPackageRoot = (): string => {
  const finder = require('find-package-json');
  const f = finder(__dirname);
  const root = f.next().filename;
  return path.dirname(root);
};

const pluginPackageRoot = findPluginPackageRoot();

// Returns path to plugin's native template files directory
export const getNativeFilesPath = (): string => {
  return path.join(
    pluginPackageRoot,
    'plugin/src/helpers/native-files/'
  );
};

// Returns path to plugin's Android native template files
export const getAndroidNativeFilesPath = (): string => {
  return path.join(getNativeFilesPath(), 'android');
};

// Returns path to plugin's iOS native template files
export const getIosNativeFilesPath = (): string => {
  return path.join(getNativeFilesPath(), 'ios');
};

// Reads the version of the plugin from its `package.json` and returns it as a string.
export const getPluginVersion = (): string => {
  const packageJsonPath = path.resolve(
    pluginPackageRoot,
    'package.json'
  );
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (!packageJson.version) {
    throw new Error(`"version" field is missing in ${packageJsonPath}`);
  }
  return packageJson.version;
};
