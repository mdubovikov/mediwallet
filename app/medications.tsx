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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Medication, NewMedication } from '@/types/medication';
import { DesignSystem, getThemeColors } from '@/constants/design';

export default function MedicationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeColors = getThemeColors(isDark);
  const isWeb = Platform.OS === 'web';
  const scrollViewRef = useRef<ScrollView>(null);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  const [formData, setFormData] = useState<NewMedication>({
    name: '',
    dosage: '',
    frequency: '',
    notes: '',
    reminderEnabled: false,
    reminderTimes: '',
  });

  const loadMedications = async () => {
    if (isWeb) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { getAllMedications, initDatabase } = await import('@/services/database');
      try {
        await initDatabase();
      } catch (initError) {
        console.log('Database may already be initialized:', initError);
      }
      const results = await getAllMedications();
      setMedications(results);
    } catch (error) {
      console.error('Error loading medications:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Fehler',
        `Medikamente konnten nicht geladen werden.\n\nFehler: ${errorMessage}`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMedications();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadMedications();
  };

  const handleAdd = () => {
    setEditingMedication(null);
    setFormData({
      name: '',
      dosage: '',
      frequency: '',
      notes: '',
      reminderEnabled: false,
      reminderTimes: '',
    });
    setShowAddModal(true);
  };

  const handleEdit = (medication: Medication) => {
    setEditingMedication(medication);
    setFormData({
      name: medication.name,
      dosage: medication.dosage || '',
      frequency: medication.frequency || '',
      notes: medication.notes || '',
      reminderEnabled: medication.reminderEnabled || false,
      reminderTimes: medication.reminderTimes || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = (medication: Medication) => {
    Alert.alert(
      'Medikament löschen',
      `Möchten Sie das Medikament "${medication.name}" wirklich löschen?`,
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
              const { deleteMedication } = await import('@/services/database');
              await deleteMedication(medication.id);
              loadMedications();
            } catch (error) {
              console.error('Error deleting medication:', error);
              Alert.alert('Fehler', 'Medikament konnte nicht gelöscht werden.');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Medikamentennamen ein.');
      return;
    }

    if (isWeb) {
      Alert.alert('Web Preview', 'Das Hinzufügen von Medikamenten ist auf Web nicht verfügbar.');
      return;
    }

    try {
      const { addMedication, updateMedication } = await import('@/services/database');
      
      if (editingMedication) {
        await updateMedication(editingMedication.id, formData);
      } else {
        await addMedication(formData);
      }
      
      setShowAddModal(false);
      loadMedications();
    } catch (error) {
      console.error('Error saving medication:', error);
      Alert.alert('Fehler', 'Medikament konnte nicht gespeichert werden.');
    }
  };

  const renderMedication = ({ item }: { item: Medication }) => (
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
        <View style={[styles.iconContainer, { backgroundColor: '#FF6B6B' + '20' }]}>
          <Ionicons name="medical" size={24} color="#FF6B6B" />
        </View>
        <View style={styles.cardInfo}>
          <ThemedText style={[styles.medicationName, { color: themeColors.text }]}>
            {item.name}
          </ThemedText>
          {item.dosage && (
            <View style={styles.infoRow}>
              <Ionicons name="flask-outline" size={14} color={themeColors.textSecondary} />
              <ThemedText style={[styles.infoText, { color: themeColors.textSecondary }]}>
                {item.dosage}
              </ThemedText>
            </View>
          )}
          {item.frequency && (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={14} color={themeColors.textSecondary} />
              <ThemedText style={[styles.infoText, { color: themeColors.textSecondary }]}>
                {item.frequency}
              </ThemedText>
            </View>
          )}
          {item.reminderEnabled && (
            <View style={styles.infoRow}>
              <Ionicons name="notifications" size={14} color="#FF6B6B" />
              <ThemedText style={[styles.infoText, { color: '#FF6B6B' }]}>
                Erinnerung aktiviert
                {item.reminderTimes && ` (${item.reminderTimes})`}
              </ThemedText>
            </View>
          )}
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
        <Stack.Screen options={{ title: 'Medikamente' }} />
        <ActivityIndicator size="large" color={DesignSystem.colors.primary.main} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Medikamente',
          headerBackTitle: 'Zurück',
        }}
      />
      {isWeb ? (
        <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
          <ThemedText style={[styles.emptyText, { color: themeColors.text }]}>
            Medikamente sind auf Web nicht verfügbar
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
            Bitte verwenden Sie iOS oder Android für die volle Funktionalität
          </ThemedText>
        </View>
      ) : medications.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="medical-outline" size={64} color={themeColors.textSecondary} />
          </View>
          <ThemedText style={[styles.emptyText, { color: themeColors.text }]}>
            Noch keine Medikamente
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
            Fügen Sie Ihr erstes Medikament hinzu
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={medications}
          renderItem={renderMedication}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {!isWeb && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: '#FF6B6B' }]}
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
                    {editingMedication ? 'Medikament bearbeiten' : 'Neues Medikament hinzufügen'}
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
                        Medikamentenname *
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
                        placeholder="z.B. Aspirin, Ibuprofen, etc."
                        placeholderTextColor={themeColors.textSecondary}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: themeColors.text }]}>
                        Dosierung (optional)
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
                        value={formData.dosage}
                        onChangeText={(text) => setFormData({ ...formData, dosage: text })}
                        placeholder="z.B. 500mg, 1 Tablette, etc."
                        placeholderTextColor={themeColors.textSecondary}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: themeColors.text }]}>
                        Häufigkeit (optional)
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
                        value={formData.frequency}
                        onChangeText={(text) => setFormData({ ...formData, frequency: text })}
                        placeholder="z.B. 3x täglich, morgens, etc."
                        placeholderTextColor={themeColors.textSecondary}
                      />
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

                    <View style={styles.formGroup}>
                      <View style={styles.switchRow}>
                        <View style={styles.switchLabelContainer}>
                          <Ionicons name="notifications-outline" size={20} color={themeColors.text} />
                          <ThemedText style={[styles.label, { color: themeColors.text, marginLeft: DesignSystem.spacing.sm }]}>
                            Erinnerung aktivieren
                          </ThemedText>
                        </View>
                        <Switch
                          value={formData.reminderEnabled || false}
                          onValueChange={(value) => setFormData({ ...formData, reminderEnabled: value })}
                          trackColor={{ false: themeColors.border, true: '#FF6B6B' }}
                          thumbColor={formData.reminderEnabled ? '#fff' : themeColors.textSecondary}
                        />
                      </View>
                      {formData.reminderEnabled && formData.frequency && (
                        <View style={[styles.reminderInfo, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                          <ThemedText style={[styles.reminderText, { color: themeColors.textSecondary }]}>
                            Erinnerungen werden basierend auf der Häufigkeit "{formData.frequency}" gesendet.
                          </ThemedText>
                          <ThemedText style={[styles.reminderHint, { color: themeColors.textSecondary }]}>
                            Geben Sie die gewünschten Uhrzeiten ein (z.B. "08:00, 20:00" oder "morgens, abends"):
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: themeColors.surface,
                                color: themeColors.text,
                                borderColor: themeColors.border,
                                marginTop: DesignSystem.spacing.sm,
                              },
                            ]}
                            value={formData.reminderTimes || ''}
                            onChangeText={(text) => setFormData({ ...formData, reminderTimes: text })}
                            placeholder="z.B. 08:00, 20:00 oder morgens, abends"
                            placeholderTextColor={themeColors.textSecondary}
                          />
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.saveButton, { backgroundColor: '#FF6B6B' }]}
                      onPress={handleSave}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.saveButtonText}>
                        {editingMedication ? 'Speichern' : 'Hinzufügen'}
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
  medicationName: {
    fontSize: DesignSystem.typography.fontSize.lg,
    fontWeight: DesignSystem.typography.fontWeight.semibold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.xs,
  },
  infoText: {
    fontSize: DesignSystem.typography.fontSize.sm,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DesignSystem.spacing.sm,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderInfo: {
    marginTop: DesignSystem.spacing.md,
    padding: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    borderWidth: 1,
  },
  reminderText: {
    fontSize: DesignSystem.typography.fontSize.sm,
    marginBottom: DesignSystem.spacing.xs,
  },
  reminderHint: {
    fontSize: DesignSystem.typography.fontSize.xs,
    fontStyle: 'italic',
    marginTop: DesignSystem.spacing.xs,
  },
});

