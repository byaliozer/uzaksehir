import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import mobileAds, { MaxAdContentRating, InterstitialAd, RewardedAd, AdEventType, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

// Production AdMob IDs - Uzak Şehir
export const ADMOB_CONFIG = {
  APP_ID: 'ca-app-pub-9873123247401502~8851229017',
  BANNER_ID: 'ca-app-pub-9873123247401502/3866302125',
  INTERSTITIAL_ID: 'ca-app-pub-9873123247401502/6241377543',
  REWARDED_ID: 'ca-app-pub-9873123247401502/9349856224',
};

// Use test IDs in development
const isDev = __DEV__;
const BANNER_AD_UNIT_ID = isDev ? TestIds.BANNER : ADMOB_CONFIG.BANNER_ID;
const INTERSTITIAL_AD_UNIT_ID = isDev ? TestIds.INTERSTITIAL : ADMOB_CONFIG.INTERSTITIAL_ID;
const REWARDED_AD_UNIT_ID = isDev ? TestIds.REWARDED : ADMOB_CONFIG.REWARDED_ID;

interface AdContextType {
  showInterstitial: () => Promise<void>;
  showRewarded: (onRewarded: () => void) => Promise<void>;
  bannerAdId: string;
  interstitialAdId: string;
  rewardedAdId: string;
  isInterstitialReady: boolean;
  isRewardedReady: boolean;
  isMobile: boolean;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

export function AdProvider({ children }: { children: React.ReactNode }) {
  const [isInterstitialReady, setIsInterstitialReady] = useState(false);
  const [isRewardedReady, setIsRewardedReady] = useState(false);
  const [adsInitialized, setAdsInitialized] = useState(false);
  
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const rewardedRef = useRef<RewardedAd | null>(null);
  const rewardCallbackRef = useRef<(() => void) | null>(null);

  // Initialize Mobile Ads SDK
  useEffect(() => {
    const initAds = async () => {
      try {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.G,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        await mobileAds().initialize();
        console.log('[AdMob] SDK initialized successfully');
        setAdsInitialized(true);
        loadInterstitial();
        loadRewarded();
      } catch (error) {
        console.error('[AdMob] SDK initialization error:', error);
      }
    };
    initAds();
  }, []);

  // Load Interstitial Ad
  const loadInterstitial = useCallback(() => {
    try {
      const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
        keywords: ['game', 'quiz', 'trivia'],
      });

      interstitial.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[AdMob] Interstitial loaded');
        setIsInterstitialReady(true);
      });

      interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMob] Interstitial closed');
        setIsInterstitialReady(false);
        interstitialRef.current = null;
        setTimeout(loadInterstitial, 1000);
      });

      interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('[AdMob] Interstitial error:', error);
        setIsInterstitialReady(false);
        setTimeout(loadInterstitial, 30000);
      });

      interstitial.load();
      interstitialRef.current = interstitial;
    } catch (error) {
      console.error('[AdMob] Error creating interstitial:', error);
    }
  }, []);

  // Load Rewarded Ad
  const loadRewarded = useCallback(() => {
    try {
      const rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
        keywords: ['game', 'quiz', 'trivia'],
      });

      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('[AdMob] Rewarded loaded');
        setIsRewardedReady(true);
      });

      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        console.log('[AdMob] Reward earned:', reward);
        if (rewardCallbackRef.current) {
          rewardCallbackRef.current();
          rewardCallbackRef.current = null;
        }
      });

      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMob] Rewarded closed');
        setIsRewardedReady(false);
        rewardedRef.current = null;
        setTimeout(loadRewarded, 1000);
      });

      rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('[AdMob] Rewarded error:', error);
        setIsRewardedReady(false);
        setTimeout(loadRewarded, 30000);
      });

      rewarded.load();
      rewardedRef.current = rewarded;
    } catch (error) {
      console.error('[AdMob] Error creating rewarded:', error);
    }
  }, []);

  // Show Interstitial
  const showInterstitial = useCallback(async () => {
    if (interstitialRef.current && isInterstitialReady) {
      try {
        await interstitialRef.current.show();
        console.log('[AdMob] Interstitial shown');
      } catch (error) {
        console.error('[AdMob] Error showing interstitial:', error);
      }
    } else {
      console.log('[AdMob] Interstitial not ready');
    }
  }, [isInterstitialReady]);

  // Show Rewarded
  const showRewarded = useCallback(async (onRewarded: () => void) => {
    if (rewardedRef.current && isRewardedReady) {
      try {
        rewardCallbackRef.current = onRewarded;
        await rewardedRef.current.show();
        console.log('[AdMob] Rewarded shown');
      } catch (error) {
        console.error('[AdMob] Error showing rewarded:', error);
        rewardCallbackRef.current = null;
      }
    } else {
      console.log('[AdMob] Rewarded not ready');
    }
  }, [isRewardedReady]);

  return (
    <AdContext.Provider value={{
      showInterstitial,
      showRewarded,
      bannerAdId: BANNER_AD_UNIT_ID,
      interstitialAdId: INTERSTITIAL_AD_UNIT_ID,
      rewardedAdId: REWARDED_AD_UNIT_ID,
      isInterstitialReady,
      isRewardedReady,
      isMobile: true,
    }}>
      {children}
    </AdContext.Provider>
  );
}

export function useAds() {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error('useAds must be used within an AdProvider');
  }
  return context;
}
