import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Vaccination, NewVaccination } from '@/types/vaccination';
import { DesignSystem, getThemeColors } from '@/constants/design';

// Liste der gängigen Impfungen in Deutschland (STIKO-Empfehlungen)
const COMMON_VACCINATIONS = [
  'Tetanus',
  'Diphtherie',
  'Keuchhusten (Pertussis)',
  'Polio (Kinderlähmung)',
  'Haemophilus influenzae Typ b (Hib)',
  'Hepatitis B',
  'Masern',
  'Mumps',
  'Röteln',
  'MMR (Masern-Mumps-Röteln)',
  'Windpocken (Varizellen)',
  'Pneumokokken',
  'Meningokokken C',
  'Meningokokken B',
  'Meningokokken ACWY',
  'Rotaviren',
  'HPV (Humane Papillomviren)',
  'Grippe (Influenza)',
  'COVID-19',
  'FSME (Zecken-Enzephalitis)',
  'Hepatitis A',
  'Tollwut',
  'Gelbfieber',
  'Typhus',
  'Cholera',
  'Japanische Enzephalitis',
  'Tollwut (Reiseimpfung)',
  'Tuberkulose (BCG)',
  'Herpes Zoster (Gürtelrose)',
  'Pertussis (Auffrischung)',
  'Tetanus-Diphtherie (Td)',
  'Tetanus-Diphtherie-Keuchhusten (Tdap)',
].sort();

// Gültigkeitsdauer der Impfungen in Jahren (basierend auf STIKO-Empfehlungen)
const getVaccinationValidityYears = (vaccinationName: string): number | null => {
  const name = vaccinationName.toLowerCase();
  
  // Impfungen mit lebenslanger Gültigkeit
  if (name.includes('masern') || name.includes('mumps') || name.includes('röteln') || 
      name.includes('mmr') || name.includes('windpocken') || name.includes('varizellen') ||
      name.includes('polio') || name.includes('kinderlähmung') || name.includes('hepatitis b') ||
      name.includes('hpv') || name.includes('papillom') || name.includes('tuberkulose') ||
      name.includes('bcg')) {
    return null; // null = lebenslang
  }
  
  // Impfungen mit jährlicher Auffrischung
  if (name.includes('grippe') || name.includes('influenza')) {
    return 1;
  }
  
  // COVID-19: variabel, ca. 6-12 Monate (hier 1 Jahr)
  if (name.includes('covid')) {
    return 1;
  }
  
  // FSME: 3-5 Jahre (hier 3 Jahre)
  if (name.includes('fsme') || name.includes('zecken')) {
    return 3;
  }
  
  // Tetanus, Diphtherie, Keuchhusten: 10 Jahre
  if (name.includes('tetanus') || name.includes('diphtherie') || name.includes('keuchhusten') ||
      name.includes('pertussis') || name.includes('td') || name.includes('tdap')) {
    return 10;
  }
  
  // Hepatitis A: 20+ Jahre
  if (name.includes('hepatitis a')) {
    return 20;
  }
  
  // Tollwut: 2-3 Jahre
  if (name.includes('tollwut')) {
    return 3;
  }
  
  // Gelbfieber: 10 Jahre (lebenslang nach Auffrischung)
  if (name.includes('gelbfieber')) {
    return 10;
  }
  
  // Typhus: 3 Jahre
  if (name.includes('typhus')) {
    return 3;
  }
  
  // Cholera: 2 Jahre
  if (name.includes('cholera')) {
    return 2;
  }
  
  // Japanische Enzephalitis: 1-2 Jahre
  if (name.includes('japanische')) {
    return 2;
  }
  
  // Herpes Zoster: 5+ Jahre
  if (name.includes('herpes zoster') || name.includes('gürtelrose')) {
    return 5;
  }
  
  // Standard: 10 Jahre für unbekannte Impfungen
  return 10;
};

// Berechnet das Ablaufdatum einer Impfung
const calculateExpiryDate = (vaccinationName: string, vaccinationDate: string): Date | null => {
  const validityYears = getVaccinationValidityYears(vaccinationName);
  if (validityYears === null) {
    return null; // Lebendlang gültig
  }
  
  const date = new Date(vaccinationDate);
  const expiryDate = new Date(date);
  expiryDate.setFullYear(expiryDate.getFullYear() + validityYears);
  return expiryDate;
};

