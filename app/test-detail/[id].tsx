import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TestResult } from '@/types/test-result';

export default function TestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [editedType, setEditedType] = useState('');

  useEffect(() => {
    loadTestResult();
  }, [id]);

  const loadTestResult = async () => {
    try {
      // Import database functions
      const { getTestResultById } = await import('@/services/database');
      const result = await getTestResultById(Number(id));
      setTestResult(result);
      if (result) {
        setEditedNotes(result.notes || '');
        setEditedType(result.testType || '');
      }
    } catch (error) {
      console.error('Error loading test result:', error);
      Alert.alert('Error', 'Failed to load test result');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!testResult) return;

    try {
      // Import database functions
      const { updateTestResult } = await import('@/services/database');
      await updateTestResult(testResult.id, {
        testType: editedType,
        notes: editedNotes,
      });
      
      Alert.alert('Success', 'Test result updated successfully');
      setIsEditing(false);
      loadTestResult();
    } catch (error) {
      console.error('Error updating test result:', error);
      Alert.alert('Error', 'Failed to update test result');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Test Result',
      'Are you sure you want to delete this test result? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Import database functions
              const { deleteTestResult } = await import('@/services/database');
              await deleteTestResult(Number(id));
              Alert.alert('Success', 'Test result deleted successfully');
              router.back();
            } catch (error) {
              console.error('Error deleting test result:', error);
              Alert.alert('Error', 'Failed to delete test result');
            }
          },
        },
      ]
    );
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Test Result' }} />
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!testResult) {
    return (
      <ThemedView style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Test Result' }} />
        <Ionicons name="alert-circle-outline" size={80} color="#ccc" />
        <ThemedText style={styles.emptyText}>Test result not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Test Details',
          headerRight: () => (
            <View style={styles.headerButtons}>
              {isEditing ? (
                <>
                  <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                    <Ionicons name="checkmark" size={24} color="#4A90E2" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditing(false);
                      setEditedNotes(testResult.notes || '');
                      setEditedType(testResult.testType || '');
                    }}
                    style={styles.headerButton}
                  >
                    <Ionicons name="close" size={24} color="#e74c3c" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.headerButton}>
                    <Ionicons name="create-outline" size={24} color="#4A90E2" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                    <Ionicons name="trash-outline" size={24} color="#e74c3c" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image source={{ uri: testResult.imagePath }} style={styles.image} contentFit="contain" />

        <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color="#4A90E2" />
            <ThemedText style={styles.infoLabel}>Date:</ThemedText>
            <ThemedText style={styles.infoValue}>{formatDate(testResult.createdAt)}</ThemedText>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Ionicons name="flask" size={20} color="#50C878" />
            <ThemedText style={styles.infoLabel}>Test Type:</ThemedText>
          </View>
          {isEditing ? (
            <TextInput
              style={[
                styles.input,
                isDark && styles.inputDark,
                { color: isDark ? '#fff' : '#000' },
              ]}
              value={editedType}
              onChangeText={setEditedType}
              placeholder="Test type"
              placeholderTextColor={isDark ? '#888' : '#999'}
            />
          ) : (
            <ThemedText style={styles.infoValue}>{testResult.testType}</ThemedText>
          )}

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Ionicons name="document-text" size={20} color="#9B59B6" />
            <ThemedText style={styles.infoLabel}>Notes:</ThemedText>
          </View>
          {isEditing ? (
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                isDark && styles.inputDark,
                { color: isDark ? '#fff' : '#000' },
              ]}
              value={editedNotes}
              onChangeText={setEditedNotes}
              placeholder="Add notes..."
              placeholderTextColor={isDark ? '#888' : '#999'}
              multiline
              numberOfLines={4}
            />
          ) : (
            <ThemedText style={styles.infoValue}>
              {testResult.notes || 'No notes added'}
            </ThemedText>
          )}
        </View>

        <TouchableOpacity
          style={[styles.aiButton, isDark && styles.aiButtonDark]}
          onPress={() => {
            Alert.alert(
              'Ask AI',
              'AI analysis feature will be available soon. This will help you understand your test results.',
              [{ text: 'OK' }]
            );
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={24} color="#fff" />
          <ThemedText style={styles.aiButtonText}>Ask AI</ThemedText>
        </TouchableOpacity>
      </ScrollView>
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
  },
  scrollContent: {
    padding: 16,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCardDark: {
    backgroundColor: '#2c2c2c',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    marginLeft: 28,
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginLeft: 28,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputDark: {
    backgroundColor: '#1c1c1c',
    borderColor: '#444',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  aiButton: {
    backgroundColor: '#9B59B6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    shadowColor: '#9B59B6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  aiButtonDark: {
    backgroundColor: '#8B4CB8',
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

