export const IOS_DEPLOYMENT_TARGET = '13.0';
export const CIO_PODFILE_REGEX = /pod 'RCT-Folly'/;
export const CIO_PODFILE_NOTIFICATION_REGEX =
  /target 'CIONotificationService' do/;
export const GROUP_IDENTIFIER_TEMPLATE_REGEX = /{{GROUP_IDENTIFIER}}/gm;
export const BUNDLE_SHORT_VERSION_TEMPLATE_REGEX = /{{BUNDLE_SHORT_VERSION}}/gm;
export const BUNDLE_VERSION_TEMPLATE_REGEX = /{{BUNDLE_VERSION}}/gm;
export const CIO_PODFILE_POST_INSTALL_REGEX = /post_install do \|installer\|/;
export const DEFAULT_BUNDLE_VERSION = '1';
export const DEFAULT_BUNDLE_SHORT_VERSION = '1.0';
export const CIO_TARGET_NAME = 'CustomerIOSDK';
export const CIO_NOTIFICATION_TARGET_NAME = 'CIONotificationService';
export const CIO_PODFILE_NOTIFICATION_SNIPPET = `
target '${CIO_NOTIFICATION_TARGET_NAME}' do
  pod 'CustomerIO/MessagingPushAPN', '~> 1.2.0-alpha.3'
end`;
export const CIO_PODFILE_SNIPPET = `
  pod 'RCT-Folly', :podspec => '../node_modules/react-native/third-party-podspecs/RCT-Folly.podspec'
  pod 'boost', :podspec => '../node_modules/react-native/third-party-podspecs/boost.podspec'
  pod 'CustomerIO/MessagingPushAPN', '~> 1.2.0-alpha.3'`;
export const CIO_PODFILE_TARGET_NAMES_SNIPPET = `
  cio_target_names = [
    'CustomerIOTracking',
    'CustomerIOCommon',
    'CustomerIOMessagingPushAPN',
    'CustomerIOMessagingPush'
  ]`;
export const CIO_PODFILE_POST_INSTALL_SNIPPET = `
    installer.pods_project.targets.each do |target|
      if cio_target_names.include? target.name
        puts "Modifying target #{target.name}"

        target.build_configurations.each do |config|
          puts "Setting build config settings for #{target.name}"
          config.build_settings['APPLICATION_EXTENSION_API_ONLY'] ||= 'NO'
        end
      end
    end`;
export const CIO_PODFILE_POST_INSTALL_FALLBACK_SNIPPET = `
cio_target_names = [
  'CustomerIOTracking',
  'CustomerIOCommon',
  'CustomerIOMessagingPushAPN',
  'CustomerIOMessagingPush'
]

post_install do |installer|

  installer.pods_project.targets.each do |target|
    if cio_target_names.include? target.name
      puts "Modifying target #{target.name}"

      target.build_configurations.each do |config|
        puts "Setting build config settings for #{target.name}"
        config.build_settings['APPLICATION_EXTENSION_API_ONLY'] ||= 'NO'
      end
    end
  end
  react_native_post_install(installer)
  __apply_Xcode_12_5_M1_post_install_workaround(installer)
end`;
