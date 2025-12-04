/**
 * KI-Analyse-Service für medizinische Testergebnisse
 * Verwendet OpenAI Vision API zur Bildanalyse
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// API-Konfiguration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// API-Key aus Umgebungsvariablen oder Datenbank abrufen
const getOpenAIApiKey = async (): Promise<string> => {
  console.log('Getting OpenAI API Key...');
  
  // Zuerst aus Umgebungsvariablen prüfen
  const envKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
  console.log('Environment key exists:', !!envKey && envKey.trim() !== '');
  if (envKey && envKey.trim() !== '') {
    console.log('Using environment API key');
    return envKey;
  }
  
  // Dann aus Datenbank laden
  try {
    console.log('Loading API key from database...');
    const { getUserSettings } = await import('@/services/database');
    const settings = await getUserSettings();
    console.log('Settings loaded:', !!settings);
    console.log('AI Provider:', settings?.aiProvider);
    console.log('AI API Key exists:', !!settings?.aiApiKey);
    console.log('OpenAI API Key exists:', !!settings?.openaiApiKey);
    
    // Neues System: Prüfe aiProvider und aiApiKey
    if (settings?.aiProvider === 'openai' && settings?.aiApiKey && settings.aiApiKey.trim() !== '') {
      console.log('Using new system AI API key (length:', settings.aiApiKey.length, ')');
      return settings.aiApiKey;
    }
    
    // Legacy: Fallback auf openaiApiKey
    if (settings?.openaiApiKey && settings.openaiApiKey.trim() !== '') {
      console.log('Using legacy OpenAI API key (length:', settings.openaiApiKey.length, ')');
      return settings.openaiApiKey;
    }
    
    // Wenn aiApiKey vorhanden ist, aber kein Provider gesetzt, verwende es als OpenAI Key
    if (settings?.aiApiKey && settings.aiApiKey.trim() !== '') {
      console.log('Using AI API key without provider (assuming OpenAI, length:', settings.aiApiKey.length, ')');
      return settings.aiApiKey;
    }
    
    console.log('No API key found in database');
  } catch (error: any) {
    console.error('Error loading API key from database:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
  }
  
  console.log('No API key found');
  return '';
};

/**
 * Konvertiert ein Bild in Base64-Format
 */
const imageToBase64 = async (imageUri: string): Promise<string> => {
  try {
    console.log('Converting image to base64:', imageUri);
    
    if (Platform.OS === 'web') {
      // Für Web: Bild als Data URL verwenden oder konvertieren
      if (imageUri.startsWith('data:')) {
        return imageUri;
      }
      throw new Error('Web-Plattform wird derzeit nicht unterstützt');
    }

    // Prüfe, ob Datei existiert
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      throw new Error(`Bilddatei nicht gefunden: ${imageUri}`);
    }
    
    console.log('File exists, reading as base64...');
    
    // Für native Plattformen: Datei lesen und in Base64 konvertieren
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    if (!base64 || base64.length === 0) {
      throw new Error('Bild konnte nicht gelesen werden (leer)');
    }
    
    // Dateityp bestimmen
    const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
    
    const dataUrl = `data:${mimeType};base64,${base64}`;
    console.log('Image converted successfully, size:', dataUrl.length);
    
    return dataUrl;
  } catch (error: any) {
    console.error('Error converting image to base64:', error);
    throw new Error(`Fehler beim Konvertieren des Bildes: ${error.message || 'Unbekannter Fehler'}`);
  }
};

/**
 * Analysiert ein medizinisches Testergebnis-Bild mit KI
 */
