import fs from 'fs';
import path from 'path';

/**
 * Reads the version of the plugin from its `package.json` and returns it as a string.
 */
export const getPluginVersion = (): string => {
  // Always resolves relative to the utility file's location
  const packageJsonPath = path.resolve(
    __dirname,
    '../../../../../package.json'
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
