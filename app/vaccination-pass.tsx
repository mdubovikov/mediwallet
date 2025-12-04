import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Vaccination, NewVaccination } from '@/types/vaccination';
import { DesignSystem, getThemeColors } from '@/constants/design';

export default function VaccinationPassScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeColors = getThemeColors(isDark);
  const isWeb = Platform.OS === 'web';
  const scrollViewRef = useRef<ScrollView>(null);

  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVaccination, setEditingVaccination] = useState<Vaccination | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [formData, setFormData] = useState<NewVaccination>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const loadVaccinations = async () => {
    if (isWeb) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { getAllVaccinations, initDatabase } = await import('@/services/database');
      try {
        await initDatabase();
      } catch (initError) {
        console.log('Database may already be initialized:', initError);
      }
      const results = await getAllVaccinations();
      setVaccinations(results);
    } catch (error) {
      console.error('Error loading vaccinations:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Fehler',
        `Impfungen konnten nicht geladen werden.\n\nFehler: ${errorMessage}`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadVaccinations();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadVaccinations();
  };

  const calculateTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `vor ${diffDays} Tag${diffDays !== 1 ? 'en' : ''}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `vor ${months} Monat${months !== 1 ? 'en' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      if (remainingMonths === 0) {
        return `vor ${years} Jahr${years !== 1 ? 'en' : ''}`;
      }
      return `vor ${years} Jahr${years !== 1 ? 'en' : ''} und ${remainingMonths} Monat${remainingMonths !== 1 ? 'en' : ''}`;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleAdd = () => {
    const today = new Date();
    setEditingVaccination(null);
    setSelectedDate(today);
    setFormData({
      name: '',
      date: today.toISOString().split('T')[0],
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleEdit = (vaccination: Vaccination) => {
    const vaccinationDate = new Date(vaccination.date);
    setEditingVaccination(vaccination);
    setSelectedDate(vaccinationDate);
    setFormData({
      name: vaccination.name,
      date: vaccination.date.split('T')[0],
      notes: vaccination.notes || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = (vaccination: Vaccination) => {
    Alert.alert(
      'Impfung löschen',
      `Möchten Sie die Impfung "${vaccination.name}" wirklich löschen?`,
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { deleteVaccination } = await import('@/services/database');
              await deleteVaccination(vaccination.id);
              loadVaccinations();
            } catch (error) {
              console.error('Error deleting vaccination:', error);
              Alert.alert('Fehler', 'Impfung konnte nicht gelöscht werden.');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Impfungsnamen ein.');
      return;
    }

    if (isWeb) {
      Alert.alert('Web Preview', 'Das Hinzufügen von Impfungen ist auf Web nicht verfügbar.');
      return;
    }

    try {
      const { addVaccination, updateVaccination } = await import('@/services/database');
      
      if (editingVaccination) {
        await updateVaccination(editingVaccination.id, {
          ...formData,
          date: new Date(formData.date).toISOString(),
        });
      } else {
        await addVaccination({
          ...formData,
          date: new Date(formData.date).toISOString(),
        });
      }
      
      setShowAddModal(false);
      loadVaccinations();
    } catch (error) {
      console.error('Error saving vaccination:', error);
      Alert.alert('Fehler', 'Impfung konnte nicht gespeichert werden.');
    }
  };

  const renderVaccination = ({ item }: { item: Vaccination }) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surfaceElevated,
          borderColor: themeColors.border,
        },
        isDark && styles.cardDark,
      ]}
    >
      <View style={styles.cardContent}>
        <View style={[styles.iconContainer, { backgroundColor: DesignSystem.colors.primary.main + '20' }]}>
          <Ionicons name="medical" size={24} color={DesignSystem.colors.primary.main} />
        </View>
        <View style={styles.cardInfo}>
          <ThemedText style={[styles.vaccinationName, { color: themeColors.text }]}>
            {item.name}
          </ThemedText>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={14} color={themeColors.textSecondary} />
            <ThemedText style={[styles.date, { color: themeColors.textSecondary }]}>
              {formatDate(item.date)}
            </ThemedText>
          </View>
          <ThemedText style={[styles.timeAgo, { color: themeColors.textSecondary }]}>
            {calculateTimeAgo(item.date)}
          </ThemedText>
          {item.notes && (
            <ThemedText
              style={[styles.notes, { color: themeColors.textSecondary }]}
              numberOfLines={2}
            >
              {item.notes}
            </ThemedText>
          )}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={[styles.actionButton, { backgroundColor: themeColors.surface }]}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={[styles.actionButton, { backgroundColor: themeColors.surface }]}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={18} color="#ff4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ title: 'Impfpass' }} />
        <ActivityIndicator size="large" color={DesignSystem.colors.primary.main} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Impfpass',
          headerBackTitle: 'Zurück',
        }}
      />
      {isWeb ? (
        <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
          <ThemedText style={[styles.emptyText, { color: themeColors.text }]}>
            Impfpass ist auf Web nicht verfügbar
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
            Bitte verwenden Sie iOS oder Android für die volle Funktionalität
          </ThemedText>
        </View>
      ) : vaccinations.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="medical-outline" size={64} color={themeColors.textSecondary} />
          </View>
          <ThemedText style={[styles.emptyText, { color: themeColors.text }]}>
            Noch keine Impfungen
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
            Fügen Sie Ihre erste Impfung hinzu
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={vaccinations}
          renderItem={renderVaccination}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {!isWeb && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: DesignSystem.colors.primary.main }]}
          onPress={handleAdd}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.keyboardAvoidingContainer}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={[styles.modalContent, { backgroundColor: themeColors.background }]}
              >
                <View style={styles.modalHeader}>
                  <ThemedText style={[styles.modalTitle, { color: themeColors.text }]}>
                    {editingVaccination ? 'Impfung bearbeiten' : 'Neue Impfung hinzufügen'}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setShowAddModal(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={themeColors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  ref={scrollViewRef}
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  keyboardDismissMode="interactive"
                >
                  <View style={styles.form}>
                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: themeColors.text }]}>
                        Impfungsname *
                      </ThemedText>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: themeColors.surface,
                            color: themeColors.text,
                            borderColor: themeColors.border,
                          },
                        ]}
                        value={formData.name}
                        onChangeText={(text) => setFormData({ ...formData, name: text })}
                        placeholder="z.B. COVID-19, Tetanus, etc."
                        placeholderTextColor={themeColors.textSecondary}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: themeColors.text }]}>
                        Impfdatum *
                      </ThemedText>
                      {!isWeb ? (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.datePickerButton,
                              {
                                backgroundColor: themeColors.surface,
                                borderColor: themeColors.border,
                              },
                            ]}
                            onPress={() => setShowDatePicker(true)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.datePickerButtonContent}>
                              <Ionicons name="calendar-outline" size={20} color={themeColors.text} />
                              <ThemedText style={[styles.datePickerText, { color: themeColors.text }]}>
                                {selectedDate.toLocaleDateString('de-DE', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </ThemedText>
                            </View>
                            <Ionicons name="chevron-down" size={20} color={themeColors.textSecondary} />
                          </TouchableOpacity>
                          {showDatePicker && (
                            <DateTimePicker
                              value={selectedDate}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, date) => {
                                if (Platform.OS === 'android') {
                                  setShowDatePicker(false);
                                }
                                if (date) {
                                  setSelectedDate(date);
                                  setFormData({
                                    ...formData,
                                    date: date.toISOString().split('T')[0],
                                  });
                                }
                                if (Platform.OS === 'android' && event.type === 'dismissed') {
                                  setShowDatePicker(false);
                                }
                              }}
                              maximumDate={new Date()}
                              locale="de-DE"
                            />
                          )}
                          {Platform.OS === 'ios' && showDatePicker && (
                            <View style={styles.datePickerActions}>
                              <TouchableOpacity
                                style={[styles.datePickerActionButton, { backgroundColor: themeColors.surface }]}
                                onPress={() => setShowDatePicker(false)}
                              >
                                <ThemedText style={[styles.datePickerActionText, { color: themeColors.text }]}>
                                  Fertig
                                </ThemedText>
                              </TouchableOpacity>
                            </View>
                          )}
                        </>
                      ) : (
                        <TextInput
                          style={[
                            styles.input,
                            {
                              backgroundColor: themeColors.surface,
                              color: themeColors.text,
                              borderColor: themeColors.border,
                            },
                          ]}
                          type="date"
                          value={formData.date}
                          onChangeText={(text) => setFormData({ ...formData, date: text })}
                        />
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: themeColors.text }]}>
                        Notizen (optional)
                      </ThemedText>
                      <TextInput
                        style={[
                          styles.textArea,
                          {
                            backgroundColor: themeColors.surface,
                            color: themeColors.text,
                            borderColor: themeColors.border,
                          },
                        ]}
                        value={formData.notes}
                        onChangeText={(text) => setFormData({ ...formData, notes: text })}
                        placeholder="Zusätzliche Informationen..."
                        placeholderTextColor={themeColors.textSecondary}
                        multiline
                        numberOfLines={4}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.saveButton, { backgroundColor: DesignSystem.colors.primary.main }]}
                      onPress={handleSave}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.saveButtonText}>
                        {editingVaccination ? 'Speichern' : 'Hinzufügen'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </View>
      </Modal>
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
  listContent: {
    padding: DesignSystem.spacing.md,
    gap: DesignSystem.spacing.md,
    paddingBottom: 100,
  },
  card: {
    borderRadius: DesignSystem.borderRadius.lg,
    padding: DesignSystem.spacing.md,
    borderWidth: 1,
    ...DesignSystem.shadows.md,
  },
  cardDark: {
    shadowOpacity: 0.3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: DesignSystem.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: DesignSystem.spacing.xs,
  },
  vaccinationName: {
    fontSize: DesignSystem.typography.fontSize.lg,
    fontWeight: DesignSystem.typography.fontWeight.semibold,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.xs,
  },
  date: {
    fontSize: DesignSystem.typography.fontSize.sm,
  },
  timeAgo: {
    fontSize: DesignSystem.typography.fontSize.sm,
    fontStyle: 'italic',
  },
  notes: {
    fontSize: DesignSystem.typography.fontSize.sm,
    marginTop: DesignSystem.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: DesignSystem.spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: DesignSystem.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DesignSystem.spacing.xxl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.lg,
  },
  emptyText: {
    fontSize: DesignSystem.typography.fontSize.xl,
    fontWeight: DesignSystem.typography.fontWeight.semibold,
    marginTop: DesignSystem.spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: DesignSystem.typography.fontSize.base,
    marginTop: DesignSystem.spacing.sm,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: DesignSystem.typography.fontSize.base * 1.5,
  },
  fab: {
    position: 'absolute',
    right: DesignSystem.spacing.lg,
    bottom: DesignSystem.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...DesignSystem.shadows.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlayTouchable: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardAvoidingContainer: {
    width: '100%',
  },
  modalContent: {
    borderTopLeftRadius: DesignSystem.borderRadius.xl,
    borderTopRightRadius: DesignSystem.borderRadius.xl,
    padding: DesignSystem.spacing.lg,
    maxHeight: '90%',
    minHeight: '70%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.lg,
  },
  modalTitle: {
    fontSize: DesignSystem.typography.fontSize.xl,
    fontWeight: DesignSystem.typography.fontWeight.bold,
  },
  closeButton: {
    padding: DesignSystem.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: DesignSystem.spacing.xxl,
    flexGrow: 1,
  },
  form: {
    gap: DesignSystem.spacing.md,
  },
  formGroup: {
    gap: DesignSystem.spacing.sm,
  },
  label: {
    fontSize: DesignSystem.typography.fontSize.base,
    fontWeight: DesignSystem.typography.fontWeight.semibold,
  },
  input: {
    borderWidth: 1,
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    fontSize: DesignSystem.typography.fontSize.base,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    fontSize: DesignSystem.typography.fontSize.base,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    alignItems: 'center',
    marginTop: DesignSystem.spacing.md,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: DesignSystem.typography.fontSize.base,
    fontWeight: DesignSystem.typography.fontWeight.semibold,
  },
  helperText: {
    fontSize: DesignSystem.typography.fontSize.xs,
    marginTop: DesignSystem.spacing.xs,
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.sm,
    flex: 1,
  },
  datePickerText: {
    fontSize: DesignSystem.typography.fontSize.base,
  },
  datePickerActions: {
    marginTop: DesignSystem.spacing.md,
    alignItems: 'flex-end',
  },
  datePickerActionButton: {
    paddingHorizontal: DesignSystem.spacing.lg,
    paddingVertical: DesignSystem.spacing.sm,
    borderRadius: DesignSystem.borderRadius.md,
  },
  datePickerActionText: {
    fontSize: DesignSystem.typography.fontSize.base,
    fontWeight: DesignSystem.typography.fontWeight.semibold,
  },
});

