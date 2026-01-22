import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getGeneralLeaderboard,
  getEpisodeLeaderboard,
  getMixedLeaderboard,
  LeaderboardResponse,
  LeaderboardEntry,
} from '../src/services/api';
import { BannerAd } from '../src/components/BannerAd';

type TabType = 'general' | 'episode' | 'mixed';

export default function LeaderboardScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const initialTab = (params.tab as TabType) || 'general';
  const initialEpisode = parseInt(params.episode as string) || 1;
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [selectedEpisode, setSelectedEpisode] = useState(initialEpisode);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab, selectedEpisode]);

  const loadData = async () => {
    setLoading(true);
    try {
      let result: LeaderboardResponse;
      switch (activeTab) {
        case 'general':
          result = await getGeneralLeaderboard();
          break;
        case 'episode':
          result = await getEpisodeLeaderboard(selectedEpisode);
          break;
        case 'mixed':
          result = await getMixedLeaderboard();
          break;
      }
      setData(result);
    } catch (e) {
      console.error('Error loading leaderboard:', e);
    }
    setLoading(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Text style={styles.rankIcon}>🥇</Text>;
      case 2: return <Text style={styles.rankIcon}>🥈</Text>;
      case 3: return <Text style={styles.rankIcon}>🥉</Text>;
      default: return <Text style={styles.rankNumber}>{rank}</Text>;
    }
  };

  const renderEntry = ({ item }: { item: LeaderboardEntry }) => (
    <View style={[styles.entryRow, item.rank <= 3 && styles.topEntry]}>
      <View style={styles.rankContainer}>
        {getRankIcon(item.rank)}
      </View>
      <Text style={styles.playerName} numberOfLines={1}>{item.player_name}</Text>
      <View style={styles.scoreContainer}>
        <Ionicons name="star" size={16} color="#ffc107" />
        <Text style={styles.entryScore}>{item.score}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liderlik Tablosu</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'general' && styles.activeTab]}
          onPress={() => setActiveTab('general')}
        >
          <Text style={[styles.tabText, activeTab === 'general' && styles.activeTabText]}>Genel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'episode' && styles.activeTab]}
          onPress={() => setActiveTab('episode')}
        >
          <Text style={[styles.tabText, activeTab === 'episode' && styles.activeTabText]}>Bölüm</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mixed' && styles.activeTab]}
          onPress={() => setActiveTab('mixed')}
        >
          <Text style={[styles.tabText, activeTab === 'mixed' && styles.activeTabText]}>Karışık</Text>
        </TouchableOpacity>
      </View>

      {/* Episode Selector */}
      {activeTab === 'episode' && (
        <View style={styles.episodeSelector}>
          <TouchableOpacity
            style={styles.episodeArrow}
            onPress={() => setSelectedEpisode(Math.max(1, selectedEpisode - 1))}
            disabled={selectedEpisode <= 1}
          >
            <Ionicons name="chevron-back" size={24} color={selectedEpisode <= 1 ? '#444' : '#fff'} />
          </TouchableOpacity>
          <Text style={styles.episodeText}>{selectedEpisode}. Bölüm</Text>
          <TouchableOpacity
            style={styles.episodeArrow}
            onPress={() => setSelectedEpisode(Math.min(14, selectedEpisode + 1))}
            disabled={selectedEpisode >= 14}
          >
            <Ionicons name="chevron-forward" size={24} color={selectedEpisode >= 14 ? '#444' : '#fff'} />
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#009688" />
        </View>
      ) : (
        <>
          {/* Total Players */}
          <View style={styles.totalPlayers}>
            <Ionicons name="people" size={16} color="#888" />
            <Text style={styles.totalPlayersText}>{data?.total_players || 0} oyuncu</Text>
          </View>

          {/* List */}
          <FlatList
            data={data?.entries || []}
            keyExtractor={(item, index) => `${item.player_name}-${index}`}
            renderItem={renderEntry}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="trophy-outline" size={64} color="#444" />
                <Text style={styles.emptyText}>Henüz skor yok</Text>
              </View>
            }
          />

          {/* Player Position */}
          {data?.player_rank && (
            <View style={styles.playerPosition}>
              <View style={styles.playerPositionContent}>
                <Text style={styles.playerPositionLabel}>Senin Sıran</Text>
                <View style={styles.playerPositionRank}>
                  <Text style={styles.playerPositionRankText}>#{data.player_rank}</Text>
                </View>
                <View style={styles.playerPositionScore}>
                  <Ionicons name="star" size={16} color="#ffc107" />
                  <Text style={styles.playerPositionScoreText}>{data.player_score}</Text>
                </View>
              </View>
            </View>
          )}
        </>
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#009688',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  activeTabText: {
    color: '#fff',
  },
  episodeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  episodeArrow: {
    padding: 8,
  },
  episodeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    minWidth: 100,
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalPlayers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  totalPlayersText: {
    color: '#888',
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  topEntry: {
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankIcon: {
    fontSize: 24,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#888',
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entryScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffc107',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  playerPosition: {
    backgroundColor: '#009688',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
  },
  playerPositionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerPositionLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  playerPositionRank: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  playerPositionRankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  playerPositionScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerPositionScoreText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
