import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getEpisodes, getPlayerStats, Episode } from '../src/services/api';
import { BannerAd } from '../src/components/BannerAd';

export default function EpisodesScreen() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodeScores, setEpisodeScores] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [eps, stats] = await Promise.all([
        getEpisodes(),
        getPlayerStats()
      ]);
      
      if (eps.length === 0) {
        setError(true);
      } else {
        setEpisodes(eps);
      }
      
      if (stats) {
        setEpisodeScores(stats.episode_scores || {});
      }
    } catch (e) {
      console.error('Error loading episodes:', e);
      setError(true);
    }
    setLoading(false);
  };

  const handleEpisodePress = (episode: Episode) => {
    if (episode.is_locked) {
      Alert.alert(
        '🔒 Kilitli Bölüm',
        'Bu bölüm henüz açılmadı. Yakında eklenecek!',
        [{ text: 'Tamam', style: 'default' }]
      );
      return;
    }
    router.push(`/quiz?mode=episode&episode=${episode.id}`);
  };

  const renderEpisode = ({ item }: { item: Episode }) => {
    const score = episodeScores[item.id];
    const hasScore = score !== undefined && score > 0;
    const isLocked = item.is_locked;

    return (
      <TouchableOpacity
        style={[styles.episodeCard, isLocked && styles.lockedCard]}
        onPress={() => handleEpisodePress(item)}
        activeOpacity={isLocked ? 0.6 : 0.8}
      >
        <View style={[styles.episodeNumber, isLocked && styles.lockedNumber]}>
          {isLocked ? (
            <Ionicons name="lock-closed" size={20} color="#666" />
          ) : (
            <Text style={styles.episodeNumberText}>{item.id}</Text>
          )}
        </View>
        <View style={styles.episodeInfo}>
          <Text style={[styles.episodeName, isLocked && styles.lockedText]}>
            {item.name}
          </Text>
          <Text style={[styles.episodeQuestions, isLocked && styles.lockedSubtext]}>
            {isLocked ? 'Yakında' : '25 Soru'}
          </Text>
        </View>
        {!isLocked && hasScore && (
          <View style={styles.scoreContainer}>
            <Ionicons name="star" size={16} color="#ffc107" />
            <Text style={styles.scoreText}>{score}</Text>
          </View>
        )}
        {isLocked ? (
          <Ionicons name="lock-closed" size={20} color="#666" />
        ) : (
          <Ionicons name="chevron-forward" size={24} color="#666" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bölüm Seçin</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#009688" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={60} color="#666" />
          <Text style={styles.errorText}>Bölümler yüklenemedi</Text>
          <Text style={styles.errorSubtext}>İnternet bağlantınızı kontrol edin</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderEpisode}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BannerAd />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  lockedCard: {
    backgroundColor: '#232338',
    opacity: 0.7,
  },
  episodeNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#009688',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedNumber: {
    backgroundColor: '#3d3d54',
  },
  episodeNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  episodeInfo: {
    flex: 1,
  },
  episodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  lockedText: {
    color: '#888',
  },
  episodeQuestions: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  lockedSubtext: {
    color: '#666',
    fontStyle: 'italic',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,193,7,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffc107',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#009688',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
