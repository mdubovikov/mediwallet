import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Alert, Platform, StyleSheet, TouchableOpacity, View, Linking } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DesignSystem, getThemeColors } from '@/constants/design';

// Verfügbare Testtypen zur Auswahl
const TEST_TYPES = [
  'EKG',
  'Blutbild',
  'Herzschlag',
  'Blutdruck',
  'Blutzucker',
  'Cholesterin',
  'Urinanalyse',
  'Röntgen',
  'Ultraschall',
  'CT-Scan',
  'MRT',
  'Allgemeine Untersuchung',
  'Andere',
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const themeColors = getThemeColors(isDark);

  const handleAccessAnalyses = () => {
    if (isWeb) {
      Alert.alert(
        'Web Preview',
        'Viewing test results is not available on web. Please use iOS or Android for full functionality.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/test-results');
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to take photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestGalleryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Gallery permission is required to select photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const selectTestType = (imageUri: string, permanentPath: string): Promise<string> => {
    return new Promise((resolve) => {
      const buttons = TEST_TYPES.map((type) => ({
        text: type,
        onPress: () => resolve(type),
      }));

      buttons.push({
        text: 'Cancel',
        style: 'cancel' as const,
        onPress: () => resolve(''),
      });

      Alert.alert('Test Type Selection', 'Please select the type of test:', buttons, {
        cancelable: true,
        onDismiss: () => resolve(''),
      });
    });
  };

  const saveTestResult = async (imageUri: string, testType?: string) => {
    console.log('=== saveTestResult START ===');
    console.log('isWeb:', isWeb, 'Platform.OS:', Platform.OS);
    console.log('imageUri:', imageUri);
    console.log('testType:', testType);
    
    if (isWeb) {
      // Auf Web Nachricht mit window.alert anzeigen, falls verfügbar, sonst Alert verwenden
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Saving test results is not available on web. Please use iOS or Android for full functionality.');
      } else {
        Alert.alert(
          'Web Preview',
          'Saving test results is not available on web. Please use iOS or Android for full functionality.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    try {
      console.log('Step 1: Importing database functions...');
      // Datenbankfunktionen importieren
      const dbModule = await import('@/services/database');
      const { initDatabase, saveImage, addTestResult } = dbModule;
      console.log('Database module imported:', Object.keys(dbModule));

      console.log('Step 2: Ensuring database is ready...');
      // Sicherstellen, dass Datenbank initialisiert ist (sicher, mehrfach aufzurufen)
      // Datenbank wird sich in addTestResult automatisch initialisieren, falls nötig
      try {
        await initDatabase();
        console.log('Database initialized successfully');
      } catch (initError: any) {
        console.log('Database init check (may already be initialized):', initError?.message);
        // Trotzdem fortfahren - addTestResult wird die Initialisierung behandeln
      }

      console.log('Step 3: Saving image...');
      console.log('Image URI:', imageUri);
      // Bild in permanenten Speicher speichern
      let permanentPath: string;
      try {
        permanentPath = await saveImage(imageUri);
        console.log('Image saved successfully to:', permanentPath);
      } catch (saveError: any) {
        console.error('Error saving image:', saveError);
        throw new Error(`Failed to save image: ${saveError?.message || saveError}`);
      }

      // Schritt 3.5: Testtyp auswählen, falls nicht bereitgestellt
      let selectedTestType = testType;
      if (!selectedTestType) {
        selectedTestType = await selectTestType(imageUri, permanentPath);
        if (!selectedTestType) {
          console.log('Test type selection cancelled');
          return;
        }
      }

      // Schritt 3.6: Persönliche Informationen abfragen
      // Navigiere zu Personal Info Screen
      console.log('Step 4: Navigating to personal info screen...');
      router.push({
        pathname: '/personal-info',
        params: {
          imageUri: permanentPath,
          testType: selectedTestType,
        },
      });
      
      // Das Speichern wird im Personal Info Screen durchgeführt
      console.log('=== saveTestResult - Navigation to personal info ===');
      return;
    } catch (error: any) {
      console.error('=== Error saving test result ===');
      console.error('Error object:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      
      // Spezifischere Fehlermeldung anzeigen
      if (errorMessage.includes('not supported on web') || errorMessage.includes('web platform')) {
        Alert.alert(
          'Web Preview',
          'Saving test results is not available on web. Please use iOS or Android for full functionality.',
          [{ text: 'OK' }]
        );
      } else if (errorMessage.includes('not initialized') || errorMessage.includes('initialization')) {
        Alert.alert(
          'Database Error',
          'Database is not initialized. Please wait a moment and try again, or restart the app.',
          [{ text: 'OK' }]
        );
      } else if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        Alert.alert(
          'Permission Error',
          'Please grant necessary permissions (camera, storage) in app settings.',
          [{ text: 'OK' }]
        );
      } else {
        // Detaillierten Fehler für Debugging anzeigen
        const shortMessage = errorMessage.length > 100 
          ? errorMessage.substring(0, 100) + '...' 
          : errorMessage;
        
        Alert.alert(
          'Error Saving Test Result',
          `Details: ${shortMessage}\n\nCheck console for full error details.`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('Photo taken:', result.assets[0].uri);
      await saveTestResult(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestGalleryPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('Photo selected:', result.assets[0].uri);
      await saveTestResult(result.assets[0].uri);
    }
  };

  const handleScanNew = () => {
    if (isWeb) {
      // Auf Web window.alert verwenden und Dateiauswahl erlauben
      if (typeof window !== 'undefined' && window.confirm) {
        const useFileInput = window.confirm(
          'On web, you can select an image file. Would you like to choose an image?'
        );
        if (useFileInput) {
          // Datei-Eingabeelement erstellen
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file) {
              // Data URL aus der Datei erstellen
              const reader = new FileReader();
              reader.onload = async (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) {
                  // Testergebnis mit der Data URL speichern
                  await saveTestResult(dataUrl);
                }
              };
              reader.readAsDataURL(file);
            }
          };
          input.click();
        }
      } else {
        // Fallback zu Alert.alert, falls window.confirm nicht verfügbar ist
        Alert.alert(
          'Web Preview',
          'Scanning test results is not available on web. Please use iOS or Android for full functionality.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    Alert.alert(
      'Scan New Test',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: pickFromGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleContactDoctor = async () => {
    try {
      const { getUserSettings } = await import('@/services/database');
      const settings = await getUserSettings();
      
      if (!settings || !settings.doctorName) {
        Alert.alert(
          'Kein Arzt hinterlegt',
          'Bitte tragen Sie zuerst Ihren Hausarzt in den Einstellungen ein.',
          [
            {
              text: 'Zu Einstellungen',
              onPress: () => router.push('/settings'),
            },
            {
              text: 'Abbrechen',
              style: 'cancel',
            },
          ]
        );
        return;
      }

      const contactOptions: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }> = [];

      if (settings.doctorPhone) {
        contactOptions.push({
          text: `Anrufen: ${settings.doctorPhone}`,
          onPress: () => {
            Linking.openURL(`tel:${settings.doctorPhone}`);
          },
        });
      }

      if (settings.doctorEmail) {
        contactOptions.push({
          text: `E-Mail: ${settings.doctorEmail}`,
          onPress: () => {
            Linking.openURL(`mailto:${settings.doctorEmail}?subject=Medizinische Anfrage`);
          },
        });
      }

      if (contactOptions.length === 0) {
        Alert.alert(
          'Keine Kontaktdaten',
          `Ihr Hausarzt ${settings.doctorName} hat keine Kontaktdaten hinterlegt.\n\nBitte tragen Sie Telefonnummer oder E-Mail-Adresse in den Einstellungen ein.`,
          [
            {
              text: 'Zu Einstellungen',
              onPress: () => router.push('/settings'),
            },
            {
              text: 'Abbrechen',
              style: 'cancel',
            },
          ]
        );
        return;
      }

      contactOptions.push({
        text: 'Abbrechen',
        style: 'cancel',
      });

      Alert.alert(
        `Arzt kontaktieren: ${settings.doctorName}`,
        'Wie möchten Sie Ihren Arzt kontaktieren?',
        contactOptions
      );
    } catch (error) {
      console.error('Error contacting doctor:', error);
      Alert.alert(
        'Fehler',
        'Kontaktdaten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.'
      );
    }
  };

  const handleChat = () => {
    router.push('/chat-list');
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const handleMedications = () => {
    if (isWeb) {
      Alert.alert(
        'Web Preview',
        'Medikamente sind auf Web nicht verfügbar. Bitte verwenden Sie iOS oder Android für die volle Funktionalität.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/medications');
  };

  const handleVaccinationPass = () => {
    if (isWeb) {
      Alert.alert(
        'Web Preview',
        'Impfpass ist auf Web nicht verfügbar. Bitte verwenden Sie iOS oder Android für die volle Funktionalität.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/vaccination-pass');
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ 
        light: DesignSystem.colors.primary.main, 
        dark: DesignSystem.colors.primary.dark 
      }}
      headerImage={
        <View style={styles.headerContainer}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="medical" size={100} color="#fff" style={styles.headerIcon} />
          </View>
        </View>
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText 
          type="title" 
          style={[styles.appTitle, { color: themeColors.text }]}
        >
          MediWallet
        </ThemedText>
        <ThemedText 
          style={[styles.appSubtitle, { color: themeColors.textSecondary }]}
        >
          Ihre medizinischen Testergebnisse sicher verwalten
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={[
            styles.button, 
            styles.primaryButton, 
            { backgroundColor: DesignSystem.colors.primary.main },
            isDark && styles.buttonDark
          ]}
          onPress={handleAccessAnalyses}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="folder-open" size={28} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <ThemedText style={styles.buttonText}>Testergebnisse</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button, 
            styles.secondaryButton, 
            { backgroundColor: DesignSystem.colors.secondary.main },
            isDark && styles.buttonDark
          ]}
          onPress={handleScanNew}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="scan" size={28} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <ThemedText style={styles.buttonText}>Testergebnis scannen</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button, 
            styles.accentButton, 
            { backgroundColor: DesignSystem.colors.accent.main },
            isDark && styles.buttonDark
          ]}
          onPress={handleContactDoctor}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="call" size={28} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <ThemedText style={styles.buttonText}>Arzt kontaktieren</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button, 
            styles.medicationButton, 
            { backgroundColor: '#FF6B6B' },
            isDark && styles.buttonDark
          ]}
          onPress={handleMedications}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="medical" size={28} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <ThemedText style={styles.buttonText}>Medikament</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button, 
            styles.vaccinationButton, 
            { backgroundColor: '#FFA500' },
            isDark && styles.buttonDark
          ]}
          onPress={handleVaccinationPass}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <ThemedText style={styles.buttonText}>Impfpass</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button, 
            styles.chatButton, 
            { backgroundColor: '#b9d3ee' },
            isDark && styles.buttonDark
          ]}
          onPress={handleChat}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="chatbubbles" size={28} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <ThemedText style={styles.buttonText}>Chat</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button, 
            styles.settingsButton, 
            { 
              backgroundColor: isDark 
                ? DesignSystem.colors.neutral[700] 
                : DesignSystem.colors.neutral[600] 
            },
            isDark && styles.buttonDark
          ]}
          onPress={handleSettings}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="settings" size={28} color="#fff" />
          </View>
          <View style={styles.buttonContent}>
            <ThemedText style={styles.buttonText}>Einstellungen</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={{ opacity: 0.7 }} />
        </TouchableOpacity>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  headerIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerIcon: {
    opacity: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.xl,
    paddingHorizontal: DesignSystem.spacing.md,
  },
  appTitle: {
    fontSize: DesignSystem.typography.fontSize['4xl'],
    fontWeight: DesignSystem.typography.fontWeight.bold,
    marginBottom: DesignSystem.spacing.sm,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: DesignSystem.typography.fontSize.base,
    textAlign: 'center',
    lineHeight: DesignSystem.typography.fontSize.base * 1.5,
    maxWidth: 300,
  },
  buttonsContainer: {
    gap: DesignSystem.spacing.md,
    paddingBottom: DesignSystem.spacing.xl,
    paddingHorizontal: DesignSystem.spacing.md,
  },
  button: {
    borderRadius: DesignSystem.borderRadius.lg,
    padding: DesignSystem.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.md,
    ...DesignSystem.shadows.lg,
    minHeight: 80,
  },
  buttonDark: {
    shadowOpacity: 0.4,
  },
  buttonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: DesignSystem.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flex: 1,
  },
  buttonText: {
    fontSize: DesignSystem.typography.fontSize.lg,
    fontWeight: DesignSystem.typography.fontWeight.semibold,
    color: '#fff',
  },
  primaryButton: {},
  secondaryButton: {},
  accentButton: {},
  medicationButton: {},
  vaccinationButton: {},
  chatButton: {},
  settingsButton: {},
  webWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    marginBottom: DesignSystem.spacing.md,
    gap: DesignSystem.spacing.sm,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  webWarningText: {
    flex: 1,
    fontSize: DesignSystem.typography.fontSize.sm,
    color: '#856404',
  },
});
