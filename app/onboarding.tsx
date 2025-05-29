import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Welcome to TunSign',
    description: 'Your gateway to Tunisian Sign Language translation and learning.',
    image: 'https://images.pexels.com/photos/7516509/pexels-photo-7516509.jpeg',
  },
  {
    id: '2',
    title: 'Real-Time Translation',
    description: 'Instantly translate sign language using your camera.',
    image: 'https://images.pexels.com/photos/7516511/pexels-photo-7516511.jpeg',
  },
  {
    id: '3',
    title: 'Learn & Contribute',
    description: 'Practice daily challenges and help grow our sign language database.',
    image: 'https://images.pexels.com/photos/7516507/pexels-photo-7516507.jpeg',
  },
];

export default function Onboarding() {
  const { theme, setIsFirstLaunch } = useTheme();
  const [currentPage, setCurrentPage] = useState(0);

  const handleNext = () => {
    if (currentPage < slides.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    setIsFirstLaunch(false);
    router.replace('/(tabs)');
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View 
        entering={FadeIn}
        exiting={FadeOut}
        style={styles.slideContainer}
      >
        <Image
          source={{ uri: slides[currentPage].image }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={[styles.content, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            {slides[currentPage].title}
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {slides[currentPage].description}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                {
                  backgroundColor: currentPage === index ? theme.primary : theme.disabled,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentPage === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        {currentPage < slides.length - 1 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={finishOnboarding}
          >
            <Text style={[styles.skipText, { color: theme.textSecondary }]}>
              Skip
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
  },
  image: {
    width,
    height: width * 0.8,
  },
  content: {
    flex: 1,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Roboto-Bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: 'Roboto-Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 48,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },
  skipButton: {
    alignItems: 'center',
  },
  skipText: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },
});