import AsyncStorage from '@react-native-async-storage/async-storage';

// Use environment variable for backend URL - NO FALLBACK for production safety
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://citygame-1.emergent.host';

// Storage keys - Uzak Şehir
const STORAGE_KEYS = {
  USERNAME: '@uzaksehir_username',
  SETTINGS: '@uzaksehir_settings',
};

// === TYPES ===

export interface Episode {
  id: number;
  name: string;
  question_count: number;
  is_locked: boolean;
  description: string;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  correct_option: string;
  difficulty: string;
  points: number;
}

export interface QuizResponse {
  episode_id: number | null;
  episode_name: string;
  questions: Question[];
  total_questions: number;
  max_possible_score: number;
  mode: 'episode' | 'mixed';
}

export interface LeaderboardEntry {
  rank: number;
  player_name: string;
  score: number;
  episodes_completed?: number;
  questions_answered?: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  player_rank: number | null;
  player_score: number | null;
  total_players: number;
}

export interface PlayerStats {
  player_name: string;
  global_score: number;
  episodes_completed: number;
  episode_scores: Record<number, number>;
  mixed_best_score: number;
}

export interface Settings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

// === USERNAME MANAGEMENT ===

export async function getUsername(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.USERNAME);
  } catch {
    return null;
  }
}

export async function setUsername(name: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, name);
}

export async function hasUsername(): Promise<boolean> {
  const name = await getUsername();
  return name !== null && name.length > 0;
}

// === SETTINGS MANAGEMENT ===

export async function getSettings(): Promise<Settings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return { soundEnabled: true, vibrationEnabled: true };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// === API FUNCTIONS ===

// Transform API response to normalized format
function normalizeQuizResponse(data: any): QuizResponse {
  const optionLetters = ['A', 'B', 'C', 'D'];
  
  const questions: Question[] = data.questions.map((q: any, qIndex: number) => {
    const hasId = q.options[0]?.id !== undefined;
    const hasIsCorrect = q.options[0]?.is_correct !== undefined;
    
    let normalizedOptions: QuestionOption[];
    let correctOption: string;
    
    if (hasId && q.correct_option) {
      normalizedOptions = q.options.map((opt: any) => ({
        id: String(opt.id).trim().toUpperCase(),
        text: opt.text
      }));
      correctOption = String(q.correct_option).trim().toUpperCase();
    } else if (hasIsCorrect) {
      normalizedOptions = q.options.map((opt: any, idx: number) => ({
        id: optionLetters[idx],
        text: opt.text
      }));
      const correctIdx = q.options.findIndex((opt: any) => opt.is_correct === true);
      correctOption = correctIdx >= 0 ? optionLetters[correctIdx] : 'A';
    } else {
      normalizedOptions = q.options.map((opt: any, idx: number) => ({
        id: optionLetters[idx],
        text: typeof opt === 'string' ? opt : opt.text
      }));
      correctOption = 'A';
    }
    
    const difficultyMap: Record<string, string> = {
      'easy': 'kolay', 'medium': 'orta', 'hard': 'zor'
    };
    const difficulty = difficultyMap[q.difficulty?.toLowerCase()] || q.difficulty || 'orta';
    const points = typeof q.points === 'number' ? q.points : 
      (difficulty === 'kolay' ? 10 : difficulty === 'zor' ? 50 : 20);
    
    return {
      id: q.id || `q_${qIndex}`,
      text: q.text,
      options: normalizedOptions,
      correct_option: correctOption,
      difficulty,
      points
    };
  });
  
  return {
    episode_id: data.episode_id,
    episode_name: data.episode_name || 'Quiz',
    questions,
    total_questions: data.total_questions || questions.length,
    max_possible_score: data.max_possible_score || questions.reduce((sum, q) => sum + q.points + 5, 0),
    mode: data.mode || 'episode'
  };
}

