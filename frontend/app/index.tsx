import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BannerAd } from '../src/components/BannerAd';

const { width } = Dimensions.get('window');

export default function MainMenu() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Banner Image */}
        <View style={styles.bannerContainer}>
          <Image
            source={require('../assets/images/banner.png')}
            style={styles.banner}
            resizeMode="cover"
          />
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Uzak Şehir</Text>
        </View>

        {/* Game Mode Buttons - Primary Actions */}
        <View style={styles.gameModeContainer}>
          <TouchableOpacity
            style={styles.gameModeButton}
            onPress={() => router.push('/episodes')}
            activeOpacity={0.85}
          >
            <View style={styles.gameModeIconContainer}>
              <Ionicons name="play-circle" size={32} color="#fff" />
            </View>
            <View style={styles.gameModeTextContainer}>
              <Text style={styles.gameModeTitle}>Bölüm Modu</Text>
              <Text style={styles.gameModeHint}>14 bölüm • Her biri 25 soru</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gameModeButton, styles.mixedModeButton]}
            onPress={() => router.push('/quiz?mode=mixed')}
            activeOpacity={0.85}
          >
            <View style={[styles.gameModeIconContainer, styles.mixedIconContainer]}>
              <Ionicons name="shuffle" size={32} color="#fff" />
            </View>
            <View style={styles.gameModeTextContainer}>
              <Text style={styles.gameModeTitle}>Karışık Mod</Text>
              <Text style={styles.gameModeHint}>Sonsuz mod • Tüm sorular</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Utility Buttons - Secondary Actions */}
        <View style={styles.utilityContainer}>
          <TouchableOpacity
            style={styles.utilityButton}
            onPress={() => router.push('/leaderboard')}
            activeOpacity={0.7}
          >
            <Ionicons name="trophy" size={22} color="#ffc107" />
            <Text style={styles.utilityText}>Liderlik</Text>
          </TouchableOpacity>

          <View style={styles.utilityDivider} />

          <TouchableOpacity
            style={styles.utilityButton}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings" size={22} color="#888" />
            <Text style={styles.utilityText}>Ayarlar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner Ad */}
      <BannerAd />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bannerContainer: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: '#2d2d44',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  titleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#009688',
    marginTop: 2,
  },
  gameModeContainer: {
    gap: 12,
  },
  gameModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#009688',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#009688',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  mixedModeButton: {
    backgroundColor: '#e91e63',
    shadowColor: '#e91e63',
  },
  gameModeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mixedIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gameModeTextContainer: {
    flex: 1,
  },
  gameModeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  gameModeHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  spacer: {
    flex: 1,
  },
  utilityContainer: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  utilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  utilityDivider: {
    width: 1,
    backgroundColor: '#3d3d54',
  },
  utilityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#aaa',
  },
});
