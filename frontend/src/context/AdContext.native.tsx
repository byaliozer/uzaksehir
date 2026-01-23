import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import mobileAds, { MaxAdContentRating, BannerAd as RNBannerAd, BannerAdSize, InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

// Production AdMob IDs - Uzak Şehir
export const ADMOB_CONFIG = {
  APP_ID: 'ca-app-pub-9873123247401502~8851229017',
  BANNER_ID: 'ca-app-pub-9873123247401502/3866302125',
  INTERSTITIAL_ID: 'ca-app-pub-9873123247401502/6241377543',
};

// Use test IDs in development
const isDev = __DEV__;
const BANNER_AD_UNIT_ID = isDev ? TestIds.BANNER : ADMOB_CONFIG.BANNER_ID;
const INTERSTITIAL_AD_UNIT_ID = isDev ? TestIds.INTERSTITIAL : ADMOB_CONFIG.INTERSTITIAL_ID;

interface AdContextType {
  showInterstitial: () => Promise<void>;
  bannerAdId: string;
  interstitialAdId: string;
  isInterstitialReady: boolean;
  isMobile: boolean;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

// Interstitial singleton
let interstitialAd: InterstitialAd | null = null;

export function AdProvider({ children }: { children: React.ReactNode }) {
  const [isInterstitialReady, setIsInterstitialReady] = useState(false);
  const [adsInitialized, setAdsInitialized] = useState(false);

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
      } catch (error) {
        console.error('[AdMob] SDK initialization error:', error);
      }
    };
    initAds();
  }, []);

  const loadInterstitial = useCallback(() => {
    try {
      interstitialAd = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
        keywords: ['game', 'quiz', 'trivia'],
      });

      const unsubscribeLoaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[AdMob] Interstitial loaded');
        setIsInterstitialReady(true);
      });

      const unsubscribeClosed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMob] Interstitial closed');
        setIsInterstitialReady(false);
        // Load next ad
        setTimeout(loadInterstitial, 1000);
      });

      const unsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('[AdMob] Interstitial error:', error);
        setIsInterstitialReady(false);
        // Retry after delay
        setTimeout(loadInterstitial, 30000);
      });

      interstitialAd.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      };
    } catch (error) {
      console.error('[AdMob] Error creating interstitial:', error);
    }
  }, []);

  const showInterstitial = useCallback(async () => {
    if (interstitialAd && isInterstitialReady) {
      try {
        await interstitialAd.show();
        console.log('[AdMob] Interstitial shown');
      } catch (error) {
        console.error('[AdMob] Error showing interstitial:', error);
      }
    } else {
      console.log('[AdMob] Interstitial not ready');
    }
  }, [isInterstitialReady]);

  return (
    <AdContext.Provider value={{
      showInterstitial,
      bannerAdId: BANNER_AD_UNIT_ID,
      interstitialAdId: INTERSTITIAL_AD_UNIT_ID,
      isInterstitialReady,
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
