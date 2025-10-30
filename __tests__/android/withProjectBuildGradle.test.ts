import { withProjectBuildGradle as withExpoProjectBuildGradle } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import { withProjectBuildGradle } from '../../plugin/src/android/withProjectBuildGradle';

jest.mock('@expo/config-plugins');
jest.mock('../../plugin/src/ios/utils', () => ({
  isExpoVersion53OrLower: jest.fn()
}));

const mockWithExpoProjectBuildGradle = withExpoProjectBuildGradle as jest.MockedFunction<
  typeof withExpoProjectBuildGradle
>;

const { isExpoVersion53OrLower } = require('../../plugin/src/ios/utils');

describe('Android Project Build Gradle Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withProjectBuildGradle', () => {
    it('should add androidx dependency resolution strategy for Expo SDK 53', () => {
      isExpoVersion53OrLower.mockReturnValue(true);

      const mockConfig = {
        modResults: {
          contents: `
buildscript {
  repositories {
    google()
    mavenCentral()
  }
  dependencies {
    classpath('com.android.tools.build:gradle')
  }
}

allprojects {
  repositories {
    google()
    mavenCentral()
  }
}
`.trim()
        }
      };

      mockWithExpoProjectBuildGradle.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withProjectBuildGradle({ sdkVersion: '53.0.0' } as ExpoConfig);

      expect(mockConfig.modResults.contents).toContain('androidx.core:core-ktx:1.13.1');
      expect(mockConfig.modResults.contents).toContain('androidx.lifecycle:lifecycle-process:2.8.7');
      expect(mockConfig.modResults.contents).toContain('resolutionStrategy');
      expect(mockConfig.modResults.contents).toContain('configurations.all');
    });

    it('should not add duplicate resolution strategy if already present', () => {
      isExpoVersion53OrLower.mockReturnValue(true);

      const mockConfig = {
        modResults: {
          contents: `
allprojects {
    configurations.all {
        resolutionStrategy {
            force 'androidx.core:core-ktx:1.13.1'
            force 'androidx.lifecycle:lifecycle-process:2.8.7'
        }
    }
  repositories {
    google()
    mavenCentral()
  }
}
`.trim()
        }
      };

      mockWithExpoProjectBuildGradle.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      const originalContents = mockConfig.modResults.contents;
      withProjectBuildGradle({ sdkVersion: '53.0.0' } as ExpoConfig);

      // Contents should remain unchanged
      expect(mockConfig.modResults.contents).toBe(originalContents);
    });

    it('should inject resolution strategy inside allprojects block', () => {
      isExpoVersion53OrLower.mockReturnValue(true);

      const mockConfig = {
        modResults: {
          contents: `
allprojects {
  repositories {
    google()
  }
}
`.trim()
        }
      };

      mockWithExpoProjectBuildGradle.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withProjectBuildGradle({ sdkVersion: '53.0.0' } as ExpoConfig);

      // Verify the resolution strategy is injected right after allprojects {
      expect(mockConfig.modResults.contents).toMatch(/allprojects\s*\{[\s\S]*configurations\.all/);
      expect(mockConfig.modResults.contents).toMatch(
        /configurations\.all[\s\S]*resolutionStrategy/
      );
    });

    it('should skip fix for Expo SDK 54+', () => {
      isExpoVersion53OrLower.mockReturnValue(false);

      const mockConfig = {
        modResults: {
          contents: `
allprojects {
  repositories {
    google()
  }
}
`.trim()
        }
      };

      mockWithExpoProjectBuildGradle.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      const originalContents = mockConfig.modResults.contents;
      withProjectBuildGradle({ sdkVersion: '54.0.0' } as ExpoConfig);

      // Contents should remain unchanged for SDK 54+
      expect(mockConfig.modResults.contents).toBe(originalContents);
      expect(mockConfig.modResults.contents).not.toContain('androidx.core:core-ktx:1.13.1');
    });

    it('should respect explicit disableAndroid16Support=true', () => {
      isExpoVersion53OrLower.mockReturnValue(false); // SDK 54+

      const mockConfig = {
        modResults: {
          contents: `
allprojects {
  repositories {
    google()
  }
}
`.trim()
        }
      };

      mockWithExpoProjectBuildGradle.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withProjectBuildGradle({ sdkVersion: '54.0.0' } as ExpoConfig, {
        androidPath: '',
        disableAndroid16Support: true
      });

      // Should disable Android 16 support even for SDK 54 if explicitly requested
      expect(mockConfig.modResults.contents).toContain('androidx.core:core-ktx:1.13.1');
    });

    it('should respect explicit disableAndroid16Support=false', () => {
      isExpoVersion53OrLower.mockReturnValue(true); // SDK 53

      const mockConfig = {
        modResults: {
          contents: `
allprojects {
  repositories {
    google()
  }
}
`.trim()
        }
      };

      mockWithExpoProjectBuildGradle.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      const originalContents = mockConfig.modResults.contents;
      withProjectBuildGradle({ sdkVersion: '53.0.0' } as ExpoConfig, {
        androidPath: '',
        disableAndroid16Support: false
      });

      // Should enable Android 16 support even for SDK 53 if explicitly requested
      expect(mockConfig.modResults.contents).toBe(originalContents);
      expect(mockConfig.modResults.contents).not.toContain('androidx.core:core-ktx:1.13.1');
    });
  });
});
