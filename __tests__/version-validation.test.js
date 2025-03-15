// Simple test to verify that validateDependencies and postInstall 
// are handling version validation failures gracefully

describe('Version validation in plugin', () => {
  test('validateDependencies in index.ts should not throw errors', () => {
    // Directly load the validateDependencies function
    const { validateDependencies } = require('../plugin/src/index');
    
    // The main requirement is simply that calling this function never throws
    expect(() => validateDependencies()).not.toThrow();
  });
  
  test('withCustomerIOPlugin continues even if validateDependencies fails', () => {
    // Spy on console.warn to see that it was called
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Load the plugin function
    const withCustomerIOPlugin = require('../plugin/src/index').default;
    
    // Mock the necessary objects 
    const mockConfig = {};
    const mockProps = {
      ios: { siteId: '123' },
      android: { siteId: '123' }
    };
    
    // Mock the dependent functions
    jest.mock('../plugin/src/ios/withCIOIos', () => jest.fn((config) => config));
    jest.mock('../plugin/src/android/withCIOAndroid', () => jest.fn((config) => config));
    
    // Should not throw errors, even if validation fails
    expect(() => withCustomerIOPlugin(mockConfig, mockProps)).not.toThrow();
    
    // Clean up
    consoleWarnSpy.mockRestore();
  });
});