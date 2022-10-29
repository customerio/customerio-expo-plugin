export const CIO_PROJECT_BUILDSCRIPTS_REGEX =
  /(buildscript\s*\{(.|\n)*dependencies\s*\{)/;
export const CIO_APP_APPLY_REGEX = /(apply plugin: "com.android.application")/;
export const CIO_GIST_MAVEN_REGEX =
  /maven { url "https:\/\/maven.gist.build" }/;
export const CIO_PROJECT_ALLPROJECTS_REGEX =
  /(allprojects\s*\{(.|\n)*repositories\s*\{)/;

export const CIO_PROJECT_GIST_MAVEN_SNIPPET =
  '        maven { url "https://maven.gist.build" }';
export const CIO_APP_GOOGLE_SNIPPET =
  'apply plugin: "com.google.gms.google-services"  // Google Services plugin';
export const CIO_PROJECT_GOOGLE_SNIPPET =
  '        classpath "com.google.gms:google-services:4.3.13"  // Google Services plugin';
