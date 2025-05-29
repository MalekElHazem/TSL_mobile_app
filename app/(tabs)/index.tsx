import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { CameraOff, FlipHorizontal, Hand, Volume2 } from 'lucide-react-native';
import { typography, spacing, borderRadius } from '@/utils/theme';
import { api } from '@/services/api';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';

export default function TranslationScreen() {
  const { theme } = useTheme();
  const [permission, requestPermission] = Platform.OS !== 'web' 
    ? useCameraPermissions() 
    : [{ granted: false }, () => {}];
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prediction, setPrediction] = useState<{ text: string; confidence: number } | null>(null);
  const cameraRef = useRef<any>(null);
  const videoUriRef = useRef<string | null>(null);
  const recordingTimeout = useRef<NodeJS.Timeout | number | null>(null);
  
  const predictionOpacity = useSharedValue(0);
  const predictionScale = useSharedValue(0.9);

  const animatedPredictionStyle = useAnimatedStyle(() => {
    return {
      opacity: predictionOpacity.value,
      transform: [{ scale: predictionScale.value }]
    };
  });

  const startRecording = async () => {
    if (!cameraRef.current) return;
    try {
      setIsRecording(true);
      setPrediction(null);
      predictionOpacity.value = 0;
      predictionScale.value = 0.9;
      // Start video recording
      const videoPromise = cameraRef.current.recordAsync({
        quality: '720p',
        maxDuration: 3, // 3 seconds
        mute: true,
      });
      // Automatically stop after 3 seconds
      recordingTimeout.current = setTimeout(() => {
        stopRecording();
      }, 3000);
      const video = await videoPromise;
      videoUriRef.current = video.uri;
      await processVideo(video.uri);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (recordingTimeout.current) {
      clearTimeout(recordingTimeout.current);
      recordingTimeout.current = null;
    }
    if (cameraRef.current && isRecording) {
      try {
        await cameraRef.current.stopRecording();
      } catch (error) {
        // Ignore if already stopped
      }
    }
    setIsRecording(false);
  };

  const processVideo = async (videoUri: string) => {
    setIsProcessing(true);
    try {
      // Read the video file as a blob
      const videoInfo = await FileSystem.getInfoAsync(videoUri);
      if (!videoInfo.exists) throw new Error('Video file not found');
      const videoBlob = await uriToBlob(videoUri);
      // Send the video blob to the backend
      const result = await api.predictVideo(videoBlob);
      setPrediction({
        text: result.predicted_class,
        confidence: result.confidence_score,
      });
          // Animate prediction appearance
          predictionOpacity.value = withSpring(1);
          predictionScale.value = withSpring(1);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error processing video:', error);
      Alert.alert('Error', 'Failed to process the sign language video.');
    } finally {
      setIsProcessing(false);
      // Clean up video file
      if (videoUriRef.current) {
        FileSystem.deleteAsync(videoUriRef.current, { idempotent: true }).catch(() => {});
        videoUriRef.current = null;
      }
    }
  };

  // Helper to convert file URI to Blob
  const uriToBlob = async (uri: string): Promise<Blob> => {
    const response = await fetch(uri);
    return await response.blob();
  };

  const speakText = () => {
    if (prediction) {
      Speech.speak(prediction.text, {
        language: 'en',
        pitch: 1.0,
        rate: 0.9,
      });
    }
  };

  // Toggle camera between front and back
  const toggleCameraType = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimeout.current) {
        clearTimeout(recordingTimeout.current);
      }
      if (videoUriRef.current) {
        FileSystem.deleteAsync(videoUriRef.current, { idempotent: true }).catch(() => {});
      }
    };
  }, []);

  // Request camera permission if not granted
  if (!permission) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }
  
  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <CameraOff size={64} color={theme.textSecondary} />
        <Text style={[styles.message, { color: theme.text, fontFamily: typography.fontFamily.regular }]}>
          We need camera permission to translate sign language
        </Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={requestPermission}
        >
          <Text style={[styles.buttonText, { color: '#fff', fontFamily: typography.fontFamily.medium }]}>
            Grant Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <CameraView 
        ref={cameraRef}
        style={styles.camera} 
        facing={cameraType}
      >
        <View style={styles.overlay}>
          <View style={styles.guideFrame}>
            <Hand 
              size={48} 
              color="rgba(255, 255, 255, 0.8)" 
              style={{ alignSelf: 'center', marginTop: 120 }} 
            />
          </View>
        </View>
        
        {prediction && !isProcessing && (
        <Animated.View style={[
          styles.predictionContainer, 
          { backgroundColor: theme.card },
          animatedPredictionStyle
        ]}>
          <Text style={[styles.predictionLabel, { color: theme.textSecondary }]}>
            Detected Sign:
          </Text>
          <Text style={[styles.predictionText, { color: theme.text }]}>
              {prediction.text}
            </Text>
            <Text style={[styles.confidenceText, { color: theme.textSecondary }]}>
              Confidence: {(prediction.confidence * 100).toFixed(1)}%
          </Text>
            <TouchableOpacity
              style={[styles.speakButton, { backgroundColor: theme.primary }]}
              onPress={speakText}
            >
              <Volume2 size={24} color="#fff" />
            </TouchableOpacity>
        </Animated.View>
        )}
        
        <View style={styles.controls}>
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            onPress={toggleCameraType}
          >
            <FlipHorizontal size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.recordButton,
              { backgroundColor: isRecording ? theme.error : theme.primary }
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>
              {isRecording ? 'Stop' : 'Start'}
            </Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  recordButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  predictionContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  predictionLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  predictionText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  confidenceText: {
    fontSize: 14,
    marginBottom: 10,
  },
  speakButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
});