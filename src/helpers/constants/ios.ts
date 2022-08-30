export const IOS_DEPLOYMENT_TARGET = '13.0';
export const CIO_PODFILE_REGEX = /pod 'RCT-Folly'/;
export const GROUP_IDENTIFIER_TEMPLATE_REGEX = /{{GROUP_IDENTIFIER}}/gm;
export const BUNDLE_SHORT_VERSION_TEMPLATE_REGEX = /{{BUNDLE_SHORT_VERSION}}/gm;
export const BUNDLE_VERSION_TEMPLATE_REGEX = /{{BUNDLE_VERSION}}/gm;
export const DEFAULT_BUNDLE_VERSION = '1';
export const DEFAULT_BUNDLE_SHORT_VERSION = '1.0';
export const CIO_TARGET_NAME = 'CustomerIOSDK';
export const CIO_NOTIFICATION_TARGET_NAME = 'CIONotificationService';
export const CIO_PODFILE_SNIPPET = `
target '${CIO_TARGET_NAME}' do
  pod 'RCT-Folly', :podspec => '../node_modules/react-native/third-party-podspecs/RCT-Folly.podspec'
  pod 'boost', :podspec => '../node_modules/react-native/third-party-podspecs/boost.podspec'
  pod 'CustomerIO/MessagingPushAPN', '~> 1.2.0-alpha.3'
end
target '${CIO_NOTIFICATION_TARGET_NAME}' do
  pod 'CustomerIO/MessagingPushAPN', '~> 1.2.0-alpha.3'
end
`;
