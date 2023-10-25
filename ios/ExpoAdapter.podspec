require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoAdapter'
  s.version        = package['version']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.platform       = :ios, '13.0'
  s.swift_version  = '5.4'

  s.dependency 'ExpoModulesCore'
  s.dependency 'React-Core'
  s.dependency 'customerio-reactnative'

  ## Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  if !$ExpoUseSources&.include?(package['name']) && ENV['EXPO_USE_SOURCE'].to_i == 0 && File.exist?("#{s.name}.xcframework") && Gem::Version.new(Pod::VERSION) >= Gem::Version.new('1.10.0')
    s.source_files = "#{s.name}/**/*.h"
    s.vendored_frameworks = "#{s.name}.xcframework"
  else
    s.source_files = "#{s.name}/**/*.{h,m,swift}"
  end
end
