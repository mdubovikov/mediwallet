import { TestResult, NewTestResult } from '@/types/test-result';
import { UserSettings, NewUserSettings } from '@/types/user-settings';

// Web-Plattform-Stubs - Datenbank wird auf Web nicht unterstützt
const webError = () => {
  throw new Error('Database operations are not supported on web platform. Please use iOS or Android.');
};

export const initDatabase = async (): Promise<void> => {
  // Auf Web still zurückkehren - Datenbank wird nicht unterstützt
  // Keine Warnung nötig, da Web-Plattform in der UI behandelt wird
  return;
};

export const saveImage = async (sourceUri: string): Promise<string> => {
  return webError();
};

export const addTestResult = async (testResult: NewTestResult): Promise<number> => {
  return webError();
};

export const getAllTestResults = async (): Promise<TestResult[]> => {
  return webError();
};

export const getTestResultById = async (id: number): Promise<TestResult | null> => {
  return webError();
};

export const updateTestResult = async (
  id: number,
  updates: Partial<Omit<TestResult, 'id' | 'createdAt'>>
): Promise<void> => {
  return webError();
};

export const deleteTestResult = async (id: number): Promise<void> => {
  return webError();
};

export const getDatabaseStats = async (): Promise<{
  totalTests: number;
  totalSize: number;
}> => {
  return webError();
};

export const getUserSettings = async (): Promise<UserSettings | null> => {
  return webError();
};

export const saveUserSettings = async (settings: NewUserSettings): Promise<number> => {
  return webError();
};

export const createTestResultShare = async (
  testResultId: number,
  doctorName: string,
  doctorEmail: string | null,
  expiresAt: string
): Promise<number> => {
  return webError();
};

export const getTestResultShares = async (testResultId: number): Promise<any[]> => {
  return webError();
};

export const sendChatMessage = async (message: import('@/types/chat-message').NewChatMessage): Promise<number> => {
  return webError();
};

export const getChatMessages = async (
  userId1: string,
  userId2: string
): Promise<import('@/types/chat-message').ChatMessage[]> => {
  return webError();
};

export const markChatMessagesAsRead = async (
  senderId: string,
  receiverId: string
): Promise<void> => {
  return webError();
};

export const getChatConversations = async (
  userId: string
): Promise<import('@/types/chat-message').ChatConversation[]> => {
  return webError();
};

export const addMedication = async (medication: import('@/types/medication').NewMedication): Promise<number> => {
  return webError();
};

export const getAllMedications = async (): Promise<import('@/types/medication').Medication[]> => {
  return webError();
};

export const getMedicationById = async (id: number): Promise<import('@/types/medication').Medication | null> => {
  return webError();
};

export const updateMedication = async (
  id: number,
  updates: Partial<import('@/types/medication').NewMedication>
): Promise<void> => {
  return webError();
};

export const deleteMedication = async (id: number): Promise<void> => {
  return webError();
};

export const addVaccination = async (vaccination: import('@/types/vaccination').NewVaccination): Promise<number> => {
  return webError();
};

export const getAllVaccinations = async (): Promise<import('@/types/vaccination').Vaccination[]> => {
  return webError();
};

export const getVaccinationById = async (id: number): Promise<import('@/types/vaccination').Vaccination | null> => {
  return webError();
};

export const updateVaccination = async (
  id: number,
  updates: Partial<import('@/types/vaccination').NewVaccination>
): Promise<void> => {
  return webError();
};

export const deleteVaccination = async (id: number): Promise<void> => {
  return webError();
};

