import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { Circle, Trophy, Calendar, Camera as CameraIcon, VideoIcon, CheckCircle, Play } from 'lucide-react-native';
import { submitDailyChallenge } from '@/api/aiService';
import { typography, spacing, borderRadius, shadows } from '@/utils/theme';
import { signsMapping } from '@/utils/signsMapping';
import { ensureCSVExists, getCSVPath } from '@/utils/fileUtils';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/services/api';

type ChallengeStatus = 'ready' | 'recording' | 'preview' | 'submitting' | 'completed';

interface DailyChallenge {
  id: string;
  date: string;
  word: string;
  description: string;
  videoUrl: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Sign {
  label: string;
  arabic: string;
  french: string;
  video: string;
}

interface CameraPermissionState {
  granted: boolean | null;
  canAskAgain?: boolean;
}

interface UserStats {
  totalScore: number;
  streak: number;
  lastChallengeDate: string;
  challengesCompleted: number;
}

export default function DailyChallengeScreen() {
  const { theme } = useTheme();
  const [status, setStatus] = useState<ChallengeStatus>('ready');
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Handle camera permissions based on platform
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>({ granted: null });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dailySign, setDailySign] = useState<Sign | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  
  // Load user stats
  const [userStats, setUserStats] = useState<UserStats>({
    totalScore: 0,
    streak: 0,
    lastChallengeDate: '',
    challengesCompleted: 0
  });
  
  // Load or initialize daily sign
  useEffect(() => {
    loadDailySign();
  }, []);

  const loadDailySign = async () => {
    try {
      // Get last update date
      const lastUpdate = await AsyncStorage.getItem('lastDailySignUpdate');
      const today = new Date().toDateString();
      
      // If no update today, get new sign
      if (lastUpdate !== today) {
        const newSign = await getRandomSign();
        await AsyncStorage.setItem('dailySign', JSON.stringify(newSign));
        await AsyncStorage.setItem('lastDailySignUpdate', today);
        setDailySign(newSign);
      } else {
        // Load existing sign
        const storedSign = await AsyncStorage.getItem('dailySign');
        if (storedSign) {
          setDailySign(JSON.parse(storedSign));
        }
      }
    } catch (error) {
      console.error('Error loading daily sign:', error);
      Alert.alert('Error', 'Failed to load daily challenge');
    }
  };

  const getRandomSign = async (): Promise<Sign> => {
    try {
      const csvPath = await getCSVPath();
      const csvContent = await FileSystem.readAsStringAsync(csvPath);
      const lines = csvContent.split('\n').slice(1); // Skip header
      const randomIndex = Math.floor(Math.random() * lines.length);
      const [label, arabic, french, video] = lines[randomIndex].split(',');
      return { label, arabic, french, video };
    } catch (error) {
      console.error('Error getting random sign:', error);
      throw error;
    }
  };
  
  // Fetch daily challenge
  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const csvPath = await ensureCSVExists();
        const csvString = await FileSystem.readAsStringAsync(csvPath);
        const { data } = Papa.parse(csvString, { header: true });
        const signs = data as Sign[];
        
        // Randomly select a sign
        const randomIndex = Math.floor(Math.random() * signs.length);
        const sign = signs[randomIndex];
        
        console.log('Selected sign:', sign); // Debug log
        