export const analyzeTestResultImage = async (
  imageUri: string,
  testType: string
): Promise<string> => {
  try {
    console.log('Starting AI analysis for test type:', testType);
    console.log('Image URI:', imageUri);
    
    // API-Key abrufen
    console.log('Fetching API key...');
    const apiKey = await getOpenAIApiKey();
    console.log('API Key configured:', !!apiKey);
    console.log('API Key length:', apiKey ? apiKey.length : 0);
    console.log('API Key starts with sk-:', apiKey ? apiKey.startsWith('sk-') : false);
    
    // Prüfe, ob API-Key vorhanden ist
    if (!apiKey || apiKey.trim() === '') {
      console.warn('OpenAI API-Key nicht konfiguriert');
      throw new Error(
        'OpenAI API-Key nicht konfiguriert.\n\n' +
        'Bitte konfigurieren Sie einen API-Key in den Einstellungen:\n' +
        '1. Öffnen Sie die Einstellungen\n' +
        '2. Gehen Sie zu "KI-Analyse (OpenAI)"\n' +
        '3. Geben Sie Ihren API-Key ein (beginnt mit sk-)\n' +
        '4. Speichern Sie die Einstellungen\n\n' +
        'Sie können einen API-Key auf https://platform.openai.com/api-keys erhalten.'
      );
    }
    
    // Prüfe, ob API-Key gültig aussieht
    if (!apiKey.startsWith('sk-')) {
      console.warn('API Key format looks invalid (should start with sk-)');
      throw new Error(
        'Ungültiger API-Key-Format.\n\n' +
        'Der OpenAI API-Key sollte mit "sk-" beginnen.\n' +
        'Bitte überprüfen Sie Ihren API-Key in den Einstellungen.'
      );
    }

    // Bild in Base64 konvertieren
    console.log('Converting image to base64...');
    const base64Image = await imageToBase64(imageUri);
    console.log('Image converted, base64 length:', base64Image.length);
    
    // Prüfe Bildgröße (OpenAI hat ein Limit von ~20MB für Base64-Bilder)
    // Base64 ist etwa 33% größer als das Original
    const estimatedSizeMB = base64Image.length / (1024 * 1024) * 0.75;
    console.log('Estimated image size (MB):', estimatedSizeMB.toFixed(2));
    
    if (estimatedSizeMB > 20) {
      throw new Error(
        'Bild ist zu groß für die KI-Analyse.\n\n' +
        'Das Bild sollte kleiner als 20MB sein.\n' +
        'Bitte verwenden Sie ein kleineres Bild oder komprimieren Sie es.'
      );
    }

    // Prompt für die KI-Analyse
    const prompt = `Du bist ein medizinischer Experte. Analysiere dieses Bild eines medizinischen Testergebnisses (Typ: ${testType}).

Bitte gib eine detaillierte Analyse, die folgende Punkte umfasst:
1. Sichtbare Werte und Messungen
2. Normalwerte zum Vergleich
3. Abweichungen oder Auffälligkeiten
4. Mögliche Interpretationen (Hinweis: Dies ist keine medizinische Diagnose)
5. Empfehlungen für weitere Schritte

Antworte auf Deutsch und sei präzise, aber verständlich.`;

    // API-Anfrage vorbereiten
    console.log('Sending request to OpenAI API...');
    const requestBody = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    };
    
    console.log('Request body prepared, sending...');
    console.log('Request body size:', JSON.stringify(requestBody).length, 'bytes');
    
    let response: Response;
    try {
      response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchError: any) {
      console.error('Fetch error:', fetchError);
      throw new Error(
        `Netzwerkfehler beim Senden der Anfrage: ${fetchError.message || 'Unbekannter Fehler'}\n\n` +
        'Bitte überprüfen Sie:\n' +
        '• Ihre Internetverbindung\n' +
        '• Ob die OpenAI API erreichbar ist\n' +
        '• Versuchen Sie es später erneut'
      );
    }

    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `API-Fehler: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('API Error data:', errorData);
        
        if (errorData.error) {
          errorMessage = errorData.error.message || errorMessage;
          
          // Spezifische Fehlermeldungen
          if (errorData.error.code === 'invalid_api_key') {
            errorMessage = 'Ungültiger API-Key. Bitte überprüfen Sie Ihre API-Key-Konfiguration.';
          } else if (errorData.error.code === 'insufficient_quota') {
            errorMessage = 'API-Kontingent erschöpft. Bitte überprüfen Sie Ihr OpenAI-Konto.';
          } else if (errorData.error.code === 'rate_limit_exceeded') {
            errorMessage = 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.';
          }
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
        const responseText = await response.text().catch(() => '');
        console.error('Response text:', responseText);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Response received, parsing...');
    
    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      console.error('No analysis in response:', data);
      throw new Error('Keine Analyse-Ergebnisse erhalten. Bitte versuchen Sie es erneut.');
    }

    console.log('Analysis successful, length:', analysis.length);
    return analysis;
  } catch (error: any) {
    console.error('Error analyzing test result:', error);
    console.error('Error stack:', error.stack);
    
    // Benutzerfreundliche Fehlermeldungen
    if (error.message && error.message.includes('API-Key')) {
      throw error; // Fehlermeldung bereits benutzerfreundlich
    }
    
    if (error.message && error.message.includes('Web-Plattform')) {
      throw new Error('KI-Analyse ist auf Web-Plattformen derzeit nicht verfügbar.');
    }
    
    if (error.message && error.message.includes('Bild')) {
      throw error; // Bild-Fehler bereits benutzerfreundlich
    }
    
    // Netzwerk-Fehler
    if (error.message && (error.message.includes('fetch') || error.message.includes('network'))) {
      throw new Error(
        'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'
      );
    }
    
    throw new Error(
      error.message || 'Fehler bei der KI-Analyse. Bitte versuchen Sie es später erneut.'
    );
  }
};

/**
 * Prüft, ob die KI-Analyse verfügbar ist
 */
export const isAIAnalysisAvailable = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return false;
  }
  
  const apiKey = await getOpenAIApiKey();
  return !!apiKey && apiKey.trim() !== '';
};

