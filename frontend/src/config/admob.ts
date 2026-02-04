/**
 * AdMob Configuration - Uzak Şehir
 */

import { Platform } from 'react-native';

// AdMob Configuration - Uzak Şehir
export const ADMOB_IDS = {
  APP_ID: 'ca-app-pub-6962478203802216~6360049587',
  BANNER_ID: 'ca-app-pub-6962478203802216/2229232887',
  INTERSTITIAL_ID: 'ca-app-pub-6962478203802216/3178626126',
  REWARDED_ID: 'ca-app-pub-6962478203802216/7018525139',
};

// Test IDs for development
export const TEST_IDS = {
  BANNER_ID: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL_ID: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED_ID: 'ca-app-pub-3940256099942544/5224354917',
};

// Get appropriate ad ID based on environment
export const getAdId = (type: 'banner' | 'interstitial' | 'rewarded', useTestAds = false) => {
  if (useTestAds) {
    switch (type) {
      case 'banner': return TEST_IDS.BANNER_ID;
      case 'interstitial': return TEST_IDS.INTERSTITIAL_ID;
      case 'rewarded': return TEST_IDS.REWARDED_ID;
    }
  }
  switch (type) {
    case 'banner': return ADMOB_IDS.BANNER_ID;
    case 'interstitial': return ADMOB_IDS.INTERSTITIAL_ID;
    case 'rewarded': return ADMOB_IDS.REWARDED_ID;
  }
};

// Check if we're on a mobile platform
export const isMobilePlatform = () => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

export default {
  ADMOB_IDS,
  TEST_IDS,
  getAdId,
  isMobilePlatform,
};