        setChallenge({
          id: sign.label, // Use the label as ID
          date: new Date().toISOString().split('T')[0],
          word: sign.arabic, // Show Arabic text
          description: `Sign "${sign.arabic}" (${sign.french}) in Tunisian Sign Language`,
          videoUrl: sign.label, // Use label to get video from signsMapping
          difficulty: 'medium' as const,
        });
      } catch (error) {
        console.error('Error fetching challenge:', error);
        Alert.alert('Error', 'Failed to load daily challenge. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchChallenge();
  }, []);
  
  // Load user stats
  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const stats = await AsyncStorage.getItem('userStats');
      if (stats) {
        setUserStats(JSON.parse(stats));
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const updateUserStats = async (accuracy: number) => {
    try {
      const today = new Date().toDateString();
      const lastDate = new Date(userStats.lastChallengeDate);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Calculate streak
      let newStreak = userStats.streak;
      if (userStats.lastChallengeDate === yesterday.toDateString()) {
        newStreak += 1;
      } else if (userStats.lastChallengeDate !== today) {
        newStreak = 1;
      }

      // Calculate score based on accuracy
      const baseScore = Math.floor(accuracy * 100);
      const streakBonus = Math.floor(newStreak * 10);
      const totalScore = baseScore + streakBonus;

      const newStats: UserStats = {
        totalScore: userStats.totalScore + totalScore,
        streak: newStreak,
        lastChallengeDate: today,
        challengesCompleted: userStats.challengesCompleted + 1
      };

      await AsyncStorage.setItem('userStats', JSON.stringify(newStats));
      setUserStats(newStats);

      return { baseScore, streakBonus, totalScore };
    } catch (error) {
      console.error('Error updating user stats:', error);
      return { baseScore: 0, streakBonus: 0, totalScore: 0 };
    }
  };

  // Request permissions for media library
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      try {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();
        
        if (!cameraPermission.granted) {
          Alert.alert(
            'Camera Permission Required',
            'Please grant camera permission to record videos',
            [{ text: 'OK' }]
          );
          return false;
        }
        
        if (!mediaLibraryPermission.granted) {
          Alert.alert(
            'Media Library Permission Required',
            'Please grant media library permission to save videos',
            [{ text: 'OK' }]
          );
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('Error requesting permissions:', error);
        return false;
      }
    }
    return true;
  };

  // Start video recording
  const startRecording = async () => {
    const hasPermission = await requestPermissions();
    
    if (!hasPermission) {
      Alert.alert('Permission Required', 'We need camera and media library permissions to record videos');
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        videoMaxDuration: 3,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
        videoQuality: 1,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setRecordedVideo(result.assets[0].uri);
        setStatus('preview');
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };
  
  // Upload from library
  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setRecordedVideo(result.assets[0].uri);
        setStatus('preview');
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error picking video:', error);
    }
  };
  
  // Process video with AI
  const processVideo = async () => {
    if (!recordedVideo || !challenge) return;
    
    try {
      setIsProcessing(true);
      
      // Create FormData
      const formData = new FormData();
      
      // For Android/iOS, we can append the URI directly
      formData.append('file', {
        uri: recordedVideo,
        type: 'video/mp4',
        name: 'video.mp4'
      } as any);
      
      // Add metadata about the video
      formData.append('metadata', JSON.stringify({
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        version: Platform.Version,
        quality: 'highest',
        aspect: '4:3',
        maxDuration: 3,
        expectedSign: challenge.word
      }));
      
      // Send to backend for prediction
      const result = await api.predictVideo(formData);
      const accuracy = (result.confidence_score * 100).toFixed(1);
      
      if (result.confidence_score >= 0.8) {
        const { baseScore, streakBonus, totalScore } = await updateUserStats(result.confidence_score);
        setStatus('completed');
        Alert.alert(
          'Great Job! 🎉',
          `Your sign was recognized with ${accuracy}% accuracy!\n\n` +
          `Score Breakdown:\n` +
          `Base Score: ${baseScore} points\n` +
          `Streak Bonus: +${streakBonus} points\n` +
          `Total Score: ${totalScore} points\n\n` +
          `Current Streak: ${userStats.streak + 1} days\n` +
          `Total Score: ${userStats.totalScore + totalScore} points`,
          [{ text: 'Continue', onPress: () => setStatus('ready') }]
        );
      } else {
        Alert.alert(
          'Try Again',
          `Your sign was recognized with ${accuracy}% accuracy, which is below our minimum threshold of 80%.\n\n` +
          `Keep practicing to improve your score!\n` +
          `Current Streak: ${userStats.streak} days\n` +
          `Total Score: ${userStats.totalScore} points`,
          [
            { text: 'Try Again', onPress: () => setStatus('ready') },
            { text: 'Skip', onPress: () => setStatus('ready') }
          ]
        );
      }
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error processing video:', error);
      Alert.alert('Error', 'Failed to process video. Please try again.');
      setStatus('preview');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Reset to initial state
  const resetChallenge = () => {
    setStatus('ready');
    setRecordedVideo(null);
  };
  
  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return theme.success;
      case 'medium': return theme.warning;
      case 'hard': return theme.error;
      default: return theme.primary;
    }
  };
  
  const toggleVideoPlayback = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading today's challenge...
        </Text>
      </View>
    );
  }
  
  // Challenge content based on status
  const renderContent = () => {
    switch (status) {
      case 'ready':
        return (
          <>
            <View style={[styles.challengeCard, { backgroundColor: theme.card, ...shadows.medium }]}>
              <View style={styles.challengeHeader}>
                <Calendar size={24} color={theme.primary} />
                <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                  {challenge?.date || new Date().toLocaleDateString()}
                </Text>
                <View style={[
                  styles.difficultyBadge, 
                  { backgroundColor: getDifficultyColor(challenge?.difficulty || 'medium') }
                ]}>
                  <Text style={styles.difficultyText}>
                    {challenge?.difficulty?.toUpperCase() || 'MEDIUM'}
                  </Text>
                </View>
              </View>
              
              <Text style={[styles.challengeTitle, { color: theme.text }]}>
                {challenge?.word || 'Hello'}
              </Text>
              
              <Text style={[styles.challengeDescription, { color: theme.textSecondary }]}>
                {challenge?.description || 'Sign the greeting "Hello" in Tunisian Sign Language'}
              </Text>
              
              <TouchableOpacity 
                style={styles.videoContainer}
                onPress={toggleVideoPlayback}
                activeOpacity={0.8}
              >
                <Video
                  ref={videoRef}
                  source={challenge?.videoUrl ? signsMapping[challenge.videoUrl] : undefined}
                  style={styles.exampleVideo}
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping
                  shouldPlay={false}
                  useNativeControls={false}
                />
                {!isPlaying && (
                  <View style={styles.videoOverlay}>
                    <Play size={40} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.primary, ...shadows.small }]}
                onPress={startRecording}
              >
                <CameraIcon size={24} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Record Attempt</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={pickFromLibrary}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  Upload from Library
                </Text>
              </TouchableOpacity>
            </View>
          </>
        );
        
      case 'recording':
        return (
          <View style={styles.recordingContainer}>
            {renderCameraView()}
          </View>
        );
        
      case 'preview':
        return (
          <View style={styles.previewContainer}>
            <Text style={[styles.previewTitle, { color: theme.text }]}>
              Review Your Attempt
            </Text>
            
            {renderVideoPreview()}
            
            <View style={styles.previewActions}>
              <TouchableOpacity 
                style={[styles.previewButton, { backgroundColor: theme.error }]}
                onPress={resetChallenge}
              >
                <Text style={styles.previewButtonText}>Retake</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.previewButton, { backgroundColor: theme.success }]}
                onPress={processVideo}
              >
                <Text style={styles.previewButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
        
      case 'submitting':
        return (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.submittingText, { color: theme.text }]}>
              Submitting your challenge...
            </Text>
          </View>
        );
        
      case 'completed':
        return (
          <View style={styles.completedContainer}>
            <CheckCircle size={80} color={theme.success} />
            <Text style={[styles.completedTitle, { color: theme.text }]}>
              Challenge Completed!
            </Text>
            
            <View style={[styles.statsContainer, { backgroundColor: theme.card }]}>
              <View style={styles.statItem}>
                <Trophy size={24} color={theme.primary} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {userStats.challengesCompleted}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Challenges Completed
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Circle size={24} color={theme.warning} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {userStats.streak}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Day Streak
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Calendar size={24} color={theme.success} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {userStats.totalScore}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Total Score
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.completedButton, { backgroundColor: theme.primary }]}
              onPress={resetChallenge}
            >
              <Text style={styles.completedButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );
        
      default:
        return null;
    }
  };
  
  // Update camera view rendering
  const renderCameraView = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.webCameraPlaceholder, { backgroundColor: theme.card }]}>
          <Text style={[styles.webCameraText, { color: theme.text }]}>
            Camera preview not available on web
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <TouchableOpacity
          style={[styles.recordButton, { backgroundColor: theme.primary }]}
          onPress={startRecording}
        >
          <CameraIcon size={24} color="#fff" />
          <Text style={styles.recordButtonText}>Start Recording</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Update video preview rendering
  const renderVideoPreview = () => (
    <View style={[styles.videoPreview, { borderColor: theme.border, ...shadows.small }]}>
      {recordedVideo && (
        <Video
          ref={videoRef}
          source={{ uri: recordedVideo }}
          style={styles.previewVideo}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay={false}
        />
      )}
    </View>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.l,
  },
  loadingText: {
    marginTop: spacing.m,
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
  },
  challengeCard: {
    borderRadius: borderRadius.medium,
    padding: spacing.l,
    marginBottom: spacing.l,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  dateText: {
    marginLeft: spacing.s,
    fontSize: typography.fontSizes.s,
    fontFamily: typography.fontFamily.medium,
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.small,
  },
  difficultyText: {
    color: '#fff',
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.bold,
  },
  challengeTitle: {
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.s,
  },
  challengeDescription: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.l,
    lineHeight: typography.lineHeights.body * typography.fontSizes.m,
  },
  videoContainer: {
    height: 200,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  exampleVideo: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    marginTop: spacing.m,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.m,
  },
  buttonIcon: {
    marginRight: spacing.s,
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
  },
  secondaryButton: {
    paddingVertical: spacing.m,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
  },
  recordingContainer: {
    flex: 1,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  recordButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.m,
    borderRadius: borderRadius.medium,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
  },
  previewContainer: {
    flex: 1,
  },
  previewTitle: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.l,
    textAlign: 'center',
  },
  videoPreview: {
    height: 400,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: spacing.l,
  },
  previewVideo: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewButton: {
    flex: 1,
    paddingVertical: spacing.m,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    marginHorizontal: spacing.s,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submittingText: {
    fontSize: typography.fontSizes.l,
    fontFamily: typography.fontFamily.medium,
    marginTop: spacing.l,
  },
  completedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
  },
  completedTitle: {
    fontSize: typography.fontSizes.xxl,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.l,
    marginBottom: spacing.s,
  },
  completedSubtitle: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: typography.lineHeights.body * typography.fontSizes.m,
  },
  completedStats: {
    width: '100%',
    borderRadius: borderRadius.medium,
    padding: spacing.l,
    marginBottom: spacing.xl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSizes.xxxl,
    fontFamily: typography.fontFamily.bold,
    marginVertical: spacing.s,
  },
  statLabel: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.regular,
  },
  completedButton: {
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.medium,
  },
  completedButtonText: {
    color: '#fff',
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
  },
  webCameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.medium,
  },
  webCameraText: {
    fontSize: typography.fontSizes.l,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: spacing.l,
    borderRadius: borderRadius.medium,
    marginVertical: spacing.l,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.bold,
    marginVertical: spacing.s,
  },
  statLabel: {
    fontSize: typography.fontSizes.s,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
});