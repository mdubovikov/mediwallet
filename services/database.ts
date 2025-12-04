// Plattformspezifisches Datenbankmodul-Re-Export
// Diese Datei stellt eine ordnungsgemäße Modulauflösung für dynamische Imports sicher
// Metro-Bundler löst automatisch .native.ts oder .web.ts basierend auf der Plattform auf
// Für Web-Plattform müssen wir explizit die .web-Erweiterung verwenden
// Für native Plattformen verwenden wir die .native-Erweiterung

// Bedingte Exports basierend auf Plattform verwenden
// Dieser Ansatz funktioniert besser mit Metro-Bundlers Plattformauflösung
let _databaseModule: any = null;

const getDatabaseModule = () => {
  if (_databaseModule) {
    return _databaseModule;
  }

  // Dynamischen Import-ähnlichen Ansatz verwenden, der mit Metro-Bundler funktioniert
  // Metro löst automatisch die richtige Datei basierend auf der Plattform auf
  if (typeof window !== 'undefined') {
    // Web-Plattform
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _databaseModule = require('./database.web');
  } else {
    // Native Plattform (iOS/Android)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _databaseModule = require('./database.native');
  }

  return _databaseModule;
};

const databaseModule = getDatabaseModule();

// Alle Funktionen mit korrekten Typen erneut exportieren
export const initDatabase = databaseModule.initDatabase;
export const saveImage = databaseModule.saveImage;
export const addTestResult = databaseModule.addTestResult;
export const getAllTestResults = databaseModule.getAllTestResults;
export const getTestResultById = databaseModule.getTestResultById;
export const updateTestResult = databaseModule.updateTestResult;
export const deleteTestResult = databaseModule.deleteTestResult;
export const getDatabaseStats = databaseModule.getDatabaseStats;
export const getUserSettings = databaseModule.getUserSettings;
export const saveUserSettings = databaseModule.saveUserSettings;
export const createTestResultShare = databaseModule.createTestResultShare;
export const getTestResultShares = databaseModule.getTestResultShares;
export const sendChatMessage = databaseModule.sendChatMessage;
export const getChatMessages = databaseModule.getChatMessages;
export const markChatMessagesAsRead = databaseModule.markChatMessagesAsRead;
export const getChatConversations = databaseModule.getChatConversations;
export const addMedication = databaseModule.addMedication;
export const getAllMedications = databaseModule.getAllMedications;
export const getMedicationById = databaseModule.getMedicationById;
export const updateMedication = databaseModule.updateMedication;
export const deleteMedication = databaseModule.deleteMedication;
export const addVaccination = databaseModule.addVaccination;
export const getAllVaccinations = databaseModule.getAllVaccinations;
export const getVaccinationById = databaseModule.getVaccinationById;
export const updateVaccination = databaseModule.updateVaccination;
export const deleteVaccination = databaseModule.deleteVaccination;

