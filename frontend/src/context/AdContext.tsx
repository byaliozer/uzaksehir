import React, { createContext, useContext, useCallback, useState } from 'react';

// AdMob IDs - Production IDs - Uzak Şehir
export const ADMOB_CONFIG = {
  APP_ID: 'ca-app-pub-9873123247401502~8851229017',
  BANNER_ID: 'ca-app-pub-9873123247401502/3866302125',
  INTERSTITIAL_ID: 'ca-app-pub-9873123247401502/6241377543',
};

interface AdContextType {
  showInterstitial: () => Promise<void>;
  bannerAdId: string;
  interstitialAdId: string;
  isInterstitialReady: boolean;
  isMobile: boolean;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

// Web version - no real ads
export function AdProvider({ children }: { children: React.ReactNode }) {
  const [isInterstitialReady] = useState(false);

  const showInterstitial = useCallback(async () => {
    console.log('[AdMob Web] Interstitial not available on web');
  }, []);

  return (
    <AdContext.Provider value={{
      showInterstitial,
      bannerAdId: ADMOB_CONFIG.BANNER_ID,
      interstitialAdId: ADMOB_CONFIG.INTERSTITIAL_ID,
      isInterstitialReady,
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