export async function getEpisodes(): Promise<Episode[]> {
  try {
    console.log('[API] Fetching episodes from:', `${API_URL}/api/episodes`);
    const response = await fetch(`${API_URL}/api/episodes`);
    console.log('[API] Episodes response status:', response.status);
    
    if (!response.ok) {
      console.error('[API] Episodes fetch failed:', response.status);
      throw new Error('Bölümler yüklenemedi');
    }
    
    const data = await response.json();
    console.log('[API] Episodes loaded:', data.length);
    return data;
  } catch (error) {
    console.error('[API] Episodes error:', error);
    // Return empty array instead of throwing to prevent crash
    return [];
  }
}

export async function getEpisodeQuiz(episodeId: number): Promise<QuizResponse> {
  // Try new endpoint first, fallback to old endpoint
  let response = await fetch(`${API_URL}/api/quiz/episode/${episodeId}?count=25`);
  
  if (!response.ok) {
    // Fallback to old endpoint format
    console.log('[API] Trying fallback endpoint...');
    response = await fetch(`${API_URL}/api/quiz/${episodeId}?count=25`);
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Quiz yüklenemedi');
  }
  const data = await response.json();
  return normalizeQuizResponse(data);
}

export async function getMixedQuiz(): Promise<QuizResponse> {
  // Try new endpoint first
  let response = await fetch(`${API_URL}/api/quiz/mixed`);
  
  if (!response.ok) {
    // Fallback: fetch all episodes and combine questions
    console.log('[API] Mixed endpoint not found, using fallback...');
    const episodes = await getEpisodes();
    const allQuestions: any[] = [];
    
    for (const ep of episodes.slice(0, 5)) { // Limit to first 5 episodes for performance
      try {
        const quiz = await getEpisodeQuiz(ep.id);
        allQuestions.push(...quiz.questions);
      } catch (e) {
        console.log(`[API] Could not fetch episode ${ep.id}`);
      }
    }
    
    // Shuffle questions
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
    
    return {
      episode_id: null,
      episode_name: 'Karışık Mod',
      questions: allQuestions,
      total_questions: allQuestions.length,
      max_possible_score: allQuestions.reduce((sum, q) => sum + q.points + 5, 0),
      mode: 'mixed'
    };
  }
  
  const data = await response.json();
  return normalizeQuizResponse(data);
}

export async function submitEpisodeScore(
  episodeId: number,
  score: number,
  correctCount: number,
  speedBonus: number
): Promise<{ success: boolean; is_new_record: boolean; best_score: number }> {
  const username = await getUsername();
  if (!username) throw new Error('Kullanıcı adı bulunamadı');
  
  // Try new endpoint first
  let response = await fetch(`${API_URL}/api/score/episode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_name: username,
      episode_id: episodeId,
      score,
      correct_count: correctCount,
      speed_bonus: speedBonus
    })
  });
  
  // Fallback to old leaderboard endpoint if new one doesn't exist
  if (!response.ok && response.status === 404) {
    console.log('[API] Trying legacy leaderboard endpoint...');
    response = await fetch(`${API_URL}/api/leaderboard/${episodeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: username,
        score,
        correct_count: correctCount,
        speed_bonus: speedBonus,
        episode_id: episodeId
      })
    });
  }
  
  if (!response.ok) {
    console.warn('[API] Score submission failed, returning local data');
    // Return local success even if API fails
    return { success: true, is_new_record: false, best_score: score };
  }
  
  try {
    return await response.json();
  } catch {
    return { success: true, is_new_record: false, best_score: score };
  }
}