// Formatiert das Ablaufdatum als Text
const formatExpiryInfo = (vaccinationName: string, vaccinationDate: string): string => {
  const expiryDate = calculateExpiryDate(vaccinationName, vaccinationDate);
  
  if (expiryDate === null) {
    return 'Lebenslang gültig';
  }
  
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    if (daysOverdue < 30) {
      return `Abgelaufen vor ${daysOverdue} Tag${daysOverdue !== 1 ? 'en' : ''}`;
    } else if (daysOverdue < 365) {
      const monthsOverdue = Math.floor(daysOverdue / 30);
      return `Abgelaufen vor ${monthsOverdue} Monat${monthsOverdue !== 1 ? 'en' : ''}`;
    } else {
      const yearsOverdue = Math.floor(daysOverdue / 365);
      return `Abgelaufen vor ${yearsOverdue} Jahr${yearsOverdue !== 1 ? 'en' : ''}`;
    }
  } else if (diffDays < 30) {
    return `Läuft in ${diffDays} Tag${diffDays !== 1 ? 'en' : ''} ab`;
  } else if (diffDays < 365) {
    const monthsRemaining = Math.floor(diffDays / 30);
    return `Läuft in ${monthsRemaining} Monat${monthsRemaining !== 1 ? 'en' : ''} ab`;
  } else {
    const yearsRemaining = Math.floor(diffDays / 365);
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    if (remainingMonths === 0) {
      return `Läuft in ${yearsRemaining} Jahr${yearsRemaining !== 1 ? 'en' : ''} ab`;
    }
    return `Läuft in ${yearsRemaining} Jahr${yearsRemaining !== 1 ? 'en' : ''} und ${remainingMonths} Monat${remainingMonths !== 1 ? 'en' : ''} ab`;
  }
};

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
  const [showVaccinationPicker, setShowVaccinationPicker] = useState(false);
  const [vaccinationSearch, setVaccinationSearch] = useState('');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'expiry' | 'newest' | 'status'>('status');

  const [formData, setFormData] = useState<NewVaccination>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const filteredVaccinations = useMemo(() => {
    const allVaccinations = COMMON_VACCINATIONS;
    if (!vaccinationSearch.trim()) {
      return allVaccinations;
    }
    const filtered = allVaccinations.filter((vaccination) =>
      vaccination.toLowerCase().includes(vaccinationSearch.toLowerCase())
    );
    return filtered;
  }, [vaccinationSearch]);

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

  // Sortierte Impfungen basierend auf der gewählten Sortieroption
  const sortedVaccinations = useMemo(() => {
    const sorted = [...vaccinations];
    
    switch (sortBy) {
      case 'alphabetical':
        return sorted.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      
      case 'expiry':
        return sorted.sort((a, b) => {
          const expiryA = calculateExpiryDate(a.name, a.date);
          const expiryB = calculateExpiryDate(b.name, b.date);
          
          // Impfungen ohne Ablaufdatum ans Ende
          if (expiryA === null && expiryB === null) return 0;
          if (expiryA === null) return 1;
          if (expiryB === null) return -1;
          
          // Abgelaufene zuerst, dann nach Ablaufdatum sortiert
          const now = new Date();
          const diffA = expiryA.getTime() - now.getTime();
          const diffB = expiryB.getTime() - now.getTime();
          
          // Abgelaufene zuerst
          if (diffA < 0 && diffB >= 0) return -1;
          if (diffA >= 0 && diffB < 0) return 1;
          
          // Dann nach Ablaufdatum sortieren (nächste zuerst)
          return diffA - diffB;
        });
      
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA; // Neueste zuerst
        });
      
      case 'status':
        return sorted.sort((a, b) => {
          const expiryA = calculateExpiryDate(a.name, a.date);
          const expiryB = calculateExpiryDate(b.name, b.date);
          const now = new Date();
          
          // Status-Priorität: Abgelaufen > Läuft bald ab > Gültig > Lebenslang
          const getStatusPriority = (expiry: Date | null): number => {
            if (expiry === null) return 4; // Lebenslang
            const diffDays = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return 1; // Abgelaufen
            if (diffDays < 90) return 2; // Läuft bald ab
            return 3; // Gültig
          };
          
          const priorityA = getStatusPriority(expiryA);
          const priorityB = getStatusPriority(expiryB);
          
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          // Bei gleichem Status nach Ablaufdatum sortieren
          if (expiryA !== null && expiryB !== null) {
            return expiryA.getTime() - expiryB.getTime();
          }
          
          // Bei Lebenslang nach Name sortieren
          return a.name.localeCompare(b.name, 'de');
        });
      
      default:
        return sorted;
    }
  }, [vaccinations, sortBy]);

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
    setEditingVaccination(null);
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleEdit = (vaccination: Vaccination) => {
    setEditingVaccination(vaccination);
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
          {calculateExpiryDate(item.name, item.date) !== null && (
            <View style={styles.expiryContainer}>
              <Ionicons 
                name="time-outline" 
                size={14} 
                color={(() => {
                  const expiryDate = calculateExpiryDate(item.name, item.date);
                  if (expiryDate === null) return themeColors.textSecondary;
                  const now = new Date();
                  const diffDays = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) return '#ff4444'; // Abgelaufen
                  if (diffDays < 90) return '#ff9500'; // Läuft bald ab
                  return themeColors.textSecondary; // Noch gültig
                })()} 
              />
              <ThemedText
                style={[
                  styles.expiryText,
                  {
                    color: (() => {
                      const expiryDate = calculateExpiryDate(item.name, item.date);
                      if (expiryDate === null) return themeColors.textSecondary;
                      const now = new Date();
                      const diffDays = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      if (diffDays < 0) return '#ff4444'; // Abgelaufen
                      if (diffDays < 90) return '#ff9500'; // Läuft bald ab
                      return themeColors.textSecondary; // Noch gültig
                    })(),
                  },
                ]}
              >
                {formatExpiryInfo(item.name, item.date)}
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
        <>
          <View style={[styles.sortContainer, { backgroundColor: themeColors.surfaceElevated, borderBottomColor: themeColors.border }]}>
            <View style={styles.sortButtons}>
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  {
                    backgroundColor: sortBy === 'status' ? DesignSystem.colors.primary.main : themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
                onPress={() => setSortBy('status')}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="flag-outline" 
                  size={16} 
                  color={sortBy === 'status' ? '#fff' : themeColors.text} 
                />
                <ThemedText
                  style={[
                    styles.sortButtonText,
                    { color: sortBy === 'status' ? '#fff' : themeColors.text },
                  ]}
                >
                  Status
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  {
                    backgroundColor: sortBy === 'expiry' ? DesignSystem.colors.primary.main : themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
                onPress={() => setSortBy('expiry')}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="time-outline" 
                  size={16} 
                  color={sortBy === 'expiry' ? '#fff' : themeColors.text} 
                />
                <ThemedText
                  style={[
                    styles.sortButtonText,
                    { color: sortBy === 'expiry' ? '#fff' : themeColors.text },
                  ]}
                >
                  Ablauf
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  {
                    backgroundColor: sortBy === 'newest' ? DesignSystem.colors.primary.main : themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
                onPress={() => setSortBy('newest')}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="calendar-outline" 
                  size={16} 
                  color={sortBy === 'newest' ? '#fff' : themeColors.text} 
                />
                <ThemedText
                  style={[
                    styles.sortButtonText,
                    { color: sortBy === 'newest' ? '#fff' : themeColors.text },
                  ]}
                >
                  Neueste
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  {
                    backgroundColor: sortBy === 'alphabetical' ? DesignSystem.colors.primary.main : themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
                onPress={() => setSortBy('alphabetical')}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="text-outline" 
                  size={16} 
                  color={sortBy === 'alphabetical' ? '#fff' : themeColors.text} 
                />
                <ThemedText
                  style={[
                    styles.sortButtonText,
                    { color: sortBy === 'alphabetical' ? '#fff' : themeColors.text },
                  ]}
                >
                  A-Z
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={sortedVaccinations}
            renderItem={renderVaccination}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        </>
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
                      <TouchableOpacity
                        style={[
                          styles.vaccinationPickerButton,
                          {
                            backgroundColor: themeColors.surface,
                            borderColor: themeColors.border,
                          },
                        ]}
                        onPress={() => setShowVaccinationPicker(!showVaccinationPicker)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.vaccinationPickerButtonContent}>
                          <Ionicons name="medical-outline" size={20} color={themeColors.text} />
                          <ThemedText
                            style={[
                              styles.vaccinationPickerText,
                              {
                                color: formData.name ? themeColors.text : themeColors.textSecondary,
                              },
                            ]}
                          >
                            {formData.name || 'Impfung auswählen...'}
                          </ThemedText>
                        </View>
                        <Ionicons 
                          name={showVaccinationPicker ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color={themeColors.textSecondary} 
                        />
                      </TouchableOpacity>
                      {showVaccinationPicker && (
                        <View style={[styles.dropdownContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                          <View style={[styles.searchContainer, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                            <Ionicons name="search" size={18} color={themeColors.textSecondary} />
                            <TextInput
                              style={[styles.searchInput, { color: themeColors.text }]}
                              value={vaccinationSearch}
                              onChangeText={setVaccinationSearch}
                              placeholder="Suchen..."
                              placeholderTextColor={themeColors.textSecondary}
                            />
                            {vaccinationSearch.length > 0 && (
                              <TouchableOpacity onPress={() => setVaccinationSearch('')}>
                                <Ionicons name="close-circle" size={18} color={themeColors.textSecondary} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                            {filteredVaccinations.map((item) => (
                              <TouchableOpacity
                                key={item}
                                style={[
                                  styles.dropdownOption,
                                  {
                                    backgroundColor: formData.name === item ? themeColors.surfaceElevated : 'transparent',
                                  },
                                ]}
                                onPress={() => {
                                  setFormData({ ...formData, name: item });
                                  setShowVaccinationPicker(false);
                                  setVaccinationSearch('');
                                }}
                                activeOpacity={0.7}
                              >
                                <ThemedText style={[styles.dropdownOptionText, { color: themeColors.text }]}>
                                  {item}
                                </ThemedText>
                                {formData.name === item && (
                                  <Ionicons name="checkmark" size={18} color={DesignSystem.colors.primary.main} />
                                )}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                      {formData.name && !showVaccinationPicker && (
                        <TouchableOpacity
                          style={styles.clearButton}
                          onPress={() => setFormData({ ...formData, name: '' })}
                        >
                          <Ionicons name="close-circle" size={18} color={themeColors.textSecondary} />
                          <ThemedText style={[styles.clearButtonText, { color: themeColors.textSecondary }]}>
                            Auswahl zurücksetzen
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: themeColors.text }]}>
                        Impfdatum *
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
                        value={formData.date}
                        onChangeText={(text) => {
                          // Einfache Validierung für Datumsformat YYYY-MM-DD
                          const cleaned = text.replace(/[^0-9-]/g, '');
                          if (cleaned.length <= 10) {
                            setFormData({ ...formData, date: cleaned });
                          }
                        }}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={themeColors.textSecondary}
                      />
                      <ThemedText style={[styles.helperText, { color: themeColors.textSecondary }]}>
                        Format: YYYY-MM-DD (z.B. {new Date().toISOString().split('T')[0]})
                      </ThemedText>
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

      {/* Impfungsauswahl-Modal - muss außerhalb des anderen Modals sein */}
      <Modal
        visible={showVaccinationPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowVaccinationPicker(false);
          setVaccinationSearch('');
        }}
        presentationStyle="overFullScreen"
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { backgroundColor: themeColors.background }]}>
            <View style={[styles.pickerModalHeader, { borderBottomColor: themeColors.border }]}>
              <ThemedText style={[styles.pickerModalTitle, { color: themeColors.text }]}>
                Impfung auswählen ({filteredVaccinations.length})
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setShowVaccinationPicker(false);
                  setVaccinationSearch('');
                }}
                style={styles.pickerCloseButton}
              >
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Ionicons name="search" size={20} color={themeColors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                value={vaccinationSearch}
                onChangeText={setVaccinationSearch}
                placeholder="Suchen..."
                placeholderTextColor={themeColors.textSecondary}
                autoFocus={true}
              />
              {vaccinationSearch.length > 0 && (
                <TouchableOpacity onPress={() => setVaccinationSearch('')}>
                  <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredVaccinations}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.vaccinationOption,
                    {
                      backgroundColor: formData.name === item ? themeColors.surfaceElevated : 'transparent',
                      borderBottomColor: themeColors.border,
                    },
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, name: item });
                    setShowVaccinationPicker(false);
                    setVaccinationSearch('');
                  }}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.vaccinationOptionText, { color: themeColors.text }]}>
                    {item}
                  </ThemedText>
                  {formData.name === item && (
                    <Ionicons name="checkmark" size={20} color={DesignSystem.colors.primary.main} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.vaccinationList}
              contentContainerStyle={styles.vaccinationListContent}
              ListEmptyComponent={
                <View style={styles.emptyPickerContainer}>
                  <ThemedText style={[styles.emptyPickerText, { color: themeColors.textSecondary }]}>
                    Keine Impfungen gefunden
                  </ThemedText>
                </View>
              }
            />
          </View>
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
  sortContainer: {
    padding: DesignSystem.spacing.md,
    borderBottomWidth: 1,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: DesignSystem.spacing.sm,
    flexWrap: 'wrap',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.xs,
    paddingHorizontal: DesignSystem.spacing.md,
    paddingVertical: DesignSystem.spacing.sm,
    borderRadius: DesignSystem.borderRadius.md,
    borderWidth: 1,
    flex: 1,
    minWidth: '22%',
    justifyContent: 'center',
  },
  sortButtonText: {
    fontSize: DesignSystem.typography.fontSize.sm,
    fontWeight: DesignSystem.typography.fontWeight.medium,
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
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.xs,
    marginTop: DesignSystem.spacing.xs,
  },
  expiryText: {
    fontSize: DesignSystem.typography.fontSize.sm,
    fontWeight: DesignSystem.typography.fontWeight.medium,
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
  vaccinationPickerButton: {
    borderWidth: 1,
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vaccinationPickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.sm,
    flex: 1,
  },
  vaccinationPickerText: {
    fontSize: DesignSystem.typography.fontSize.base,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.xs,
    marginTop: DesignSystem.spacing.sm,
    paddingVertical: DesignSystem.spacing.xs,
  },
  clearButtonText: {
    fontSize: DesignSystem.typography.fontSize.sm,
  },
  dropdownContainer: {
    marginTop: DesignSystem.spacing.sm,
    borderWidth: 1,
    borderRadius: DesignSystem.borderRadius.md,
    maxHeight: 300,
    overflow: 'hidden',
  },
  dropdownList: {
    maxHeight: 250,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: DesignSystem.colors.neutral[200],
  },
  dropdownOptionText: {
    fontSize: DesignSystem.typography.fontSize.base,
    flex: 1,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    borderTopLeftRadius: DesignSystem.borderRadius.xl,
    borderTopRightRadius: DesignSystem.borderRadius.xl,
    height: '80%',
    width: '100%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: DesignSystem.spacing.lg,
    borderBottomWidth: 1,
  },
  pickerModalTitle: {
    fontSize: DesignSystem.typography.fontSize.xl,
    fontWeight: DesignSystem.typography.fontWeight.bold,
  },
  pickerCloseButton: {
    padding: DesignSystem.spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: DesignSystem.borderRadius.md,
    paddingHorizontal: DesignSystem.spacing.md,
    paddingVertical: DesignSystem.spacing.sm,
    margin: DesignSystem.spacing.lg,
    marginTop: DesignSystem.spacing.md,
    gap: DesignSystem.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: DesignSystem.typography.fontSize.base,
  },
  vaccinationList: {
    flex: 1,
  },
  vaccinationListContent: {
    paddingBottom: DesignSystem.spacing.lg,
  },
  vaccinationOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.lg,
    borderBottomWidth: 1,
  },
  vaccinationOptionText: {
    fontSize: DesignSystem.typography.fontSize.base,
    flex: 1,
  },
  emptyPickerContainer: {
    padding: DesignSystem.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPickerText: {
    fontSize: DesignSystem.typography.fontSize.base,
    textAlign: 'center',
  },
});

