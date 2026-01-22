import React, { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SoundProvider } from '../src/context/SoundContext';
import { AdProvider } from '../src/context/AdContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { hasUsername } from '../src/services/api';
import { useFocusEffect } from '@react-navigation/native';

function RootLayoutNav() {
  const [isLoading, setIsLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  const checkUsername = useCallback(async () => {
    try {
      const has = await hasUsername();
      setNeedsUsername(!has);
      setIsLoading(false);
    } catch (e) {
      console.error('Error checking username:', e);
      setIsLoading(false);
    }
  }, []);

  // Check on mount
  useEffect(() => {
    checkUsername();
  }, []);

  // Re-check when pathname changes (after username is set)
  useEffect(() => {
    if (!isLoading && pathname === '/') {
      checkUsername();
    }
  }, [pathname, isLoading]);

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    const inUsernameScreen = segments[0] === 'username';

    if (needsUsername && !inUsernameScreen) {
      // Need username but not on username screen -> redirect
      router.replace('/username');
    } else if (!needsUsername && inUsernameScreen) {
      // Have username but on username screen -> go to home
      router.replace('/');
    }
  }, [isLoading, needsUsername, segments]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#009688" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#1a1a2e' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="username" options={{ gestureEnabled: false }} />
      <Stack.Screen name="episodes" />
      <Stack.Screen name="quiz" />
      <Stack.Screen name="result" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SoundProvider>
      <AdProvider>
        <StatusBar style="light" />
        <RootLayoutNav />
      </AdProvider>
    </SoundProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});
