import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Vibration,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getEpisodeQuiz,
  getMixedQuiz,
  submitEpisodeScore,
  submitMixedScore,
  getSettings,
  QuizResponse,
  Question,
} from '../src/services/api';
import { useSound } from '../src/context/SoundContext';
import { BannerAd } from '../src/components/BannerAd';

export default function QuizScreen() {
  const params = useLocalSearchParams();
  const mode = (params.mode as string) || 'episode';
  const episodeId = parseInt(params.episode as string) || 1;
  const router = useRouter();
  const { playCorrectSound, playWrongSound, playBonusSound, playTickSound, isMuted } = useSound();

  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [speedBonus, setSpeedBonus] = useState(0);
  const [lives, setLives] = useState(3);
  const [timer, setTimer] = useState(20);
  const [answerState, setAnswerState] = useState<'none' | 'correct' | 'wrong'>('none');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTime = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const livesRef = useRef(3); // Track lives with ref to avoid closure issues
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bonusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadQuiz();
    loadSettings();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadSettings = async () => {
    const settings = await getSettings();
    setVibrationEnabled(settings.vibrationEnabled);
  };

  const loadQuiz = async () => {
    try {
      const data = mode === 'mixed' 
        ? await getMixedQuiz() 
        : await getEpisodeQuiz(episodeId);
      setQuiz(data);
      startTimer();
    } catch (e) {
      console.error('Error loading quiz:', e);
    }
    setLoading(false);
  };

  // Pause/Resume timer functions
  const pauseTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    pausedTimeRef.current = timer;
    setIsPaused(true);
  };

  const resumeTimer = () => {
    setIsPaused(false);
    setTimer(pausedTimeRef.current);
    
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        if (prev <= 6 && prev > 1 && !isMuted) {
          playTickSound();
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Exit confirmation handlers
  const handleExitPress = () => {
    pauseTimer();
    setShowExitModal(true);
  };

  const handleExitConfirm = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowExitModal(false);
    router.replace('/');
  };

  const handleExitCancel = () => {
    setShowExitModal(false);
    if (answerState === 'none' && !gameOver) {
      resumeTimer();
    }
  };

  const startTimer = () => {
    questionStartTime.current = Date.now();
    setTimer(20);
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        // Tick sound in last 5 seconds
        if (prev <= 6 && prev > 1 && !isMuted) {
          playTickSound();
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeout = () => {
    if (answerState !== 'none') return;
    setAnswerState('wrong');
    handleWrongAnswer();
  };

  const handleAnswer = (optionId: string) => {
    if (answerState !== 'none' || gameOver || !quiz) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    const question = quiz.questions[currentIndex];
    const timeTaken = (Date.now() - questionStartTime.current) / 1000;
    const isSpeedBonus = timeTaken <= 5;
    
    const normalizedSelected = String(optionId).trim().toUpperCase();
    const normalizedCorrect = String(question.correct_option).trim().toUpperCase();
    const isCorrect = normalizedSelected === normalizedCorrect;
    
    console.log('[Quiz] Answer:', { selected: normalizedSelected, correct: normalizedCorrect, isCorrect });
    
    setSelectedAnswer(optionId);
    setAnswerState(isCorrect ? 'correct' : 'wrong');
    
    if (isCorrect) {
      let points = question.points;
      if (isSpeedBonus) {
        points += 5;
        setSpeedBonus((prev) => prev + 5);
        showBonusAnimation();
        playBonusSound();
      } else {
        playCorrectSound();
      }
      setScore((prev) => prev + points);
      setCorrectCount((prev) => prev + 1);
      
      // Scale animation for correct
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
      
      // Go to next question after delay
      setTimeout(nextQuestion, 1500);
    } else {
      handleWrongAnswer();
    }
  };

  const handleWrongAnswer = () => {
    playWrongSound();
    if (vibrationEnabled && Platform.OS !== 'web') {
      Vibration.vibrate(200);
    }
    
    // Shake animation for wrong
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    
    // Use ref to track lives to avoid closure issues
    const currentLives = livesRef.current;
    const newLives = currentLives - 1;
    livesRef.current = newLives;
    setLives(newLives);
    
    console.log('[Quiz] Lives:', { current: currentLives, new: newLives });
    
    if (newLives <= 0) {
      // Game over - no more lives
      setGameOver(true);
      console.log('[Quiz] Game Over! No lives left');
      setTimeout(async () => {
        try {
          console.log('[Quiz] Navigating to result...');
          await endGame();
        } catch (e) {
          console.error('[Quiz] Error in endGame:', e);
          // Fallback navigation
          router.replace('/result');
        }
      }, 1500);
    } else {
      // Still have lives - continue
      setTimeout(nextQuestion, 1500);
    }
  };

  const showBonusAnimation = () => {
    bonusAnim.setValue(0);
    Animated.sequence([
      Animated.timing(bonusAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(bonusAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const nextQuestion = () => {
    if (gameOver || !quiz) return;
    
    const nextIdx = currentIndex + 1;
    
    // Episode mode: 25 questions max
    if (mode === 'episode' && nextIdx >= 25) {
      endGame();
      return;
    }
    
    // Mixed mode: endless until lives run out
    if (nextIdx >= quiz.questions.length) {
      endGame();
      return;
    }
    
    setCurrentIndex(nextIdx);
    setAnswerState('none');
    setSelectedAnswer(null);
    startTimer();
  };

  const endGame = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    console.log('[Quiz] endGame called, score:', score, 'mode:', mode);
    
    // Calculate current values using refs for reliability
    const finalScore = score;
    const finalCorrectCount = correctCount;
    const finalSpeedBonus = speedBonus;
    const finalQuestionsAnswered = currentIndex + 1;
    
    // Default result params (in case API fails)
    const baseParams = {
      mode,
      score: finalScore.toString(),
      correctCount: finalCorrectCount.toString(),
      speedBonus: finalSpeedBonus.toString(),
      isNewRecord: '0',
      bestScore: finalScore.toString(),
    };
    
    try {
      if (mode === 'mixed') {
        const result = await submitMixedScore(finalScore, finalCorrectCount, finalSpeedBonus, finalQuestionsAnswered);
        console.log('[Quiz] Mixed score submitted:', result);
        router.replace({
          pathname: '/result',
          params: {
            ...baseParams,
            questionsAnswered: finalQuestionsAnswered.toString(),
            isNewRecord: result.is_new_record ? '1' : '0',
            bestScore: result.best_score.toString(),
          },
        });
      } else {
        const result = await submitEpisodeScore(episodeId, finalScore, finalCorrectCount, finalSpeedBonus);
        console.log('[Quiz] Episode score submitted:', result);
        router.replace({
          pathname: '/result',
          params: {
            ...baseParams,
            episodeId: episodeId.toString(),
            totalQuestions: '25',
            isNewRecord: result.is_new_record ? '1' : '0',
            bestScore: result.best_score.toString(),
          },
        });
      }
    } catch (e) {
      console.error('[Quiz] Error saving score:', e);
      // Still navigate to result screen even if API fails
      if (mode === 'mixed') {
        router.replace({
          pathname: '/result',
          params: {
            ...baseParams,
            questionsAnswered: finalQuestionsAnswered.toString(),
          },
        });
      } else {
        router.replace({
          pathname: '/result',
          params: {
            ...baseParams,
            episodeId: episodeId.toString(),
            totalQuestions: '25',
          },
        });
      }
    }
  };

  if (loading || !quiz) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#009688" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = quiz.questions[currentIndex];
  const totalQuestions = mode === 'episode' ? 25 : quiz.questions.length;
  const isSpeedBonusActive = timer > 15;
  const timerDanger = timer <= 5;

  return (
    <SafeAreaView style={styles.container}>
      {/* Exit Confirmation Modal */}
      <Modal
        visible={showExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleExitCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="exit-outline" size={48} color="#ff6b6b" />
            <Text style={styles.modalTitle}>Oyundan Çık</Text>
            <Text style={styles.modalText}>
              Oyundan çıkmak istediğinize emin misiniz?{'\n'}
              İlerlemeniz kaydedilmeyecek.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={handleExitCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton} 
                onPress={handleExitConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Evet, Çık</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Top Bar */}
      <View style={styles.topBar}>
        {/* Exit Button */}
        <TouchableOpacity 
          style={styles.exitButton} 
          onPress={handleExitPress}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#888" />
        </TouchableOpacity>

        {/* Lives */}
        <View style={styles.livesContainer}>
          {[1, 2, 3].map((i) => (
            <Ionicons
              key={i}
              name={i <= lives ? 'heart' : 'heart-outline'}
              size={24}
              color={i <= lives ? '#ff6b6b' : '#444'}
            />
          ))}
        </View>
        
        {/* Score */}
        <View style={styles.scoreContainer}>
          <Ionicons name="star" size={20} color="#ffc107" />
          <Text style={styles.scoreText}>{score}</Text>
        </View>
        
        {/* Question Counter */}
        <Text style={styles.questionCounter}>
          {currentIndex + 1} / {totalQuestions}
        </Text>
      </View>

      {/* Timer Bar */}
      <View style={styles.timerContainer}>
        <View style={[styles.timerBar, { width: `${(timer / 20) * 100}%` }, timerDanger && styles.timerDanger]} />
        <Text style={[styles.timerText, timerDanger && styles.timerTextDanger]}>{timer}s</Text>
      </View>

      {/* Speed Bonus Indicator */}
      {isSpeedBonusActive && answerState === 'none' && (
        <View style={styles.speedBonusIndicator}>
          <Text style={styles.speedBonusText}>🔥 +5 HIZLI CEVAP</Text>
        </View>
      )}

      {/* Floating Bonus Animation */}
      <Animated.View
        style={[
          styles.floatingBonus,
          {
            opacity: bonusAnim,
            transform: [{ translateY: bonusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }],
          },
        ]}
      >
        <Text style={styles.floatingBonusText}>+5 SÜPER ZEKA!</Text>
      </Animated.View>

      {/* Question */}
      <Animated.View style={[styles.questionContainer, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>{currentQuestion.difficulty.toUpperCase()}</Text>
        </View>
        <Text style={styles.questionText}>{currentQuestion.text}</Text>
      </Animated.View>

      {/* Options */}
      <Animated.View style={[styles.optionsContainer, { transform: [{ scale: scaleAnim }] }]}>
        {currentQuestion.options.map((option) => {
          const normalizedOptionId = String(option.id).trim().toUpperCase();
          const normalizedCorrectId = String(currentQuestion.correct_option).trim().toUpperCase();
          const normalizedSelectedId = selectedAnswer ? String(selectedAnswer).trim().toUpperCase() : null;
          
          const isSelected = normalizedSelectedId === normalizedOptionId;
          const isCorrectOption = normalizedOptionId === normalizedCorrectId;
          
          let optionStyle = [styles.optionButton];
          let textStyle = [styles.optionText];
          
          if (answerState !== 'none') {
            if (isCorrectOption) {
              optionStyle.push(styles.correctOption);
              textStyle.push(styles.selectedText);
            } else if (isSelected) {
              optionStyle.push(styles.wrongOption);
              textStyle.push(styles.selectedText);
            }
          }
          
          return (
            <TouchableOpacity
              key={option.id}
              style={optionStyle}
              onPress={() => handleAnswer(option.id)}
              disabled={answerState !== 'none'}
              activeOpacity={0.8}
            >
              <View style={styles.optionLetter}>
                <Text style={styles.optionLetterText}>{option.id}</Text>
              </View>
              <Text style={textStyle} numberOfLines={2}>{option.text}</Text>
              {answerState !== 'none' && isCorrectOption && (
                <Ionicons name="checkmark-circle" size={24} color="#fff" style={styles.optionIcon} />
              )}
              {answerState !== 'none' && isSelected && !isCorrectOption && (
                <Ionicons name="close-circle" size={24} color="#fff" style={styles.optionIcon} />
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#2d2d44',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#3d3d54',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#ff6b6b',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Top Bar Styles
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  livesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,193,7,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffc107',
  },
  questionCounter: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  timerContainer: {
    height: 8,
    backgroundColor: '#2d2d44',
    marginHorizontal: 16,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  timerBar: {
    height: '100%',
    backgroundColor: '#009688',
    borderRadius: 4,
  },
  timerDanger: {
    backgroundColor: '#ff6b6b',
  },
  timerText: {
    position: 'absolute',
    right: 8,
    top: -20,
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  timerTextDanger: {
    color: '#ff6b6b',
  },
  speedBonusIndicator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,152,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  speedBonusText: {
    color: '#ff9800',
    fontWeight: 'bold',
    fontSize: 12,
  },
  floatingBonus: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    backgroundColor: '#ff9800',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 100,
  },
  floatingBonusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  questionContainer: {
    padding: 20,
    marginTop: 16,
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  difficultyText: {
    color: '#009688',
    fontSize: 12,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 28,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  correctOption: {
    backgroundColor: '#2e7d32',
    borderColor: '#4caf50',
  },
  wrongOption: {
    backgroundColor: '#c62828',
    borderColor: '#f44336',
  },
  optionLetter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  selectedText: {
    fontWeight: '600',
  },
  optionIcon: {
    marginLeft: 'auto',
  },
});
