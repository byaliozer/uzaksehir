import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd as RNBannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// Production Banner ID - Uzak Şehir
const BANNER_ID = 'ca-app-pub-9873123247401502/3866302125';

// Use test ID in development
const isDev = __DEV__;
const BANNER_AD_UNIT_ID = isDev ? TestIds.BANNER : BANNER_ID;

interface BannerAdProps {
  style?: object;
}

export function BannerAd({ style }: BannerAdProps) {
  return (
    <View style={[styles.container, style]}>
      <RNBannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          keywords: ['game', 'quiz', 'trivia'],
        }}
        onAdLoaded={() => {
          console.log('[AdMob] Banner loaded');
        }}
        onAdFailedToLoad={(error) => {
          console.error('[AdMob] Banner failed to load:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
