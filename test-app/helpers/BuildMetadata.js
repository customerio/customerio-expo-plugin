import Constants from 'expo-constants';

const expoConfig = Constants.expoConfig;
const extras = expoConfig?.extra || {};

const BuildMetadata = {
  sdkVersion: getSdkVersion('customerio-reactnative'),
  pluginVersion: getSdkVersion('customerio-expo-plugin'),
  appVersion: resolveValidOrElse(expoConfig?.version),
  buildDate: formatBuildDateWithRelativeTime(extras.buildTimestamp),
  gitMetadata: `${resolveValidOrElse(
    extras.branchName,
    () => 'development build'
  )}-${resolveValidOrElse(extras.commitHash, () => 'untracked')}`,
  defaultWorkspace: resolveValidOrElse(extras.workspaceName),
  language: 'JavaScript',
  uiFramework: 'Expo (React Native)',
  sdkIntegration: 'npm',

  toString() {
    const cdpApiKey = resolveValidOrElse(extras.cdpApiKey, () => 'Failed to load!');
    const siteId = resolveValidOrElse(extras.siteId, () => 'Failed to load!');

    return `
      CDP API Key: ${cdpApiKey}
      Site ID: ${siteId}
      Plugin Version: ${this.pluginVersion}
      RN SDK Version: ${this.sdkVersion}
      App Version: ${this.appVersion}
      Build Date: ${this.buildDate}
      Branch: ${this.gitMetadata}
      Default Workspace: ${this.defaultWorkspace}
      Language: ${this.language}
      UI Framework: ${this.uiFramework}
      SDK Integration: ${this.sdkIntegration}
    `;
  },
};

function resolveValidOrElse(value, fallback = () => 'unknown') {
  return value && value.trim() && !value.startsWith("@") ? value : fallback();
}

function formatBuildDateWithRelativeTime(timestamp) {
  if (!timestamp) return 'unavailable';
  const parsedTimestamp = parseInt(timestamp, 10);
  if (isNaN(parsedTimestamp)) return 'invalid timestamp';

  const buildDate = new Date(parsedTimestamp * 1000);
  const now = new Date();
  const daysAgo = Math.floor((now - buildDate) / (1000 * 60 * 60 * 24));

  return `${buildDate.toLocaleString()} ${
    daysAgo === 0 ? '(Today)' : `(${daysAgo} days ago)`
  }`;
}

function getSdkVersion(sdkPackageName) {
  try {
    const sdkPackage = getSdkMetadataFromPackageLock(sdkPackageName);

    if (!sdkPackage) {
      console.warn(`${sdkPackageName} not found in package-lock.json`);
      return undefined;
    }

    const version = resolveValidOrElse(sdkPackage.version);
    const isPathDependency =
      sdkPackage.resolved && sdkPackage.resolved.startsWith('file:');
    if (isPathDependency) {
      return `${version}-${resolveValidOrElse(
        extras.commitsAheadCount,
        () => 'as-source'
      )}`;
    }

    return version;
  } catch (error) {
    console.warn(
      `Failed to read ${sdkPackageName} sdk version: ${error.message}`
    );
    return undefined;
  }
}

function getSdkMetadataFromPackageLock(packageName) {
  const packageLockPath = '../package-lock.json';
  try {
    const packageLock = require(packageLockPath);
    const packages = packageLock.packages || {};
    const resolvedPackageName = `node_modules/${packageName}`;
    const sdkPackage = packages[resolvedPackageName];
    if (sdkPackage) {
      return sdkPackage;
    }
  } catch (error) {
    console.warn(`Failed to read ${packageLockPath}: ${error.message}`);
  }
  return undefined;
}

export { BuildMetadata };
