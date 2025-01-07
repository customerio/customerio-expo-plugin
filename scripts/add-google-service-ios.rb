require 'xcodeproj'

project_path = 'test-app/ios/ExpoTestbed.xcodeproj'
google_service_plist_path = 'GoogleService-Info.plist'
target_name = 'ExpoTestbed'

# Open the Xcode project
project = Xcodeproj::Project.open(project_path)

# Find the main app target
target = project.targets.find { |t| t.name == target_name }
if target.nil?
  abort("Target '#{target_name}' not found in the project!")
end

# Add the GoogleService-Info.plist file to the project
file_ref = project.new_file(google_service_plist_path)

resources_build_phase = target.resources_build_phase
unless resources_build_phase.files_references.include?(file_ref)
  resources_build_phase.add_file_reference(file_ref)
  puts "Added #{google_service_plist_path} to the #{target_name} target."
end

# Save the changes to the Xcode project
project.save
puts "Successfully updated the Xcode project."