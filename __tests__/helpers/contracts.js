/**
 * Contract testing definitions for the Customer.io Expo plugin
 */

/**
 * Android Contract: Defines what files and content should be present
 * when the plugin is correctly applied to an Android project
 */
const ANDROID_CONTRACT = {
  files: {
    required: [
      'android/app/src/main/AndroidManifest.xml',
      'android/app/build.gradle',
      'android/build.gradle',
      'android/app/google-services.json'
    ]
  },
  
  manifest: {
    services: {
      'io.customer.messagingpush.CustomerIOFirebaseMessagingService': {
        exported: false,
        intentFilters: ['com.google.firebase.MESSAGING_EVENT']
      }
    }
  },
  
  appGradle: {
    plugins: ['com.google.gms.google-services'],
    // Note: In the test app the plugin might add these dependencies differently than
    // how we're checking for them here. Update this as needed.
    dependencies: {
      implementation: [
        'firebase-messaging',  // Simplified version that will match partial strings
        'messaging-push-fcm' 
      ]
    }
  },
  
  mainGradle: {
    buildscript: {
      dependencies: {
        classpath: ['google-services']  // Simplified version that will match partial strings
      }
    },
    repositories: {
      maven: ['https://maven.gist.build']
    }
  }
};

/**
 * iOS Contract for APN: Defines what files and content should be present
 * when the plugin is correctly applied to an iOS project with APN
 */
const IOS_APN_CONTRACT = {
  files: {
    required: [
      'ios/Podfile',
      'ios/NotificationService/NotificationService.m',
      'ios/NotificationService/NotificationService.swift',
      'ios/*/PushService.swift',
      'ios/*/AppDelegate.mm'
    ]
  },
  
  podfile: {
    pods: [
      // Use simplified matching that will match across Expo versions
      "customerio-reactnative/apn",
      "customerio-reactnative-richpush/apn"
    ],
    targets: ['NotificationService']
  },
  
  appDelegate: {
    imports: [
      'ExpoModulesCore-Swift.h',
      '-Swift.h' // App-specific import that will be checked with regex
    ],
    initialization: [
      'CIOAppPushNotificationsHandler* pnHandlerObj',
      '[pnHandlerObj initializeCioSdk]'
    ],
    methods: [
      'didRegisterForRemoteNotificationsWithDeviceToken',
      'didFailToRegisterForRemoteNotificationsWithError',
      'didReceiveRemoteNotification'
    ]
  },
  
  notificationService: {
    imports: [
      'CustomerIOMessagingPushAPN/NotificationServiceExtension.h'
    ],
    methods: [
      'didReceiveNotificationRequest',
      'serviceExtensionTimeWillExpire'
    ]
  }
};

/**
 * iOS Contract for FCM: Defines what files and content should be present
 * when the plugin is correctly applied to an iOS project with FCM
 */
const IOS_FCM_CONTRACT = {
  files: {
    required: [
      'ios/Podfile',
      'ios/NotificationService/NotificationService.m',
      'ios/NotificationService/NotificationService.swift',
      'ios/*/PushService.swift',
      'ios/*/AppDelegate.mm',
      'ios/GoogleService-Info.plist'
    ]
  },
  
  podfile: {
    pods: [
      "pod 'CustomerIO'",
      "pod 'CustomerIOMessagingPush'",
      "pod 'Firebase/Messaging'",
      "pod 'customerio-reactnative/fcm'",
      "pod 'customerio-reactnative-richpush/fcm'"
    ],
    targets: ['NotificationService']
  },
  
  appDelegate: {
    imports: [
      'ExpoModulesCore-Swift.h',
      '-Swift.h',
      'Firebase.h'
    ],
    initialization: [
      'CIOAppPushNotificationsHandler* pnHandlerObj',
      '[pnHandlerObj initializeCioSdk]',
      '[FIRApp configure]'
    ],
    methods: [
      'didRegisterForRemoteNotificationsWithDeviceToken',
      'didFailToRegisterForRemoteNotificationsWithError',
      'didReceiveRemoteNotification'
    ]
  },
  
  notificationService: {
    imports: [
      'CustomerIOMessagingPushFCM/NotificationServiceExtension.h'
    ],
    methods: [
      'didReceiveNotificationRequest',
      'serviceExtensionTimeWillExpire'
    ]
  }
};

module.exports = {
  ANDROID_CONTRACT,
  IOS_APN_CONTRACT,
  IOS_FCM_CONTRACT
};