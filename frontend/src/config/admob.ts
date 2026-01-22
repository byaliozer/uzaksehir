/**
 * AdMob Native Implementation - Uzak Şehir
 * Bu dosya sadece mobil cihazlarda (iOS/Android) çalışır
 * EAS Build ile derlendiğinde aktif olur
 * 
 * Web önizlemede bu kod çalışmaz, placeholder gösterilir
 */

import { Platform } from 'react-native';

// AdMob Configuration - Uzak Şehir
export const ADMOB_IDS = {
  APP_ID: 'ca-app-pub-9873123247401502~8851229017',
  BANNER_ID: 'ca-app-pub-9873123247401502/3866302125',
  INTERSTITIAL_ID: 'ca-app-pub-9873123247401502/6241377543',
};

// Test IDs for development
export const TEST_IDS = {
  BANNER_ID: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL_ID: 'ca-app-pub-3940256099942544/1033173712',
};

// Get appropriate ad ID based on environment
export const getAdId = (type: 'banner' | 'interstitial', useTestAds = false) => {
  if (useTestAds) {
    return type === 'banner' ? TEST_IDS.BANNER_ID : TEST_IDS.INTERSTITIAL_ID;
  }
  return type === 'banner' ? ADMOB_IDS.BANNER_ID : ADMOB_IDS.INTERSTITIAL_ID;
};

// Check if we're on a mobile platform
export const isMobilePlatform = () => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

/**
 * Instructions for EAS Build Integration:
 * 
 * 1. Install required packages:
 *    npx expo install react-native-google-mobile-ads
 * 
 * 2. app.json is already configured with AdMob plugin
 * 
 * 3. Create development build:
 *    eas build --profile development --platform android
 *    eas build --profile development --platform ios
 * 
 * 4. For production:
 *    eas build --profile production --platform android
 *    eas build --profile production --platform ios
 * 
 * 5. AdMob will automatically work in the native build
 */

export default {
  ADMOB_IDS,
  TEST_IDS,
  getAdId,
  isMobilePlatform,
};
