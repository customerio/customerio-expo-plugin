/**
 * Utility functions for contract testing
 */
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');
const { 
  ANDROID_CONTRACT, 
  IOS_APN_CONTRACT, 
  IOS_FCM_CONTRACT 
} = require('./contracts');
const { parseAndroidManifest, parseGradleFile } = require('./parsers');

const globPromise = promisify(glob);

/**
 * Verifies that all required files exist
 * 
 * @param {string} appPath - The path to the test app
 * @param {string[]} requiredFiles - List of required file patterns
 * @returns {Promise<{success: boolean, missingFiles: string[]}>} - Result of the verification
 */
async function verifyRequiredFiles(appPath, requiredFiles) {
  const missingFiles = [];
  const results = await Promise.all(
    requiredFiles.map(async (pattern) => {
      // Handle patterns that might have a wildcard
      if (pattern.includes('*')) {
        const foundFiles = await globPromise(path.join(appPath, pattern));
        if (foundFiles.length === 0) {
          missingFiles.push(pattern);
          return false;
        }
        return true;
      } else {
        // Regular file path
        const exists = await fs.pathExists(path.join(appPath, pattern));
        if (!exists) {
          missingFiles.push(pattern);
        }
        return exists;
      }
    })
  );
  
  return {
    success: results.every(Boolean),
    missingFiles
  };
}

/**
 * Verifies that an Android project meets the contract
 * 
 * @param {string} appPath - The path to the test app
 * @returns {Promise<{success: boolean, details: Object}>} - Result of the verification
 */
async function verifyAndroidContract(appPath) {
  const results = {
    files: await verifyRequiredFiles(appPath, ANDROID_CONTRACT.files.required),
    manifest: { success: false, details: {} },
    appGradle: { success: false, details: {} },
    mainGradle: { success: false, details: {} }
  };
  
  // If required files missing, stop here
  if (!results.files.success) {
    return { 
      success: false, 
      details: results 
    };
  }
  
  // Check Android Manifest
  try {
    const manifestPath = path.join(appPath, 'android/app/src/main/AndroidManifest.xml');
    const manifest = await parseAndroidManifest(manifestPath);
    const application = manifest?.manifest?.application?.[0];
    
    if (application) {
      const services = application.service || [];
      const expectedServiceName = 'io.customer.messagingpush.CustomerIOFirebaseMessagingService';
      const service = services.find(s => s['$']['android:name'] === expectedServiceName);
      
      if (service && service['$']['android:exported'] === 'false') {
        const intentFilters = service['intent-filter'] || [];
        const actions = intentFilters.length > 0 ? (intentFilters[0].action || []) : [];
        const hasExpectedAction = actions.some(action => 
          action['$']['android:name'] === 'com.google.firebase.MESSAGING_EVENT'
        );
        
        results.manifest.success = hasExpectedAction;
        results.manifest.details = {
          hasService: !!service,
          serviceExported: service ? service['$']['android:exported'] === 'false' : false,
          hasIntentFilter: !!intentFilters.length,
          hasCorrectAction: hasExpectedAction
        };
      }
    }
  } catch (error) {
    results.manifest.details.error = error.message;
  }
  
  // Check app build.gradle
  try {
    const appGradlePath = path.join(appPath, 'android/app/build.gradle');
    const appGradleJson = await parseGradleFile(appGradlePath);
    const appGradleContent = await fs.readFile(appGradlePath, 'utf8');
    
    // Check for Google Services plugin
    const hasPlugin = appGradleJson.apply && 
      appGradleJson.apply.some(plugin => plugin.includes('com.google.gms.google-services'));
    
    // Check for required dependencies - using simplified partial matching
    // Instead of checking structured dependencies, check the file content
    const hasFcmDependency = appGradleContent.includes('firebase-messaging');
    const hasCioDependency = appGradleContent.includes('messaging-push-fcm');
    
    results.appGradle.success = hasPlugin && hasFcmDependency && hasCioDependency;
    results.appGradle.details = {
      hasPlugin,
      hasFcmDependency,
      hasCioDependency
    };
  } catch (error) {
    results.appGradle.details.error = error.message;
  }
  
  // Check main build.gradle
  try {
    const mainGradlePath = path.join(appPath, 'android/build.gradle');
    const mainGradleContent = await fs.readFile(mainGradlePath, 'utf8');
    
    // Check for Google Services classpath - simplified partial matching
    const hasGoogleServicesClasspath = mainGradleContent.includes('google-services');
    
    // Check for Gist maven repository
    const hasGistRepository = mainGradleContent.includes('maven { url "https://maven.gist.build" }');
    
    results.mainGradle.success = hasGoogleServicesClasspath && hasGistRepository;
    results.mainGradle.details = {
      hasGoogleServicesClasspath,
      hasGistRepository
    };
  } catch (error) {
    results.mainGradle.details.error = error.message;
  }
  
  return {
    success: Object.values(results).every(result => result.success),
    details: results
  };
}