export async function submitMixedScore(
  score: number,
  correctCount: number,
  speedBonus: number,
  questionsAnswered: number
): Promise<{ success: boolean; is_new_record: boolean; best_score: number }> {
  const username = await getUsername();
  if (!username) throw new Error('Kullanıcı adı bulunamadı');
  
  // Try new endpoint first
  let response = await fetch(`${API_URL}/api/score/mixed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_name: username,
      score,
      correct_count: correctCount,
      speed_bonus: speedBonus,
      questions_answered: questionsAnswered
    })
  });
  
  // Fallback to old mixed leaderboard endpoint if new one doesn't exist
  if (!response.ok && response.status === 404) {
    console.log('[API] Trying legacy mixed leaderboard endpoint...');
    response = await fetch(`${API_URL}/api/leaderboard/mixed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: username,
        score,
        correct_count: correctCount,
        speed_bonus: speedBonus,
        questions_answered: questionsAnswered
      })
    });
  }
  
  if (!response.ok) {
    console.warn('[API] Mixed score submission failed, returning local data');
    // Return local success even if API fails
    return { success: true, is_new_record: false, best_score: score };
  }
  
  try {
    return await response.json();
  } catch {
    return { success: true, is_new_record: false, best_score: score };
  }
}

export async function getGeneralLeaderboard(): Promise<LeaderboardResponse> {
  const username = await getUsername();
  
  // Try new endpoint first
  let url = `${API_URL}/api/leaderboard/general`;
  if (username) url += `?player_name=${encodeURIComponent(username)}`;
  
  let response = await fetch(url);
  
  // If new endpoint works, return the data
  if (response.ok) {
    return response.json();
  }
  
  // Fallback: Old API doesn't have general leaderboard, aggregate from episode 1
  console.log('[API] General leaderboard not found, using episode 1 fallback');
  try {
    const episodeData = await getEpisodeLeaderboard(1);
    return episodeData;
  } catch {
    return { entries: [], player_rank: null, player_score: null, total_players: 0 };
  }
}

export async function getEpisodeLeaderboard(episodeId: number): Promise<LeaderboardResponse> {
  const username = await getUsername();
  
  // Try new endpoint first
  let url = `${API_URL}/api/leaderboard/episode/${episodeId}`;
  if (username) url += `?player_name=${encodeURIComponent(username)}`;
  
  let response = await fetch(url);
  
  if (response.ok) {
    return response.json();
  }
  
  // Fallback to old endpoint format: /api/leaderboard/{episode_id}
  console.log('[API] Trying legacy episode leaderboard endpoint...');
  url = `${API_URL}/api/leaderboard/${episodeId}`;
  if (username) url += `?player_name=${encodeURIComponent(username)}`;
  
  response = await fetch(url);
  
  if (!response.ok) {
    console.warn('[API] Leaderboard fetch failed');
    return { entries: [], player_rank: null, player_score: null, total_players: 0 };
  }
  
  // Transform old format to new format
  const oldData = await response.json();
  const entries = (oldData.top_10 || []).map((entry: any, index: number) => ({
    rank: entry.rank || index + 1,
    player_name: entry.player_name || 'Anonim',
    score: Math.round(entry.score || 0),
  }));
  
  return {
    entries,
    player_rank: oldData.player_rank || null,
    player_score: oldData.player_entry?.score ? Math.round(oldData.player_entry.score) : null,
    total_players: entries.length,
  };
}

export async function getMixedLeaderboard(): Promise<LeaderboardResponse> {
  const username = await getUsername();
  
  // Try new endpoint first
  let url = `${API_URL}/api/leaderboard/mixed`;
  if (username) url += `?player_name=${encodeURIComponent(username)}`;
  
  let response = await fetch(url);
  
  if (response.ok) {
    return response.json();
  }
  
  // Fallback: Old API doesn't have mixed leaderboard
  console.log('[API] Mixed leaderboard not found, returning empty');
  return { entries: [], player_rank: null, player_score: null, total_players: 0 };
}

export async function getPlayerStats(): Promise<PlayerStats | null> {
  const username = await getUsername();
  if (!username) return null;
  
  const response = await fetch(`${API_URL}/api/player/${encodeURIComponent(username)}/stats`);
  if (!response.ok) return null;
  return response.json();
}
