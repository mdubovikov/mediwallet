import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { TestResult, NewTestResult } from '@/types/test-result';
import { UserSettings, NewUserSettings } from '@/types/user-settings';
import { Medication, NewMedication } from '@/types/medication';
import { Vaccination, NewVaccination } from '@/types/vaccination';

const DB_NAME = 'mediwallet.db';

let db: SQLite.SQLiteDatabase | null = null;

// Eindeutige Benutzer-ID generieren
const generateUserId = (): string => {
  // Einfache UUID-ähnliche ID generieren
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      result += '-';
    }
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

// Datenbank initialisieren
export const initDatabase = async (): Promise<void> => {
  // Wenn bereits initialisiert, früh zurückkehren
  if (db) {
    console.log('Database already initialized');
    return;
  }

  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // Tabellen erstellen
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        test_type TEXT NOT NULL,
        image_path TEXT NOT NULL,
        results TEXT,
        notes TEXT,
        analyzed_data TEXT
      );
      
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        user_name TEXT NOT NULL,
        user_phone TEXT,
        user_email TEXT,
        user_address TEXT,
        user_date_of_birth TEXT,
        insurance_company TEXT,
        insurance_number TEXT,
        doctor_name TEXT NOT NULL,
        doctor_phone TEXT,
        doctor_email TEXT,
        doctor_address TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS test_result_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_result_id INTEGER NOT NULL,
        doctor_name TEXT NOT NULL,
        doctor_email TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (test_result_id) REFERENCES test_results(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        read INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        dosage TEXT,
        frequency TEXT,
        notes TEXT,
        reminder_enabled INTEGER DEFAULT 0,
        reminder_times TEXT,
        created_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS vaccinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_chat_sender_receiver ON chat_messages(sender_id, receiver_id);
      CREATE INDEX IF NOT EXISTS idx_chat_receiver_sender ON chat_messages(receiver_id, sender_id);
    `);
    
    // Migration: Neue Spalten hinzufügen, falls sie nicht existieren
    try {
      // Prüfe, ob die Tabelle existiert und welche Spalten vorhanden sind
      const tableInfo = await db.getAllAsync<any>(
        "PRAGMA table_info(user_settings)"
      );
      const existingColumns = tableInfo.map((col: any) => col.name);
      
      // Füge fehlende Spalten hinzu
      if (!existingColumns.includes('user_phone')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN user_phone TEXT;');
        console.log('Added column: user_phone');
      }
      if (!existingColumns.includes('user_email')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN user_email TEXT;');
        console.log('Added column: user_email');
      }
      if (!existingColumns.includes('user_address')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN user_address TEXT;');
        console.log('Added column: user_address');
      }
      if (!existingColumns.includes('user_date_of_birth')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN user_date_of_birth TEXT;');
        console.log('Added column: user_date_of_birth');
      }
      if (!existingColumns.includes('insurance_company')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN insurance_company TEXT;');
        console.log('Added column: insurance_company');
      }
      if (!existingColumns.includes('insurance_number')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN insurance_number TEXT;');
        console.log('Added column: insurance_number');
      }
      if (!existingColumns.includes('openai_api_key')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN openai_api_key TEXT;');
        console.log('Added column: openai_api_key');
      }
      if (!existingColumns.includes('ai_provider')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN ai_provider TEXT;');
        console.log('Added column: ai_provider');
      }
      if (!existingColumns.includes('ai_api_key')) {
        await db.execAsync('ALTER TABLE user_settings ADD COLUMN ai_api_key TEXT;');
        console.log('Added column: ai_api_key');
      }
      if (!existingColumns.includes('user_id')) {
        try {
          await db.execAsync('ALTER TABLE user_settings ADD COLUMN user_id TEXT;');
          console.log('Added column: user_id');
          // Generiere eine UUID für bestehende Nutzer ohne user_id
          try {
            const existingUsers = await db.getAllAsync<any>('SELECT id FROM user_settings WHERE user_id IS NULL');
            for (const user of existingUsers) {
              const uuid = generateUserId();
              await db.runAsync('UPDATE user_settings SET user_id = ? WHERE id = ?', [uuid, user.id]);
              console.log('Generated user_id for user:', user.id);
            }
          } catch (updateError) {
            console.error('Error updating existing users with user_id:', updateError);
          }
        } catch (addColumnError) {
          console.error('Error adding user_id column:', addColumnError);
          throw addColumnError;
        }
      }
    } catch (migrationError) {
      // Migration-Fehler nicht ignorieren - wichtig für user_id
      console.error('Migration error:', migrationError);
      // Versuche trotzdem fortzufahren, aber logge den Fehler
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    db = null; // Bei Fehler zurücksetzen
    throw error;
  }
};

// Bild in permanenten Speicher speichern
export const saveImage = async (sourceUri: string): Promise<string> => {
  try {
    console.log('saveImage: Starting, sourceUri:', sourceUri);
    const timestamp = Date.now();
    const filename = `test_${timestamp}.jpg`;
    
    // Dokumentenverzeichnis mit neuer API abrufen
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      throw new Error('Document directory is not available');
    }
    
    const directory = `${docDir}medical_tests/`;
    
    console.log('saveImage: Directory path:', directory);
    console.log('saveImage: Document directory:', docDir);
    
    // Verzeichnis erstellen, falls es nicht existiert
    const dirInfo = await FileSystem.getInfoAsync(directory);
    console.log('saveImage: Directory exists:', dirInfo.exists);
    
    if (!dirInfo.exists) {
      console.log('saveImage: Creating directory...');
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      console.log('saveImage: Directory created');
    }
    
    const destinationUri = `${directory}${filename}`;
    console.log('saveImage: Destination URI:', destinationUri);
    
    // Bild in permanenten Speicher kopieren
    console.log('saveImage: Copying file...');
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });
    
    console.log('saveImage: Image saved successfully to:', destinationUri);
    return destinationUri;
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
};

// Neues Testergebnis hinzufügen
export const addTestResult = async (testResult: NewTestResult): Promise<number> => {
  // Wenn Datenbank nicht initialisiert ist, versuchen zu initialisieren
  if (!db) {
    console.log('Database not initialized, attempting to initialize...');
    await initDatabase();
    if (!db) {
      throw new Error('Failed to initialize database. Please restart the app.');
    }
  }
  
  try {
    console.log('addTestResult: Inserting test result:', {
      testType: testResult.testType,
      imagePath: testResult.imagePath,
      notes: testResult.notes,
    });
    
    const result = await db.runAsync(
      `INSERT INTO test_results (created_at, test_type, image_path, results, notes, analyzed_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        new Date().toISOString(),
        testResult.testType,
        testResult.imagePath,
        testResult.results || null,
        testResult.notes || null,
        testResult.analyzedData || null,
      ]
    );
    
    const insertedId = result.lastInsertRowId;
    console.log('addTestResult: Test result added successfully with ID:', insertedId);
    return insertedId;
  } catch (error: any) {
    console.error('addTestResult: Error adding test result:', error);
    console.error('addTestResult: Error message:', error?.message);
    console.error('addTestResult: Error stack:', error?.stack);
    
    // Wenn Datenbankverbindung verloren geht, versuchen erneut zu initialisieren
    if (error?.message?.includes('closed') || error?.message?.includes('not open')) {
      console.log('addTestResult: Database connection lost, reinitializing...');
      db = null;
      await initDatabase();
      // Einmal erneut versuchen
      try {
        const retryResult = await db!.runAsync(
          `INSERT INTO test_results (created_at, test_type, image_path, results, notes, analyzed_data)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            new Date().toISOString(),
            testResult.testType,
            testResult.imagePath,
            testResult.results || null,
            testResult.notes || null,
            testResult.analyzedData || null,
          ]
        );
        console.log('addTestResult: Retry successful, ID:', retryResult.lastInsertRowId);
        return retryResult.lastInsertRowId;
      } catch (retryError) {
        console.error('addTestResult: Retry failed:', retryError);
        throw new Error(`Failed to save test result after retry: ${retryError}`);
      }
    }
    
    throw error;
  }
};

// Alle Testergebnisse abrufen
export const getAllTestResults = async (): Promise<TestResult[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const results = await db.getAllAsync<any>(
      'SELECT * FROM test_results ORDER BY created_at DESC'
    );
    
    return results.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      testType: row.test_type,
      imagePath: row.image_path,
      results: row.results || undefined,
      notes: row.notes || undefined,
      analyzedData: row.analyzed_data || undefined,
    }));
  } catch (error) {
    console.error('Error getting test results:', error);
    throw error;
  }
};

// Testergebnis nach ID abrufen
export const getTestResultById = async (id: number): Promise<TestResult | null> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.getFirstAsync<any>(
      'SELECT * FROM test_results WHERE id = ?',
      [id]
    );
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      createdAt: result.created_at,
      testType: result.test_type,
      imagePath: result.image_path,
      results: result.results || undefined,
      notes: result.notes || undefined,
      analyzedData: result.analyzed_data || undefined,
    };
  } catch (error) {
    console.error('Error getting test result by ID:', error);
    throw error;
  }
};

// Testergebnis aktualisieren
export const updateTestResult = async (
  id: number,
  updates: Partial<Omit<TestResult, 'id' | 'createdAt'>>
): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.testType !== undefined) {
      fields.push('test_type = ?');
      values.push(updates.testType);
    }
    if (updates.results !== undefined) {
      fields.push('results = ?');
      values.push(updates.results);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.analyzedData !== undefined) {
      fields.push('analyzed_data = ?');
      values.push(updates.analyzedData || null);
    }
    
    if (fields.length === 0) {
      return;
    }
    
    values.push(id);
    
    await db.runAsync(
      `UPDATE test_results SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    console.log('Test result updated:', id);
  } catch (error) {
    console.error('Error updating test result:', error);
    throw error;
  }
};

// Testergebnis löschen
export const deleteTestResult = async (id: number): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    // Bildpfad vor dem Löschen abrufen
    const testResult = await getTestResultById(id);
    
    if (testResult) {
      // Bilddatei löschen
      const fileInfo = await FileSystem.getInfoAsync(testResult.imagePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(testResult.imagePath);
        console.log('Image file deleted:', testResult.imagePath);
      }
    }
    
    // Aus Datenbank löschen
    await db.runAsync('DELETE FROM test_results WHERE id = ?', [id]);
    
    console.log('Test result deleted:', id);
  } catch (error) {
    console.error('Error deleting test result:', error);
    throw error;
  }
};

