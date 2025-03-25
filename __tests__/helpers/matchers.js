/**
 * Custom Jest matchers for Customer.io plugin tests
 */

expect.extend({
  /**
   * Checks if Android manifest has CIO Firebase service properly configured
   */
  toHaveCIOFirebaseService(manifest) {
    const application = manifest?.manifest?.application?.[0];
    if (!application) {
      return {
        message: () => 'Expected manifest to have an application tag',
        pass: false,
      };
    }

    const services = application.service || [];
    const expectedServiceName = 'io.customer.messagingpush.CustomerIOFirebaseMessagingService';
    const service = services.find(s => s['$']['android:name'] === expectedServiceName);
    
    if (!service) {
      return {
        message: () => `Expected manifest to have service ${expectedServiceName}`,
        pass: false,
      };
    }

    if (service['$']['android:exported'] !== 'false') {
      return {
        message: () => `Expected service to have android:exported="false"`,
        pass: false,
      };
    }

    if (!service['intent-filter'] || !service['intent-filter'].length) {
      return {
        message: () => 'Expected service to have an intent-filter',
        pass: false,
      };
    }

    const actions = service['intent-filter'][0].action || [];
    const expectedAction = 'com.google.firebase.MESSAGING_EVENT';
    const hasExpectedAction = actions.some(action => action['$']['android:name'] === expectedAction);
    
    if (!hasExpectedAction) {
      return {
        message: () => `Expected intent-filter to have action ${expectedAction}`,
        pass: false,
      };
    }

    return {
      message: () => 'Expected manifest not to have CIO Firebase service configured correctly',
      pass: true,
    };
  },

  /**
   * Checks if Gradle file has Google Services plugin applied
   */
  toHaveGoogleServicesPlugin(gradleJson) {
    const hasPlugin = gradleJson.apply && 
      gradleJson.apply.some(plugin => plugin.includes('com.google.gms.google-services'));
    
    return {
      message: () => 
        hasPlugin
          ? 'Expected Gradle file not to have Google Services plugin'
          : 'Expected Gradle file to have Google Services plugin',
      pass: hasPlugin,
    };
  },
  
  /**
   * Checks if Podfile has CIO pod dependencies
   */
  toHaveCIOPodDependencies(podfileContent) {
    const requiredPods = [
      'customerio-reactnative'
    ];
    
    const missingPods = requiredPods.filter(pod => !podfileContent.includes(pod));
    
    return {
      message: () => 
        missingPods.length === 0
          ? 'Expected Podfile not to have CIO pod dependencies'
          : `Expected Podfile to have these pod dependencies: ${missingPods.join(', ')}`,
      pass: missingPods.length === 0,
    };
  },
  
  /**
   * Checks if AppDelegate has CIO initialization
   */
  toHaveCIOInitialization(appDelegateContent) {
    const requiredSnippets = [
      'CIOAppPushNotificationsHandler* pnHandlerObj',
      '[pnHandlerObj initializeCioSdk]'
    ];
    
    const missingSnippets = requiredSnippets.filter(snippet => 
      !appDelegateContent.includes(snippet)
    );
    
    return {
      message: () => 
        missingSnippets.length === 0
          ? 'Expected AppDelegate not to have CIO initialization'
          : `Expected AppDelegate to have these snippets: ${missingSnippets.join(', ')}`,
      pass: missingSnippets.length === 0,
    };
  }
});

// Setup function to initialize all matchers
function setupMatchers() {
  // This is where we'd register any additional setup if needed
}

module.exports = {
  setupMatchers,
};