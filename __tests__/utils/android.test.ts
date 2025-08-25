import type { ExportedConfigWithProps } from '@expo/config-plugins';
import type { ApplicationProjectFile } from '@expo/config-plugins/build/android/Paths';
import path from 'path';
import { FileManagement } from '../../plugin/src/helpers/utils/fileManagement';
import { addCodeToMethod, addImportToFile, copyTemplateFile } from '../../plugin/src/utils/android';
import { getAndroidNativeFilesPath } from '../../plugin/src/utils/plugin';

// Mock dependencies
jest.mock('../../plugin/src/utils/plugin');
jest.mock('../../plugin/src/helpers/utils/fileManagement');

const mockGetAndroidNativeFilesPath = getAndroidNativeFilesPath as jest.MockedFunction<typeof getAndroidNativeFilesPath>;
const mockFileManagement = FileManagement as jest.Mocked<typeof FileManagement>;

describe('Android Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addImportToFile', () => {
    const importStatement = 'import io.customer.sdk.expo.CustomerIOSDKInitializer';

    it('should return content unchanged if import already exists', () => {
      const content = `package com.example.app
import io.customer.sdk.expo.CustomerIOSDKInitializer
import android.app.Application

class MainApplication : Application() {
}`;

      const result = addImportToFile(content, importStatement);
      expect(result).toBe(content);
    });

    it('should add import after existing imports', () => {
      const content = `package com.example.app
import android.app.Application
import androidx.multidex.MultiDexApplication

class MainApplication : Application() {
}`;

      const result = addImportToFile(content, importStatement);
      expect(result).toContain('import androidx.multidex.MultiDexApplication\n\nimport io.customer.sdk.expo.CustomerIOSDKInitializer');
    });

    it('should add import after package when no imports exist', () => {
      const content = `package com.example.app

class MainApplication : Application() {
}`;

      const result = addImportToFile(content, importStatement);
      expect(result).toContain('package com.example.app');
      expect(result).toContain('import io.customer.sdk.expo.CustomerIOSDKInitializer');
      expect(result).toContain('class MainApplication');
    });

    it('should return content unchanged if no package declaration found', () => {
      const content = `class MainApplication : Application() {
}`;

      const result = addImportToFile(content, importStatement);
      expect(result).toBe(content);
    });
  });

  describe('addCodeToMethod', () => {
    const methodRegex = /override\s+fun\s+onCreate\s*\(\s*\)\s*\{[\s\S]*?\}/;
    const codeToAdd = 'CustomerIOSDKInitializer.initialize(this)';

    it('should add code at end of method before closing brace', () => {
      const content = `class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Existing code
    }
}`;

      const result = addCodeToMethod(content, methodRegex, codeToAdd);
      expect(result).toContain('// Existing code');
      expect(result).toContain('CustomerIOSDKInitializer.initialize(this)');
      // Should maintain proper indentation
      expect(result).toContain('        CustomerIOSDKInitializer.initialize(this)');
    });

    it('should return content unchanged if method not found', () => {
      const content = `class MainApplication : Application() {
    // No onCreate method
}`;

      const result = addCodeToMethod(content, methodRegex, codeToAdd);
      expect(result).toBe(content);
    });

    it('should handle empty method body', () => {
      const content = `class MainApplication : Application() {
    override fun onCreate() {
    }
}`;

      const result = addCodeToMethod(content, methodRegex, codeToAdd);
      expect(result).toContain('override fun onCreate() {');
      expect(result).toContain('CustomerIOSDKInitializer.initialize(this)');
      // Should use default 2-space indentation when no existing content
      expect(result).toContain('      CustomerIOSDKInitializer.initialize(this)');
    });

    it('should add code at end after ApplicationLifecycleDispatcher', () => {
      const content = `class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ApplicationLifecycleDispatcher.onApplicationCreate(this)
    }
}`;

      const result = addCodeToMethod(content, methodRegex, codeToAdd);
      expect(result).toContain('ApplicationLifecycleDispatcher.onApplicationCreate(this)');
      // CustomerIO should come after ApplicationLifecycleDispatcher
      expect(result.indexOf('CustomerIOSDKInitializer.initialize')).toBeGreaterThan(
        result.indexOf('ApplicationLifecycleDispatcher.onApplicationCreate')
      );
      // Should maintain proper indentation
      expect(result).toContain('        CustomerIOSDKInitializer.initialize(this)');
    });

    it('should detect and use tabs for indentation', () => {
      const content = `class MainApplication : Application() {
\toverride fun onCreate() {
\t\tsuper.onCreate()
\t\t// Existing code
\t}
}`;

      const result = addCodeToMethod(content, methodRegex, codeToAdd);
      expect(result).toContain('// Existing code');
      expect(result).toContain('\t\tCustomerIOSDKInitializer.initialize(this)');
    });

    it('should detect and use 4-space indentation', () => {
      const content = `class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Existing code
    }
}`;

      const result = addCodeToMethod(content, methodRegex, codeToAdd);
      expect(result).toContain('// Existing code');
      expect(result).toContain('        CustomerIOSDKInitializer.initialize(this)');
    });
  });

  describe('copyTemplateFile', () => {
    const mockConfig: ExportedConfigWithProps<ApplicationProjectFile> = {
      modRequest: {
        projectRoot: '/test/project',
        platformProjectRoot: '/test/project/android',
        modName: 'mainApplication',
        platform: 'android',
        introspect: false,
      },
      modResults: {
        path: '/test/project/android/app/src/main/java/com/test/MainApplication.kt',
        language: 'kt',
        contents: 'test content',
      },
    } as any;

    beforeEach(() => {
      mockGetAndroidNativeFilesPath.mockReturnValue('/plugin/native-files/android');
      mockFileManagement.readFile.mockReturnValue('template content');
      mockFileManagement.mkdir.mockImplementation(() => { });
      mockFileManagement.writeFile.mockImplementation(() => { });
    });

    it('should copy and transform template file to correct location', () => {
      const patchContent = jest.fn((content: string) => `patched-${content}`);

      copyTemplateFile(mockConfig, 'CustomerIOSDKInitializer.kt', 'io.customer.sdk.expo', patchContent);

      expect(mockGetAndroidNativeFilesPath).toHaveBeenCalled();
      expect(mockFileManagement.mkdir).toHaveBeenCalledWith(
        '/test/project/android/app/src/main/java/io/customer/sdk/expo',
        { recursive: true }
      );
      expect(mockFileManagement.readFile).toHaveBeenCalledWith(
        path.join('/plugin/native-files/android', 'CustomerIOSDKInitializer.kt')
      );
      expect(patchContent).toHaveBeenCalledWith('template content');
      expect(mockFileManagement.writeFile).toHaveBeenCalledWith(
        '/test/project/android/app/src/main/java/io/customer/sdk/expo/CustomerIOSDKInitializer.kt',
        'patched-template content'
      );
    });

    it('should handle nested package structure', () => {
      const patchContent = jest.fn((content: string) => content);

      copyTemplateFile(mockConfig, 'TestFile.kt', 'com.example.deep.package', patchContent);

      expect(mockFileManagement.mkdir).toHaveBeenCalledWith(
        '/test/project/android/app/src/main/java/com/example/deep/package',
        { recursive: true }
      );
      expect(mockFileManagement.writeFile).toHaveBeenCalledWith(
        '/test/project/android/app/src/main/java/com/example/deep/package/TestFile.kt',
        'template content'
      );
    });
  });
});