// Datenbankstatistiken abrufen
export const getDatabaseStats = async (): Promise<{
  totalTests: number;
  totalSize: number;
}> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const countResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM test_results'
    );
    
    const totalTests = countResult?.count || 0;
    
    // Gesamtgröße der Bilder berechnen
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      return { totalTests, totalSize: 0 };
    }
    
    const directory = `${docDir}medical_tests/`;
    let totalSize = 0;
    
    try {
      const dirInfo = await FileSystem.getInfoAsync(directory);
      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(directory);
        for (const file of files) {
          const fileInfo = await FileSystem.getInfoAsync(`${directory}${file}`);
          if (fileInfo.exists && !fileInfo.isDirectory) {
            totalSize += fileInfo.size || 0;
          }
        }
      }
    } catch (err) {
      console.warn('Could not calculate directory size:', err);
    }
    
    return {
      totalTests,
      totalSize,
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    throw error;
  }
};

// Benutzereinstellungen abrufen
export const getUserSettings = async (): Promise<UserSettings | null> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    // Prüfe zuerst, ob die Spalte user_id existiert
    const tableInfo = await db.getAllAsync<any>("PRAGMA table_info(user_settings)");
    const existingColumns = tableInfo.map((col: any) => col.name);
    const hasUserIdColumn = existingColumns.includes('user_id');
    
    // Wähle nur vorhandene Spalten aus
    let query = 'SELECT ';
    if (hasUserIdColumn) {
      query += 'id, user_id, user_name, user_phone, user_email, user_address, user_date_of_birth, ';
    } else {
      query += 'id, user_name, user_phone, user_email, user_address, user_date_of_birth, ';
    }
    query += 'insurance_company, insurance_number, doctor_name, doctor_phone, doctor_email, doctor_address, ';
    query += 'openai_api_key, ai_provider, ai_api_key, created_at, updated_at ';
    query += 'FROM user_settings ORDER BY id DESC LIMIT 1';
    
    const result = await db.getFirstAsync<any>(query);
    
    if (!result) {
      return null;
    }
    
    // Wenn keine user_id vorhanden ist, versuche sie hinzuzufügen und zu generieren
    if (!hasUserIdColumn || !result.user_id) {
      try {
        // Versuche die Spalte hinzuzufügen, falls sie nicht existiert
        if (!hasUserIdColumn) {
          await db.execAsync('ALTER TABLE user_settings ADD COLUMN user_id TEXT;');
          console.log('Added user_id column in getUserSettings');
        }
        // Generiere eine UUID
        const userId = generateUserId();
        await db.runAsync('UPDATE user_settings SET user_id = ? WHERE id = ?', [userId, result.id]);
        result.user_id = userId;
        console.log('Generated user_id for user:', result.id);
      } catch (error) {
        console.error('Error adding/generating user_id:', error);
        // Fallback: Verwende eine temporäre ID basierend auf dem Namen
        result.user_id = result.user_name || `user_${result.id}`;
      }
    }
    
    return {
      id: result.id,
      userId: result.user_id || result.user_name || `user_${result.id}`,
      userName: result.user_name,
      userPhone: result.user_phone || undefined,
      userEmail: result.user_email || undefined,
      userAddress: result.user_address || undefined,
      userDateOfBirth: result.user_date_of_birth || undefined,
      insuranceCompany: result.insurance_company || undefined,
      insuranceNumber: result.insurance_number || undefined,
      doctorName: result.doctor_name,
      doctorPhone: result.doctor_phone || undefined,
      doctorEmail: result.doctor_email || undefined,
      doctorAddress: result.doctor_address || undefined,
      openaiApiKey: result.openai_api_key || undefined,
      aiProvider: result.ai_provider || undefined,
      aiApiKey: result.ai_api_key || undefined,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw error;
  }
};

