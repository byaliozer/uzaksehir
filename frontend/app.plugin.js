const { 
  withAppBuildGradle, 
  withGradleProperties,
  withMainActivity,
  withMainApplication,
  withDangerousMod
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to:
 * 1. Enable BuildConfig generation in Android builds
 * 2. Add explicit BuildConfig import to MainActivity.kt and MainApplication.kt
 * 
 * CRITICAL: EAS regenerates android folder on every build
 */
const withBuildConfig = (config) => {
  const packageName = config.android?.package || 'com.busegame.uzaksehir';
  console.log(`[withBuildConfig] Plugin starting with package: ${packageName}`);
  
  // 1. Modify android/app/build.gradle to add buildFeatures { buildConfig true }
  config = withAppBuildGradle(config, (gradleConfig) => {
    console.log('[withBuildConfig] Modifying android/app/build.gradle...');
    
    let contents = gradleConfig.modResults.contents;
    
    // Check if buildFeatures block with buildConfig already exists
    if (contents.includes('buildConfig true') || contents.includes('buildConfig = true')) {
      console.log('[withBuildConfig] buildConfig already exists, skipping...');
      return gradleConfig;
    }
    
    // Check if buildFeatures block exists but without buildConfig
    if (contents.includes('buildFeatures {')) {
      console.log('[withBuildConfig] buildFeatures block exists, adding buildConfig inside...');
      contents = contents.replace(
        /buildFeatures\s*\{/,
        `buildFeatures {\n        buildConfig true`
      );
    } else {
      // No buildFeatures block, add it after android {
      console.log('[withBuildConfig] Adding buildFeatures block after android {...');
      contents = contents.replace(
        /android\s*\{/,
        `android {\n    buildFeatures {\n        buildConfig true\n    }`
      );
    }
    
    gradleConfig.modResults.contents = contents;
    console.log('[withBuildConfig] android/app/build.gradle modified successfully');
    
    return gradleConfig;
  });

  // 2. Add to gradle.properties as fallback
  config = withGradleProperties(config, (propsConfig) => {
    console.log('[withBuildConfig] Adding to gradle.properties...');
    
    const existingProp = propsConfig.modResults.find(
      (item) => item.key === 'android.defaults.buildfeatures.buildconfig'
    );
    
    if (!existingProp) {
      propsConfig.modResults.push({
        type: 'property',
        key: 'android.defaults.buildfeatures.buildconfig',
        value: 'true',
      });
      console.log('[withBuildConfig] gradle.properties updated');
    }
    
    return propsConfig;
  });

  // 3. Add BuildConfig import to MainActivity.kt
  config = withMainActivity(config, (activityConfig) => {
    console.log('[withBuildConfig] Modifying MainActivity.kt...');
    
    let contents = activityConfig.modResults.contents;
    const importStatement = `import ${packageName}.BuildConfig`;
    
    // Check if import already exists
    if (contents.includes(importStatement) || contents.includes(`import ${packageName}.BuildConfig`)) {
      console.log('[withBuildConfig] BuildConfig import already exists in MainActivity.kt');
      return activityConfig;
    }
    
    // Add import after package declaration
    contents = contents.replace(
      /(package\s+[\w.]+)/,
      `$1\n\n${importStatement}`
    );
    
    activityConfig.modResults.contents = contents;
    console.log('[withBuildConfig] MainActivity.kt modified successfully');
    
    return activityConfig;
  });

  // 4. Add BuildConfig import to MainApplication.kt
  config = withMainApplication(config, (appConfig) => {
    console.log('[withBuildConfig] Modifying MainApplication.kt...');
    
    let contents = appConfig.modResults.contents;
    const importStatement = `import ${packageName}.BuildConfig`;
    
    // Check if import already exists
    if (contents.includes(importStatement) || contents.includes(`import ${packageName}.BuildConfig`)) {
      console.log('[withBuildConfig] BuildConfig import already exists in MainApplication.kt');
      return appConfig;
    }
    
    // Add import after package declaration
    contents = contents.replace(
      /(package\s+[\w.]+)/,
      `$1\n\n${importStatement}`
    );
    
    appConfig.modResults.contents = contents;
    console.log('[withBuildConfig] MainApplication.kt modified successfully');
    
    return appConfig;
  });

  console.log('[withBuildConfig] Plugin completed');
  return config;
};

module.exports = withBuildConfig;
