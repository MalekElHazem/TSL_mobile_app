import { Tabs } from 'expo-router';
import { Camera, Upload, BookOpenText, Calendar, MessageSquarePlus, Settings } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { typography } from '@/utils/theme';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 30 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Roboto-Medium',
        },
        headerStyle: {
          backgroundColor: theme.card,
        },
        headerTintColor: theme.text,
        headerTitleStyle: {
          fontFamily: 'Roboto-Medium',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Translate',
          tabBarIcon: ({ color, size }) => <Camera size={size} color={color} />,
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="video-upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color }) => <Upload size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="daily-challenge"
        options={{
          title: 'Challenge',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{
          title: 'Dictionary',
          tabBarIcon: ({ color, size }) => <BookOpenText size={size} color={color} />,
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="sign-request"
        options={{
          title: 'Request',
          tabBarIcon: ({ color, size }) => <MessageSquarePlus size={size} color={color} />,
          headerShown: true,
        }}
      />
      {/* <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      /> */}
    </Tabs>
  );
}