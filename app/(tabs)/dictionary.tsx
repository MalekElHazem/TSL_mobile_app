import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Search, X } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import Papa from 'papaparse';
import * as FileSystem from 'expo-file-system';
import { typography, spacing, borderRadius, shadows } from '@/utils/theme';
import { signsMapping } from '@/utils/signsMapping';
import { ensureCSVExists } from '@/utils/fileUtils';

interface Sign {
  label: string;
  arabic: string;
  french: string;
  video: string;
}

export default function DictionaryScreen() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [signs, setSigns] = useState<Sign[]>([]);
  const [filteredSigns, setFilteredSigns] = useState<Sign[]>([]);
  
  useEffect(() => {
    loadSignsCSV();
  }, []);
  
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSigns(signs);
    } else {
      const filtered = signs.filter(sign => 
        sign.arabic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sign.french.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSigns(filtered);
    }
  }, [searchQuery, signs]);

  const loadSignsCSV = async () => {
    try {
      const csvPath = await ensureCSVExists();
      const csvString = await FileSystem.readAsStringAsync(csvPath);
      const { data } = Papa.parse(csvString, { header: true });
      setSigns(data as Sign[]);
      setFilteredSigns(data as Sign[]);
    } catch (error) {
      console.error('Error loading signs:', error);
    }
  };
  
  const renderItem = ({ item }: { item: Sign }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: theme.card }]}
      onPress={() => setSelectedSign(selectedSign === item.label ? null : item.label)}
    >
      <View style={styles.textContainer}>
        <Text style={[styles.arabic, { color: theme.text }]}>{item.arabic}</Text>
        <Text style={[styles.french, { color: theme.textSecondary }]}>{item.french}</Text>
      </View>
      {selectedSign === item.label && (
        <Video
          source={signsMapping[item.video.replace('.mp4', '')]}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
            <Search size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search in Arabic or French..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          
      {/* Signs List */}
      <FlatList
        data={filteredSigns}
        renderItem={renderItem}
        keyExtractor={(item) => item.label}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.m,
    padding: spacing.s,
    borderRadius: borderRadius.medium,
    ...shadows.small,
  },
  searchIcon: {
    marginRight: spacing.s,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.regular,
  },
  clearButton: {
    padding: spacing.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.m,
  },
  item: {
    padding: spacing.m,
    marginBottom: spacing.m,
    borderRadius: borderRadius.medium,
    ...shadows.small,
  },
  textContainer: {
    marginBottom: spacing.s,
  },
  arabic: {
    fontSize: typography.fontSizes.l,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  french: {
    fontSize: typography.fontSizes.m,
    fontFamily: typography.fontFamily.regular,
  },
  video: {
    width: Dimensions.get('window').width - (spacing.m * 4),
    height: 200,
    borderRadius: borderRadius.small,
  },
});