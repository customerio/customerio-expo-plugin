Pod::Spec.new do |s|
  s.name           = 'CioLifecycleProbe'
  s.version        = '0.0.1'
  s.summary        = 'Test-only lifecycle probe for the Customer.io Expo plugin (MBL-2232)'
  s.description    = 'Emits machine-readable lifecycle traces from a generated Expo test app. Never shipped; installed into gitignored fixture apps only.'
  s.license        = 'MIT'
  s.author         = 'CustomerIO Team'
  s.homepage       = 'https://github.com/customerio/customerio-expo-plugin'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: 'https://github.com/customerio/customerio-expo-plugin.git' }
  s.static_framework = true

  # The Expo dependency is only for the context/control bridge. Lifecycle
  # records are produced by the Foundation-only support compiled in this pod.
  # The module declares no AppDelegate subscriber and no NotificationDelegate.
  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.user_target_xcconfig = {
    'OTHER_LDFLAGS' => '$(inherited) -ObjC'
  }
end