// Benutzereinstellungen speichern oder aktualisieren
export const saveUserSettings = async (settings: NewUserSettings): Promise<number> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    // Prüfen, ob bereits Einstellungen existieren
    const existing = await getUserSettings();
    const now = new Date().toISOString();
    
    if (existing) {
      // Aktualisieren - user_id bleibt unverändert
      await db.runAsync(
        `UPDATE user_settings 
          SET user_name = ?, user_phone = ?, user_email = ?, user_address = ?, user_date_of_birth = ?,
              insurance_company = ?, insurance_number = ?,
              doctor_name = ?, doctor_phone = ?, doctor_email = ?, doctor_address = ?,
              openai_api_key = ?, ai_provider = ?, ai_api_key = ?, updated_at = ?
          WHERE id = ?`,
        [
          settings.userName,
          settings.userPhone || null,
          settings.userEmail || null,
          settings.userAddress || null,
          settings.userDateOfBirth || null,
          settings.insuranceCompany || null,
          settings.insuranceNumber || null,
          settings.doctorName,
          settings.doctorPhone || null,
          settings.doctorEmail || null,
          settings.doctorAddress || null,
          settings.openaiApiKey || null,
          settings.aiProvider || null,
          settings.aiApiKey || null,
          now,
          existing.id,
        ]
      );
      console.log('User settings updated:', existing.id);
      return existing.id;
    } else {
      // Neu erstellen - generiere user_id
      const userId = generateUserId();
      const result = await db.runAsync(
        `INSERT INTO user_settings (user_id, user_name, user_phone, user_email, user_address, user_date_of_birth,
                                    insurance_company, insurance_number,
                                    doctor_name, doctor_phone, doctor_email, doctor_address,
                                    openai_api_key, ai_provider, ai_api_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          settings.userName,
          settings.userPhone || null,
          settings.userEmail || null,
          settings.userAddress || null,
          settings.userDateOfBirth || null,
          settings.insuranceCompany || null,
          settings.insuranceNumber || null,
          settings.doctorName,
          settings.doctorPhone || null,
          settings.doctorEmail || null,
          settings.doctorAddress || null,
          settings.openaiApiKey || null,
          settings.aiProvider || null,
          settings.aiApiKey || null,
          now,
          now,
        ]
      );
      const insertedId = result.lastInsertRowId;
      console.log('User settings created:', insertedId, 'with userId:', userId);
      return insertedId;
    }
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

// Test-Ergebnis-Freigabe erstellen
export const createTestResultShare = async (
  testResultId: number,
  doctorName: string,
  doctorEmail: string | null,
  expiresAt: string
): Promise<number> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const now = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO test_result_shares (test_result_id, doctor_name, doctor_email, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [testResultId, doctorName, doctorEmail || null, expiresAt, now]
    );
    
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error creating test result share:', error);
    throw error;
  }
};

// Alle Freigaben für ein Test-Ergebnis abrufen
export const getTestResultShares = async (testResultId: number): Promise<any[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const shares = await db.getAllAsync<any>(
      `SELECT * FROM test_result_shares 
       WHERE test_result_id = ? 
       ORDER BY created_at DESC`,
      [testResultId]
    );
    
    return shares;
  } catch (error) {
    console.error('Error getting test result shares:', error);
    throw error;
  }
};

// Chat-Nachricht senden
export const sendChatMessage = async (message: NewChatMessage): Promise<number> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const now = new Date().toISOString();
    console.log('Saving chat message to database:', {
      senderId: message.senderId,
      receiverId: message.receiverId,
      message: message.message.substring(0, 50),
      now,
    });
    
    const result = await db.runAsync(
      `INSERT INTO chat_messages (sender_id, receiver_id, message, created_at, read)
       VALUES (?, ?, ?, ?, 0)`,
      [message.senderId, message.receiverId, message.message, now]
    );
    
    console.log('Chat message saved successfully with ID:', result.lastInsertRowId);
    
    // Verifiziere, dass die Nachricht gespeichert wurde
    const savedMessage = await db.getFirstAsync<any>(
      'SELECT * FROM chat_messages WHERE id = ?',
      [result.lastInsertRowId]
    );
    console.log('Verified saved message:', savedMessage);
    console.log('Verified saved message.message:', savedMessage?.message);
    console.log('Verified saved message.message type:', typeof savedMessage?.message);
    console.log('Verified saved message.message value:', JSON.stringify(savedMessage?.message));
    
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
};

// Chat-Nachrichten zwischen zwei Nutzern abrufen
export const getChatMessages = async (
  userId1: string,
  userId2: string
): Promise<ChatMessage[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    console.log('Getting chat messages for:', { userId1, userId2 });
    
    // Prüfe alle Nachrichten in der Datenbank (für Debugging)
    const allMessages = await db.getAllAsync<any>('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 20');
    console.log('All recent messages in database:', allMessages.length);
    allMessages.forEach((msg: any, index: number) => {
      console.log(`Message ${index}:`, {
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        message: msg.message?.substring(0, 50),
        created_at: msg.created_at,
      });
    });
    
    const messages = await db.getAllAsync<any>(
      `SELECT * FROM chat_messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`,
      [userId1, userId2, userId2, userId1]
    );
    
    console.log('Found messages for this conversation:', messages.length);
    console.log('Raw messages from DB:', JSON.stringify(messages, null, 2));
    
    const mappedMessages = messages.map((msg: any) => {
      // Stelle sicher, dass die Nachricht korrekt extrahiert wird
      // Prüfe alle möglichen Feldnamen
      const messageText = msg.message !== null && msg.message !== undefined 
        ? String(msg.message) 
        : (msg.message_text !== null && msg.message_text !== undefined
          ? String(msg.message_text)
          : '');
      
      const mapped = {
        id: msg.id,
        senderId: String(msg.sender_id || msg.senderId || ''),
        receiverId: String(msg.receiver_id || msg.receiverId || ''),
        message: messageText,
        createdAt: String(msg.created_at || msg.createdAt || ''),
        read: msg.read === 1 || msg.read === true,
      };
      
      console.log('Mapping message:', {
        rawMsg: msg,
        rawMessageField: msg.message,
        rawMessageType: typeof msg.message,
        rawMessageValue: JSON.stringify(msg.message),
        allKeys: Object.keys(msg),
        mappedMessage: mapped.message,
        mappedMessageType: typeof mapped.message,
        fullMapped: mapped,
      });
      
      return mapped;
    });
    
    console.log('Final mapped messages:', JSON.stringify(mappedMessages, null, 2));
    return mappedMessages;
  } catch (error) {
    console.error('Error getting chat messages:', error);
    throw error;
  }
};

// Chat-Nachrichten als gelesen markieren
export const markChatMessagesAsRead = async (
  senderId: string,
  receiverId: string
): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync(
      `UPDATE chat_messages SET read = 1
       WHERE sender_id = ? AND receiver_id = ? AND read = 0`,
      [senderId, receiverId]
    );
    
    console.log('Chat messages marked as read');
  } catch (error) {
    console.error('Error marking chat messages as read:', error);
    throw error;
  }
};

// Chat-Konversationen für einen Nutzer abrufen
export const getChatConversations = async (userId: string): Promise<ChatConversation[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    // Hole alle eindeutigen Chat-Partner
    const conversations = await db.getAllAsync<any>(
      `SELECT 
        CASE 
          WHEN sender_id = ? THEN receiver_id
          ELSE sender_id
        END as partner_id,
        MAX(created_at) as last_message_time,
        COUNT(CASE WHEN sender_id != ? AND read = 0 THEN 1 END) as unread_count
       FROM chat_messages
       WHERE sender_id = ? OR receiver_id = ?
       GROUP BY partner_id
       ORDER BY last_message_time DESC`,
      [userId, userId, userId, userId]
    );
    
    // Hole die letzte Nachricht für jede Konversation
    const result: ChatConversation[] = [];
    for (const conv of conversations) {
      const lastMessage = await db.getFirstAsync<any>(
        `SELECT message FROM chat_messages
         WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
         ORDER BY created_at DESC LIMIT 1`,
        [userId, conv.partner_id, conv.partner_id, userId]
      );
      
      result.push({
        userId: conv.partner_id,
        userName: conv.partner_id, // Kann später durch Benutzername ersetzt werden
        lastMessage: lastMessage?.message || undefined,
        lastMessageTime: conv.last_message_time || undefined,
        unreadCount: conv.unread_count || 0,
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error getting chat conversations:', error);
    throw error;
  }
};

// Hilfsfunktion: Stelle sicher, dass die medications-Tabelle existiert
const ensureMedicationsTable = async (): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const tables = await db.getAllAsync<any>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='medications'"
    );
    
    if (tables.length === 0) {
      console.log('Creating medications table...');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS medications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          dosage TEXT,
          frequency TEXT,
          notes TEXT,
          reminder_enabled INTEGER DEFAULT 0,
          reminder_times TEXT,
          push_notification_enabled INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);
      console.log('Medications table created');
    } else {
      // Migration: Prüfe, ob neue Spalten existieren
      const tableInfo = await db.getAllAsync<any>(
        "PRAGMA table_info(medications)"
      );
      const existingColumns = tableInfo.map((col: any) => col.name);
      
      if (!existingColumns.includes('reminder_enabled')) {
        await db.execAsync('ALTER TABLE medications ADD COLUMN reminder_enabled INTEGER DEFAULT 0;');
        console.log('Added column: reminder_enabled');
      }
      if (!existingColumns.includes('reminder_times')) {
        await db.execAsync('ALTER TABLE medications ADD COLUMN reminder_times TEXT;');
        console.log('Added column: reminder_times');
      }
    }
  } catch (error) {
    console.error('Error ensuring medications table:', error);
    throw error;
  }
};

// Medikament hinzufügen
export const addMedication = async (medication: NewMedication): Promise<number> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureMedicationsTable();
    
    const now = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO medications (name, dosage, frequency, notes, reminder_enabled, reminder_times, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        medication.name,
        medication.dosage || null,
        medication.frequency || null,
        medication.notes || null,
        medication.reminderEnabled ? 1 : 0,
        medication.reminderTimes || null,
        now,
      ]
    );
    
    const insertedId = result.lastInsertRowId;
    console.log('Medication added:', insertedId);
    return insertedId;
  } catch (error) {
    console.error('Error adding medication:', error);
    throw error;
  }
};

// Alle Medikamente abrufen
export const getAllMedications = async (): Promise<Medication[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureMedicationsTable();
    
    const result = await db.getAllAsync<any>(
      `SELECT id, name, dosage, frequency, notes, reminder_enabled, reminder_times, created_at
       FROM medications
       ORDER BY name ASC`
    );
    
    return result.map((row) => ({
      id: row.id,
      name: row.name,
      dosage: row.dosage || undefined,
      frequency: row.frequency || undefined,
      notes: row.notes || undefined,
      reminderEnabled: row.reminder_enabled === 1,
      reminderTimes: row.reminder_times || undefined,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting medications:', error);
    throw error;
  }
};

// Medikament nach ID abrufen
export const getMedicationById = async (id: number): Promise<Medication | null> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureMedicationsTable();
    
    const result = await db.getFirstAsync<any>(
      `SELECT id, name, dosage, frequency, notes, reminder_enabled, reminder_times, created_at
       FROM medications
       WHERE id = ?`,
      [id]
    );
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      name: result.name,
      dosage: result.dosage || undefined,
      frequency: result.frequency || undefined,
      notes: result.notes || undefined,
      reminderEnabled: result.reminder_enabled === 1,
      reminderTimes: result.reminder_times || undefined,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error('Error getting medication by id:', error);
    throw error;
  }
};

// Medikament aktualisieren
export const updateMedication = async (
  id: number,
  updates: Partial<NewMedication>
): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureMedicationsTable();
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.dosage !== undefined) {
      fields.push('dosage = ?');
      values.push(updates.dosage);
    }
    if (updates.frequency !== undefined) {
      fields.push('frequency = ?');
      values.push(updates.frequency);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.reminderEnabled !== undefined) {
      fields.push('reminder_enabled = ?');
      values.push(updates.reminderEnabled ? 1 : 0);
    }
    if (updates.reminderTimes !== undefined) {
      fields.push('reminder_times = ?');
      values.push(updates.reminderTimes);
    }
    
    if (fields.length === 0) {
      return; // Keine Updates
    }
    
    values.push(id);
    
    await db.runAsync(
      `UPDATE medications SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    console.log('Medication updated:', id);
  } catch (error) {
    console.error('Error updating medication:', error);
    throw error;
  }
};

