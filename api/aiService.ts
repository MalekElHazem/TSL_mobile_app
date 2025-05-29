import { Platform } from 'react-native';
import { ensureCSVExists } from '@/utils/fileUtils';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';

// Types
interface DailyChallenge {
  id: string;
  date: string;
  word: string;
  description: string;
  videoUrl: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface SignData {
  id: string;
  word: string;
  videoUrl: string;
  imageUrl: string;
  description: string;
  language: 'arabic' | 'french';
  usageExamples: string[];
  popularity: number; // 1-5 scale
}

interface ChallengeSubmission {
  challengeId: string;
  videoUri: string;
}

interface SignRequest {
  word: string;
  language: 'arabic' | 'french';
  description: string;
  context: string;
  priority: boolean;
  contactEmail: string;
}

interface Sign {
  label: string;
  arabic: string;
  french: string;
  video: string;
}

// This would be replaced with a real API client in production
const MOCK_DELAY = Platform.OS === 'web' ? 500 : 1000;

// Mock function to predict sign from video
export const predictSignFromVideo = async (videoUri: string): Promise<string> => {
  console.log('Processing video:', videoUri);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // In a real app, this would send the video to a backend API
  return 'Hello';
};

// Mock function for real-time prediction
export const predictRealTime = async (frameData: string): Promise<string> => {
  console.log('Processing frame:', frameData);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // In a real app, this would send the frame to a backend API
  // For now, randomly return one of several Tunisian signs
  const signs = ['Hello', 'Thank you', 'Welcome', 'Please', 'Yes', 'No'];
  return signs[Math.floor(Math.random() * signs.length)];
};

// Mock function to submit daily challenge
export const submitDailyChallenge = async (data: { challengeId: string; videoUri: string }) => {
  // TODO: Implement actual submission to server
  // For now, just simulate a successful submission
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 2000);
  });
};

// Mock function to get sign for word
export const getSignForWord = async (word: string): Promise<SignData[]> => {
  console.log('Searching for word:', word);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // Mock sign data
  const signs: SignData[] = [
    {
      id: 'sign-1',
      word: 'Hello',
      videoUrl: 'https://example.com/videos/hello.mp4',
      imageUrl: 'https://images.pexels.com/photos/7516509/pexels-photo-7516509.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      description: 'A common greeting sign performed by waving the hand.',
      language: 'french',
      usageExamples: [
        'Hello, how are you?',
        'I said hello to my neighbor this morning.'
      ],
      popularity: 5,
    },
    {
      id: 'sign-2',
      word: 'Thank you',
      videoUrl: 'https://example.com/videos/thankyou.mp4',
      imageUrl: 'https://images.pexels.com/photos/7516511/pexels-photo-7516511.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      description: 'A sign of gratitude performed by touching the chin and moving the hand forward.',
      language: 'french',
      usageExamples: [
        'Thank you for your help',
        'I want to thank you for everything you\'ve done'
      ],
      popularity: 4,
    },
    {
      id: 'sign-3',
      word: 'Welcome',
      videoUrl: 'https://example.com/videos/welcome.mp4',
      imageUrl: 'https://images.pexels.com/photos/7516507/pexels-photo-7516507.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      description: 'A welcoming gesture performed with both hands extended.',
      language: 'french',
      usageExamples: [
        'Welcome to our home',
        'You are welcome to join us anytime'
      ],
      popularity: 3,
    }
  ];
  
  // In a real app, this would query a backend API
  if (word === 'popular') {
    // Return all signs sorted by popularity
    return [...signs].sort((a, b) => b.popularity - a.popularity);
  }
  
  // Filter signs that match the search term
  const filteredSigns = signs.filter(sign => 
    sign.word.toLowerCase().includes(word.toLowerCase()) ||
    sign.description.toLowerCase().includes(word.toLowerCase())
  );
  
  return filteredSigns;
};

// Mock function to submit sign request
export const submitSignRequest = async (request: SignRequest): Promise<void> => {
  console.log('Submitting sign request:', request);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // In a real app, this would submit to a backend API
  return;
};