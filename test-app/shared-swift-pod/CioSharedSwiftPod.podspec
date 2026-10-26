# Regression guard for MBL-2650. Do not add `swift_versions` to this podspec.
#
# CocoaPods derives the Swift version of a Swift pod that has no `swift_versions` from the targets
# that integrate it, and fails `pod install` when they disagree. app.config.js adds this pod to
# both the app and the NotificationService target, so the plugin's NSE Swift version has to match
# the app's or `expo prebuild` fails here.
Pod::Spec.new do |s|
  s.name = 'CioSharedSwiftPod'
  s.version = '0.0.1'
  s.summary = 'Swift pod without swift_versions, shared by the app and the NSE.'
  s.homepage = 'https://github.com/customerio/customerio-expo-plugin'
  s.license = { :type => 'MIT' }
  s.author = 'Customer.io'
  s.source = { :path => '.' }
  s.ios.deployment_target = '15.1'
  s.source_files = 'Sources/*.swift'
end