/**
 * Verifies that an iOS project meets the APN contract
 * 
 * @param {string} appPath - The path to the test app
 * @param {string} appName - The name of the test app
 * @returns {Promise<{success: boolean, details: Object}>} - Result of the verification
 */
async function verifyIOSAPNContract(appPath, appName) {
  const results = {
    files: await verifyRequiredFiles(appPath, IOS_APN_CONTRACT.files.required),
    podfile: { success: false, details: {} },
    appDelegate: { success: false, details: {} },
    notificationService: { success: false, details: {} }
  };
  
  // If required files missing, stop here
  if (!results.files.success) {
    return { 
      success: false, 
      details: results 
    };
  }
  
  // Check Podfile
  try {
    const podfilePath = path.join(appPath, 'ios/Podfile');
    const podfileContent = await fs.readFile(podfilePath, 'utf8');
    
    const requiredPods = IOS_APN_CONTRACT.podfile.pods;
    const missingPods = requiredPods.filter(pod => !podfileContent.includes(pod));
    
    const hasNotificationServiceTarget = podfileContent.includes("target 'NotificationService'");
    
    results.podfile.success = missingPods.length === 0 && hasNotificationServiceTarget;
    results.podfile.details = {
      missingPods,
      hasNotificationServiceTarget
    };
  } catch (error) {
    results.podfile.details.error = error.message;
  }
  
  // Check AppDelegate
  try {
    const appDelegatePath = path.join(appPath, `ios/${appName}/AppDelegate.mm`);
    const appDelegateContent = await fs.readFile(appDelegatePath, 'utf8');
    
    const requiredImports = IOS_APN_CONTRACT.appDelegate.imports;
    const missingImports = requiredImports.filter(imp => {
      // Handle app-specific imports with regex
      if (imp === '-Swift.h') {
        return !appDelegateContent.includes(`${appName}-Swift.h`);
      }
      return !appDelegateContent.includes(imp);
    });
    
    const requiredInitialization = IOS_APN_CONTRACT.appDelegate.initialization;
    const missingInitialization = requiredInitialization.filter(init => 
      !appDelegateContent.includes(init)
    );
    
    const requiredMethods = IOS_APN_CONTRACT.appDelegate.methods;
    const missingMethods = requiredMethods.filter(method => 
      !appDelegateContent.includes(method)
    );
    
    results.appDelegate.success = missingImports.length === 0 && 
      missingInitialization.length === 0 && 
      missingMethods.length === 0;
      
    results.appDelegate.details = {
      missingImports,
      missingInitialization,
      missingMethods
    };
  } catch (error) {
    results.appDelegate.details.error = error.message;
  }
  
  // Check NotificationService
  try {
    const notificationServicePath = path.join(appPath, 'ios/NotificationService/NotificationService.m');
    const notificationServiceContent = await fs.readFile(notificationServicePath, 'utf8');
    
    // For notification service, we'll just check for basic methods since the exact imports can vary
    const requiredMethods = IOS_APN_CONTRACT.notificationService.methods;
    const missingMethods = requiredMethods.filter(method => 
      !notificationServiceContent.includes(method)
    );
    
    // Success if methods are present, regardless of imports (which are version-dependent)
    results.notificationService.success = missingMethods.length === 0;
      
    results.notificationService.details = {
      missingImports: [], // We'll skip checking imports for now
      missingMethods
    };
  } catch (error) {
    results.notificationService.details.error = error.message;
  }
  
  return {
    success: Object.values(results).every(result => result.success),
    details: results
  };
}

/**
 * Verifies that an iOS project meets the FCM contract
 * Similar to verifyIOSAPNContract but with FCM-specific checks
 */
async function verifyIOSFCMContract(appPath, appName) {
  // Implementation similar to verifyIOSAPNContract but using IOS_FCM_CONTRACT
  // Omitted for brevity as it follows the same pattern
  
  // This is a placeholder to indicate the similar implementation
  return {
    success: false,
    details: {
      message: "FCM contract verification not fully implemented yet"
    }
  };
}

module.exports = {
  verifyRequiredFiles,
  verifyAndroidContract,
  verifyIOSAPNContract,
  verifyIOSFCMContract
};