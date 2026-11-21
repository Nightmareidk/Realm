Pod::Spec.new do |s|
  s.name           = 'RealmVideoTrim'
  s.version        = '1.0.0'
  s.summary        = 'Cuts a part out of a video on the phone, without making it again.'
  s.description    = 'Cuts a part out of a video on the phone, without making it again.'
  s.license        = 'UNLICENSED'
  s.author         = 'Realm'
  s.homepage       = 'https://tomyrealm.com'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
