import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '@/context/ThemeContext';
import { Upload, Camera, CheckCircle2, X, Hand, Play, MessageSquare } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api, PredictionResponse } from '@/services/api';
import * as Speech from 'expo-speech';
import { typography, spacing, borderRadius, shadows } from '@/utils/theme';
import { Video, ResizeMode } from 'expo-av';
import { signsMapping, signTranslations } from '@/utils/signsMapping';

interface SignPrediction {
  text: string;
  confidence: number;
  arabic?: string;
  french?: string;
}

interface PhraseResult {
  signs: SignPrediction[];
  arabicPhrase: string;
  frenchPhrase: string;
}

export default function VideoUploadScreen() {
  const { theme } = useTheme();
  const [video, setVideo] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PhraseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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

  // Pick video from library
  const pickVideo = async () => {
    const hasPermission = await requestPermissions();
    
    if (!hasPermission) {
      Alert.alert('Permission Required', 'We need camera and media library permissions to upload videos');
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        videoMaxDuration: 15,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
        videoQuality: 1,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setVideo(result.assets[0].uri);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };
  
  // Record video using camera
  const recordVideo = async () => {
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
        videoMaxDuration: 15,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
        videoQuality: 1,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setVideo(result.assets[0].uri);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };

  // Toggle video playback
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

  // Reset state
  const resetState = () => {
    setVideo(null);
    setPrediction(null);
    setModalVisible(false);
    setIsRecording(false);
    setIsPlaying(false);
  };

  // Process video with AI
  const processVideo = async () => {
    if (!video) return;
    
    try {
      setIsProcessing(true);
      
      // Create FormData
      const formData = new FormData();
      
      // For Android/iOS, we can append the URI directly
      formData.append('file', {
        uri: video,
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
        maxDuration: 15,
      }));
      
      // Send to backend for prediction
      const result = await api.predictVideo(formData);
      
      console.log('Raw API Response:', result);
      
      // Process each detected sign and get translations
      const processedSigns = result.detected_signs.map((sign) => {
        const translations = signTranslations[sign.predicted_class];
        console.log('Processing sign:', {
          predicted_class: sign.predicted_class,
          confidence_score: sign.confidence_score,
          translations: translations
        });
        return {
          text: sign.predicted_class,
          confidence: sign.confidence_score,
          arabic: translations?.arabic,
          french: translations?.french
        };
      });

      console.log('Processed Signs:', processedSigns);

      // Generate phrases
      const arabicPhrase = processedSigns
        .map((sign: SignPrediction) => sign.arabic)
        .filter(Boolean)
        .join(' ');
      
      const frenchPhrase = processedSigns
        .map((sign: SignPrediction) => sign.french)
        .filter(Boolean)
        .join(' ');

      console.log('Generated Phrases:', {
        arabic: arabicPhrase,
        french: frenchPhrase
      });

      setPrediction({
        signs: processedSigns,
        arabicPhrase,
        frenchPhrase
      });
      setModalVisible(true);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error processing video:', error);
      Alert.alert('Error', 'Failed to process video. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Speak the prediction
  const speakText = (language: 'ar' | 'fr') => {
    if (!prediction) return;
    
    const text = language === 'ar' ? prediction.arabicPhrase : prediction.frenchPhrase;
    if (!text) return;

    Speech.speak(text, {
      language: language,
      pitch: 1.0,
      rate: 0.9,
    });
  };

  // Render individual sign
  const renderSign = (sign: SignPrediction, index: number) => (
    <View key={index} style={styles.signContainer}>
      <Text style={[styles.signLabel, { color: theme.textSecondary }]}>
        Sign {index + 1}:
      </Text>
      <View style={styles.signContent}>
        <Text style={[styles.signText, { color: theme.text }]}>
          {sign.arabic}
        </Text>
        <Text style={[styles.signText, { color: theme.text }]}>
          {sign.french}
        </Text>
        <View style={styles.confidenceContainer}>
          <View style={[styles.confidenceBar, { 
            width: `${sign.confidence * 100}%`,
            backgroundColor: sign.confidence > 0.7 ? theme.success : 
                           sign.confidence > 0.4 ? theme.warning : 
                           theme.error 
          }]} />
          <Text style={[styles.confidenceText, { color: theme.textSecondary }]}>
            Confidence: {(sign.confidence * 100).toFixed(1)}%
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <Text style={[styles.title, { color: theme.text }]}>Sign Language Translator</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Record a video with 3-5 signs to translate into a phrase
      </Text>
      
      {/* Video Preview */}
      <View style={[
        styles.previewContainer, 
        { 
          backgroundColor: theme.card,
          borderColor: theme.border,
          ...shadows.medium 
        }
      ]}>
        {video ? (
          <TouchableOpacity 
            style={styles.videoContainer}
            onPress={toggleVideoPlayback}
            activeOpacity={0.8}
          >
            <Video
              ref={videoRef}
              source={{ uri: video }}
              style={styles.videoPreview}
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
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
              onPress={resetState}
            >
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholderContent}>
            <Camera size={48} color={theme.textSecondary} />
            <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
              No video selected
            </Text>
          </View>
        )}
      </View>
      
      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={recordVideo}
        >
          <Camera size={24} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Record Video</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={pickVideo}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
            Choose from Library
          </Text>
        </TouchableOpacity>
        
        {video && (
          <TouchableOpacity 
            style={[styles.processButton, { backgroundColor: theme.success }]}
            onPress={processVideo}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MessageSquare size={24} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Translate Phrase</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Prediction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <CheckCircle2 size={48} color={theme.success} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Translation Complete!
            </Text>
            
            {/* Complete Phrase */}
            <View style={styles.phraseContainer}>
              <Text style={[styles.phraseLabel, { color: theme.textSecondary }]}>
                Arabic:
              </Text>
              <Text style={[styles.phraseText, { color: theme.text }]}>
                {prediction?.arabicPhrase}
              </Text>
              
              <Text style={[styles.phraseLabel, { color: theme.textSecondary }]}>
                French:
              </Text>
              <Text style={[styles.phraseText, { color: theme.text }]}>
                {prediction?.frenchPhrase}
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={() => speakText('ar')}
              >
                <Text style={styles.modalButtonText}>Listen in Arabic</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.secondary }]}
                onPress={() => speakText('fr')}
              >
                <Text style={styles.modalButtonText}>Listen in French</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.error }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.l,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.s,
  },
  subtitle: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.l,
  },
  previewContainer: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    marginBottom: spacing.l,
  },
  videoContainer: {
    height: 300,
    position: 'relative',
    backgroundColor: '#000',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.s,
    right: spacing.s,
    padding: spacing.s,
    borderRadius: borderRadius.round,
  },
  placeholderContent: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: spacing.m,
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
  },
  buttonContainer: {
    gap: spacing.m,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    borderRadius: borderRadius.medium,
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
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    borderRadius: borderRadius.medium,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    padding: spacing.xl,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.bold,
    marginTop: spacing.m,
    marginBottom: spacing.s,
  },
  signsContainer: {
    width: '100%',
    marginBottom: spacing.m,
  },
  signContainer: {
    marginBottom: spacing.m,
  },
  signLabel: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  signContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: spacing.m,
    borderRadius: borderRadius.medium,
  },
  signText: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  phraseContainer: {
    width: '100%',
    marginBottom: spacing.l,
    padding: spacing.m,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: borderRadius.medium,
  },
  phraseLabel: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.s,
  },
  phraseText: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.l,
  },
  confidenceContainer: {
    marginTop: spacing.s,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: borderRadius.small,
    overflow: 'hidden',
    position: 'relative',
  },
  confidenceBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: borderRadius.small,
  },
  confidenceText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: typography.fontSizes.s,
    fontFamily: typography.fontFamily.medium,
  },
  modalButtons: {
    width: '100%',
    gap: spacing.s,
  },
  modalButton: {
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.medium,
  },
});