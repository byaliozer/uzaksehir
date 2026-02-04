import React, { createContext, useContext, useCallback, useState } from 'react';

// AdMob IDs - Production IDs - Uzak Şehir
export const ADMOB_CONFIG = {
  APP_ID: 'ca-app-pub-6962478203802216~6360049587',
  BANNER_ID: 'ca-app-pub-6962478203802216/2229232887',
  INTERSTITIAL_ID: 'ca-app-pub-6962478203802216/3178626126',
  REWARDED_ID: 'ca-app-pub-6962478203802216/7018525139',
};

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

// Web version - no real ads (placeholder for web preview)
export function AdProvider({ children }: { children: React.ReactNode }) {
  const [isInterstitialReady] = useState(false);
  const [isRewardedReady] = useState(false);

  const showInterstitial = useCallback(async () => {
    console.log('[AdMob Web] Interstitial - only works on mobile');
  }, []);

  const showRewarded = useCallback(async (onRewarded: () => void) => {
    console.log('[AdMob Web] Rewarded - only works on mobile');
    // For testing on web, simulate reward
    // onRewarded();
  }, []);

  return (
    <AdContext.Provider value={{
      showInterstitial,
      showRewarded,
      bannerAdId: ADMOB_CONFIG.BANNER_ID,
      interstitialAdId: ADMOB_CONFIG.INTERSTITIAL_ID,
      rewardedAdId: ADMOB_CONFIG.REWARDED_ID,
      isInterstitialReady,
      isRewardedReady,
      isMobile: false,
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