// Medikament löschen
export const deleteMedication = async (id: number): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureMedicationsTable();
    
    await db.runAsync('DELETE FROM medications WHERE id = ?', [id]);
    console.log('Medication deleted:', id);
  } catch (error) {
    console.error('Error deleting medication:', error);
    throw error;
  }
};

// Hilfsfunktion: Stelle sicher, dass die vaccinations-Tabelle existiert
const ensureVaccinationsTable = async (): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const tables = await db.getAllAsync<any>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vaccinations'"
    );
    
    if (tables.length === 0) {
      console.log('Creating vaccinations table...');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS vaccinations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          date TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        );
      `);
      console.log('Vaccinations table created');
    }
  } catch (error) {
    console.error('Error ensuring vaccinations table:', error);
    throw error;
  }
};

// Impfung hinzufügen
export const addVaccination = async (vaccination: NewVaccination): Promise<number> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureVaccinationsTable();
    
    const now = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO vaccinations (name, date, notes, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        vaccination.name,
        vaccination.date,
        vaccination.notes || null,
        now,
      ]
    );
    
    const insertedId = result.lastInsertRowId;
    console.log('Vaccination added:', insertedId);
    return insertedId;
  } catch (error) {
    console.error('Error adding vaccination:', error);
    throw error;
  }
};

// Alle Impfungen abrufen
export const getAllVaccinations = async (): Promise<Vaccination[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureVaccinationsTable();
    
    const result = await db.getAllAsync<any>(
      `SELECT id, name, date, notes, created_at
       FROM vaccinations
       ORDER BY date DESC`
    );
    
    return result.map((row) => ({
      id: row.id,
      name: row.name,
      date: row.date,
      notes: row.notes || undefined,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting vaccinations:', error);
    throw error;
  }
};

// Impfung nach ID abrufen
export const getVaccinationById = async (id: number): Promise<Vaccination | null> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureVaccinationsTable();
    
    const result = await db.getFirstAsync<any>(
      `SELECT id, name, date, notes, created_at
       FROM vaccinations
       WHERE id = ?`,
      [id]
    );
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      name: result.name,
      date: result.date,
      notes: result.notes || undefined,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error('Error getting vaccination by id:', error);
    throw error;
  }
};

// Impfung aktualisieren
export const updateVaccination = async (
  id: number,
  updates: Partial<NewVaccination>
): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureVaccinationsTable();
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.date !== undefined) {
      fields.push('date = ?');
      values.push(updates.date);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    
    if (fields.length === 0) {
      return; // Keine Updates
    }
    
    values.push(id);
    
    await db.runAsync(
      `UPDATE vaccinations SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    console.log('Vaccination updated:', id);
  } catch (error) {
    console.error('Error updating vaccination:', error);
    throw error;
  }
};

// Impfung löschen
export const deleteVaccination = async (id: number): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await ensureVaccinationsTable();
    
    await db.runAsync('DELETE FROM vaccinations WHERE id = ?', [id]);
    console.log('Vaccination deleted:', id);
  } catch (error) {
    console.error('Error deleting vaccination:', error);
    throw error;
  }
};
