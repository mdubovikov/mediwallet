import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TestResult } from '@/types/test-result';

type SortOption = 'date' | 'alphabet' | 'group';

export default function TestResultsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [sortedResults, setSortedResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date');

  const loadTestResults = async () => {
    try {
      // Import database functions
      const { getAllTestResults } = await import('@/services/database');
      const results = await getAllTestResults();
      setTestResults(results);
      applySorting(results, sortBy);
    } catch (error) {
      console.error('Error loading test results:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applySorting = (results: TestResult[], sortOption: SortOption) => {
    let sorted: TestResult[] = [...results];

    switch (sortOption) {
      case 'date':
        // Sort by date (newest first)
        sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        break;

      case 'alphabet':
        // Sort alphabetically by test type
        sorted.sort((a, b) => {
          const typeA = a.testType.toLowerCase();
          const typeB = b.testType.toLowerCase();
          return typeA.localeCompare(typeB);
        });
        break;

      case 'group':
        // Sort by test type (group), then by date within each group
        sorted.sort((a, b) => {
          const typeA = a.testType.toLowerCase();
          const typeB = b.testType.toLowerCase();
          if (typeA !== typeB) {
            return typeA.localeCompare(typeB);
          }
          // If same type, sort by date (newest first)
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        break;
    }

    setSortedResults(sorted);
  };

  const handleSortChange = () => {
    Alert.alert(
      'Sort Tests',
      'Choose sorting option:',
      [
        {
          text: 'By Date (Newest First)',
          onPress: () => {
            setSortBy('date');
            applySorting(testResults, 'date');
          },
        },
        {
          text: 'Alphabetically',
          onPress: () => {
            setSortBy('alphabet');
            applySorting(testResults, 'alphabet');
          },
        },
        {
          text: 'By Group (Type)',
          onPress: () => {
            setSortBy('group');
            applySorting(testResults, 'group');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadTestResults();
    }, [])
  );

  useEffect(() => {
    if (testResults.length > 0) {
      applySorting(testResults, sortBy);
    }
  }, [sortBy]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTestResults();
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTestResult = ({ item }: { item: TestResult }) => (
    <TouchableOpacity
      style={[styles.card, isDark && styles.cardDark]}
      onPress={() => {
        router.push(`/test-detail/${item.id}`);
      }}
    >
      <View style={styles.cardContent}>
        <Image source={{ uri: item.imagePath }} style={styles.thumbnail} contentFit="cover" />
        <View style={styles.cardInfo}>
          <ThemedText style={styles.testType}>{item.testType}</ThemedText>
          <ThemedText style={styles.date}>{formatDate(item.createdAt)}</ThemedText>
          {item.notes && (
            <ThemedText style={styles.notes} numberOfLines={2}>
              {item.notes}
            </ThemedText>
          )}
        </View>
        <Ionicons name="chevron-forward" size={24} color={isDark ? '#ccc' : '#666'} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Test Results' }} />
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Test Results',
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity onPress={handleSortChange} style={styles.sortButton}>
              <Ionicons name="swap-vertical" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          ),
        }}
      />
      {testResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={80} color="#ccc" />
          <ThemedText style={styles.emptyText}>No test results yet</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Scan your first test to get started
          </ThemedText>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.sortIndicator,
              {
                backgroundColor: isDark ? '#2c2c2c' : '#f5f5f5',
                borderBottomColor: isDark ? '#444' : '#e0e0e0',
              },
            ]}
          >
            <ThemedText style={styles.sortText}>
              Sorted by: {sortBy === 'date' ? 'Date' : sortBy === 'alphabet' ? 'Alphabet' : 'Group'}
            </ThemedText>
          </View>
          <FlatList
            data={sortedResults}
            renderItem={renderTestResult}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: '#2c2c2c',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  testType: {
    fontSize: 16,
    fontWeight: '600',
  },
  date: {
    fontSize: 14,
    opacity: 0.6,
  },
  notes: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 8,
    textAlign: 'center',
  },
  sortButton: {
    padding: 8,
    marginRight: 8,
  },
  sortIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  sortText: {
    fontSize: 14,
    opacity: 0.7,
    fontWeight: '500',
  },
});

