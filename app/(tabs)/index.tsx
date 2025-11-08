import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Test types available for selection
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
      // On web, show message using window.alert if available, otherwise use Alert
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
      // Import database functions
      const dbModule = await import('@/services/database');
      const { initDatabase, saveImage, addTestResult } = dbModule;
      console.log('Database module imported:', Object.keys(dbModule));

      console.log('Step 2: Ensuring database is ready...');
      // Ensure database is initialized (safe to call multiple times)
      // Database will auto-initialize in addTestResult if needed
      try {
        await initDatabase();
        console.log('Database initialized successfully');
      } catch (initError: any) {
        console.log('Database init check (may already be initialized):', initError?.message);
        // Continue anyway - addTestResult will handle initialization
      }

      console.log('Step 3: Saving image...');
      console.log('Image URI:', imageUri);
      // Save image to permanent storage
      let permanentPath: string;
      try {
        permanentPath = await saveImage(imageUri);
        console.log('Image saved successfully to:', permanentPath);
      } catch (saveError: any) {
        console.error('Error saving image:', saveError);
        throw new Error(`Failed to save image: ${saveError?.message || saveError}`);
      }

      // Step 3.5: Select test type if not provided
      let selectedTestType = testType;
      if (!selectedTestType) {
        selectedTestType = await selectTestType(imageUri, permanentPath);
        if (!selectedTestType) {
          console.log('Test type selection cancelled');
          return;
        }
      }

      console.log('Step 4: Adding test result to database...');
      // Save to database
      let testId: number;
      try {
        testId = await addTestResult({
          testType: selectedTestType,
          imagePath: permanentPath,
          notes: 'Scanned from camera/gallery',
        });
        console.log('Test result added successfully with ID:', testId);
      } catch (dbError: any) {
        console.error('Error adding to database:', dbError);
        throw new Error(`Failed to save to database: ${dbError?.message || dbError}`);
      }

      console.log('=== saveTestResult SUCCESS ===');
      Alert.alert(
        'Success',
        `Test result saved successfully!\nType: ${selectedTestType}\nID: ${testId}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('=== Error saving test result ===');
      console.error('Error object:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      
      // Show more specific error message
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
        // Show detailed error for debugging
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
      // On web, use window.alert and allow file selection
      if (typeof window !== 'undefined' && window.confirm) {
        const useFileInput = window.confirm(
          'On web, you can select an image file. Would you like to choose an image?'
        );
        if (useFileInput) {
          // Create a file input element
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file) {
              // Create a data URL from the file
              const reader = new FileReader();
              reader.onload = async (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) {
                  // Save the test result with the data URL
                  await saveTestResult(dataUrl);
                }
              };
              reader.readAsDataURL(file);
            }
          };
          input.click();
        }
      } else {
        // Fallback to Alert.alert if window.confirm is not available
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

  const handleAnalyzeCondition = () => {
    console.log('Analyze Health Status');
    // TODO: Show health status analysis
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#4A90E2', dark: '#1a4d7a' }}
      headerImage={
        <View style={styles.headerContainer}>
          <Ionicons name="medical" size={120} color="#fff" style={styles.headerIcon} />
        </View>
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">MediWallet</ThemedText>
      </ThemedView>
      
      <ThemedView style={styles.welcomeContainer}>
        <ThemedText style={styles.welcomeText}>
          Manage your medical test results
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton, isDark && styles.buttonDark]}
          onPress={handleAccessAnalyses}
          activeOpacity={0.7}
        >
          <Ionicons name="folder-open" size={32} color="#fff" />
          <ThemedText style={styles.buttonText}>Access Test Results</ThemedText>
          <ThemedText style={styles.buttonDescription}>
            View all saved test results
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton, isDark && styles.buttonDark]}
          onPress={handleScanNew}
          activeOpacity={0.7}
        >
          <Ionicons name="scan" size={32} color="#fff" />
          <ThemedText style={styles.buttonText}>Scan New Test</ThemedText>
          <ThemedText style={styles.buttonDescription}>
            Add new test results
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.accentButton, isDark && styles.buttonDark]}
          onPress={handleAnalyzeCondition}
          activeOpacity={0.7}
        >
          <Ionicons name="analytics" size={32} color="#fff" />
          <ThemedText style={styles.buttonText}>Analyze Health Status</ThemedText>
          <ThemedText style={styles.buttonDescription}>
            Get overall health assessment
          </ThemedText>
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
  headerIcon: {
    opacity: 0.9,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  buttonsContainer: {
    gap: 20,
    paddingBottom: 32,
  },
  button: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
  },
  secondaryButton: {
    backgroundColor: '#50C878',
  },
  accentButton: {
    backgroundColor: '#9B59B6',
  },
  buttonDark: {
    shadowOpacity: 0.3,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  buttonDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  webWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  webWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
  },
});
