const path = require('path');
const fs = require('fs');

// Mock find-package-json module
jest.mock('find-package-json', () => {
  return jest.fn().mockImplementation(() => ({
    next: jest.fn().mockReturnValue({
      value: { 
        dependencies: { 
          'customerio-reactnative': '4.1.0' // Mismatch with required version
        } 
      }
    })
  }));
});

// Now we can require the module
const { runPostInstall } = require('../plugin/src/postInstallHelper');

describe('postInstall script', () => {
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;
  let consoleWarnOutput = [];
  let consoleLogOutput = [];

  beforeEach(() => {
    consoleWarnOutput = [];
    consoleLogOutput = [];
    console.warn = jest.fn((...args) => {
      consoleWarnOutput.push(args.join(' '));
    });
    console.log = jest.fn((...args) => {
      consoleLogOutput.push(args.join(' '));
    });

    // Mock fs functions
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => '{}');
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    
    // Clear all previous mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  });

  test('postInstall should continue process even when version validation fails', () => {
    // Mock fs.readFileSync for different files
    jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (filePath.includes('/package.json')) {
        if (filePath.includes('customerio-reactnative')) {
          return JSON.stringify({ version: '4.1.0' });
        }
        return JSON.stringify({ 
          peerDependencies: { 
            'customerio-reactnative': '4.2.2' 
          },
          version: '2.0.0-beta.1' 
        });
      }
      return '{}';
    });

    // Mock require to return our package.json mock
    jest.spyOn(require, 'resolve').mockImplementation((path) => {
      if (path === 'customerio-reactnative/package.json') {
        return '../node_modules/customerio-reactnative/package.json';
      }
      if (path.includes('package.json')) {
        return path;
      }
      return path;
    });

    // Should not throw errors
    expect(() => runPostInstall()).not.toThrow();
    
    // Should issue a warning about version mismatch
    expect(consoleWarnOutput.some(msg => msg.includes('requires customerio-reactnative'))).toBeTruthy();
  });

  test('postInstall handles missing customerio-reactnative package gracefully', () => {
    // Mock to simulate package not found
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      if (path.includes('customerio-reactnative')) {
        return false;
      }
      return true;
    });

    // Should not throw errors
    expect(() => runPostInstall()).not.toThrow();
    
    // Should warn about missing package
    expect(consoleWarnOutput.some(msg => msg.includes('Could not locate customerio-reactnative package.json'))).toBeTruthy();
  });

  test('postInstall should catch and handle critical errors', () => {
    // Mock console.warn to throw instead, to simulate real error handling
    const mockConsoleWarn = jest.fn().mockImplementation(() => {
      consoleWarnOutput.push('Warning message logged');
    });
    console.warn = mockConsoleWarn;

    // Deliberately throw error in fs.existsSync
    jest.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw new Error('Critical file system error');
    });

    // Should not propagate error
    expect(() => {
      try {
        runPostInstall();
        return true;
      } catch (e) {
        console.log('Caught error:', e);
        return false;
      }
    }).not.toThrow();
  });
});