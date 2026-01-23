import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAds } from '../src/context/AdContext';
import { BannerAd } from '../src/components/BannerAd';
import { submitEpisodeScore, submitMixedScore } from '../src/services/api';

export default function ResultScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { showInterstitial, showRewarded, isRewardedReady } = useAds();
  
  const mode = params.mode as string || 'episode';
  const episodeId = parseInt(params.episodeId as string) || 1;
  const initialScore = parseInt(params.score as string) || 0;
  const correctCount = parseInt(params.correctCount as string) || 0;
  const speedBonus = parseInt(params.speedBonus as string) || 0;
  const totalQuestions = parseInt(params.totalQuestions as string) || 25;
  const questionsAnswered = parseInt(params.questionsAnswered as string) || 0;
  const isNewRecord = params.isNewRecord === '1';
  const initialBestScore = parseInt(params.bestScore as string) || initialScore;
  
  const [displayScore, setDisplayScore] = useState(initialScore);
  const [bestScore, setBestScore] = useState(initialBestScore);
  const [hasUsedMultiplier, setHasUsedMultiplier] = useState(false);
  const [interstitialShown, setInterstitialShown] = useState(false);
  const [isNewRecordAfterMultiplier, setIsNewRecordAfterMultiplier] = useState(isNewRecord);
  
  // Ref ile güncel score'u takip et (closure sorunu için)
  const currentScoreRef = useRef(initialScore);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const multiplierAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Oyun sonu geçiş reklamını göster
    if (!interstitialShown) {
      showInterstitial();
      setInterstitialShown(true);
    }
    
    // Animate score
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
    
    // Sparkle animation for new record
    if (isNewRecord || isNewRecordAfterMultiplier) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(sparkleAnim, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
    
    // Pulse animation for multiplier button
    if (!hasUsedMultiplier) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(multiplierAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(multiplierAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isNewRecordAfterMultiplier, hasUsedMultiplier]);

  // 3X Ödüllü reklam izle
  const handleWatchAd = async () => {
    if (hasUsedMultiplier) {
      Alert.alert('Zaten Kullanıldı', 'Bu oyunda zaten 3X bonus kullandınız!');
      return;
    }

    // initialScore'u kullan (closure sorunu yok)
    const multipliedScore = initialScore * 3;
    
    await showRewarded(async () => {
      console.log('[3X] Reklam izlendi, puan katlama başlıyor');
      console.log('[3X] Orijinal puan:', initialScore);
      console.log('[3X] Yeni puan:', multipliedScore);
      
      // State'leri güncelle
      setDisplayScore(multipliedScore);
      currentScoreRef.current = multipliedScore;
      setHasUsedMultiplier(true);
      
      // Yeni skoru backend'e kaydet
      try {
        let result;
        if (mode === 'mixed') {
          console.log('[3X] Mixed skor gönderiliyor:', multipliedScore);
          result = await submitMixedScore(multipliedScore, correctCount, speedBonus, questionsAnswered);
        } else {
          console.log('[3X] Episode skor gönderiliyor:', multipliedScore, 'Episode:', episodeId);
          result = await submitEpisodeScore(episodeId, multipliedScore, correctCount, speedBonus);
        }
        
        console.log('[3X] Backend yanıtı:', result);
        
        // Best score'u güncelle
        if (result && result.best_score) {
          setBestScore(result.best_score);
        } else {
          // Backend yanıt vermezse manuel güncelle
          setBestScore(Math.max(bestScore, multipliedScore));
        }
        
        // Yeni rekor mu kontrol et
        if (result && result.is_new_record) {
          setIsNewRecordAfterMultiplier(true);
        } else if (multipliedScore > initialBestScore) {
          setIsNewRecordAfterMultiplier(true);
        }
        
      } catch (e) {
        console.error('[3X] Skor kaydetme hatası:', e);
        // Hata olsa bile UI'ı güncelle
        setBestScore(Math.max(bestScore, multipliedScore));
      }
      
      Alert.alert(
        '🎉 Tebrikler!', 
        `Puanınız 3X katlandı!\n\n${initialScore} → ${multipliedScore}\n\nLiderlik tablosu güncellendi!`
      );
    });
  };

  const handleNextEpisode = async () => {
    // Dinamik olarak maksimum bölüm sayısını kontrol etmek yerine
    // sabit bir değer kullanıyoruz, backend zaten kontrol ediyor
    router.replace(`/quiz?mode=episode&episode=${episodeId + 1}`);
  };

  const handlePlayAgain = () => {
    if (mode === 'mixed') {
      router.replace('/quiz?mode=mixed');
    } else {
      router.replace(`/quiz?mode=episode&episode=${episodeId}`);
    }
  };

  const handleLeaderboard = () => {
    if (mode === 'mixed') {
      router.push('/leaderboard?tab=mixed');
    } else {
      router.push(`/leaderboard?tab=episode&episode=${episodeId}`);
    }
  };

  // Gösterilecek en iyi skor
  const displayBestScore = Math.max(bestScore, displayScore);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* New Record Badge */}
        {(isNewRecord || isNewRecordAfterMultiplier) && (
          <Animated.View style={[styles.newRecordBadge, { opacity: sparkleAnim }]}>
            <Ionicons name="trophy" size={24} color="#ffc107" />
            <Text style={styles.newRecordText}>YENİ REKOR!</Text>
          </Animated.View>
        )}

        {/* Score with 3X Button */}
        <Animated.View style={[styles.scoreContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.scoreLabel}>SKOR</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, hasUsedMultiplier && styles.multipliedScore]}>
              {displayScore}
            </Text>
            {!hasUsedMultiplier && (
              <Animated.View style={{ transform: [{ scale: multiplierAnim }] }}>
                <TouchableOpacity 
                  style={styles.multiplierButton} 
                  onPress={handleWatchAd}
                  activeOpacity={0.8}
                >
                  <Ionicons name="videocam" size={18} color="#fff" />
                  <Text style={styles.multiplierText}>3X</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
          {hasUsedMultiplier && (
            <Text style={styles.multipliedLabel}>✨ 3X BONUS UYGULANDI!</Text>
          )}
        </Animated.View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={28} color="#4caf50" />
            <Text style={styles.statValue}>{correctCount}</Text>
            <Text style={styles.statLabel}>Doğru</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="flash" size={28} color="#ff9800" />
            <Text style={styles.statValue}>+{speedBonus}</Text>
            <Text style={styles.statLabel}>Hız Bonusu</Text>
          </View>
          
          {mode === 'episode' ? (
            <View style={styles.statItem}>
              <Ionicons name="help-circle" size={28} color="#2196f3" />
              <Text style={styles.statValue}>{correctCount}/{totalQuestions}</Text>
              <Text style={styles.statLabel}>Soru</Text>
            </View>
          ) : (
            <View style={styles.statItem}>
              <Ionicons name="list" size={28} color="#2196f3" />
              <Text style={styles.statValue}>{questionsAnswered}</Text>
              <Text style={styles.statLabel}>Cevaplanan</Text>
            </View>
          )}
        </View>

        {/* Best Score */}
        <View style={styles.bestScoreContainer}>
          <Text style={styles.bestScoreLabel}>
            {mode === 'episode' ? `${episodeId}. Bölüm En İyi Skor` : 'Karışık Mod En İyi'}
          </Text>
          <Text style={styles.bestScoreValue}>{displayBestScore}</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          {mode === 'episode' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleNextEpisode}>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
              <Text style={styles.primaryButtonText}>Sonraki Bölüm</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.secondaryButton} onPress={handlePlayAgain}>
            <Ionicons name="refresh" size={24} color="#fff" />
            <Text style={styles.secondaryButtonText}>Tekrar Oyna</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={handleLeaderboard}>
            <Ionicons name="trophy" size={24} color="#fff" />
            <Text style={styles.secondaryButtonText}>Liderlik Tablosu</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.outlineButton} onPress={() => router.replace('/')}>
            <Ionicons name="home" size={24} color="#009688" />
            <Text style={styles.outlineButtonText}>Ana Menü</Text>
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
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,193,7,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 20,
  },
  newRecordText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffc107',
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
    letterSpacing: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
  },
  multipliedScore: {
    color: '#4caf50',
  },
  multiplierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff9800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#ff9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  multiplierText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  multipliedLabel: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: 'bold',
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 32,
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 20,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  bestScoreContainer: {
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  bestScoreLabel: {
    fontSize: 14,
    color: '#888',
  },
  bestScoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffc107',
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009688',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#009688',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#009688',
  },
});
