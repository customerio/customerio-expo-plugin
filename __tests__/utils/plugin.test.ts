import fs from 'fs';
import path from 'path';
import { getPluginVersion } from '../../plugin/src/utils/plugin';

describe('Plugin version retrieval from package.json', () => {
  it('should return the actual version from package.json', () => {
    // Read the actual package.json to compare
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const expectedVersion = packageJson.version;

    const actualVersion = getPluginVersion();

    expect(actualVersion).toBe(expectedVersion);
    expect(typeof actualVersion).toBe('string');
    expect(actualVersion).toMatch(/^\d+\.\d+\.\d+/); // Basic semver pattern
  });
});
