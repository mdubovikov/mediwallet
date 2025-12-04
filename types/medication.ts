export interface Medication {
  id: number;
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
  reminderEnabled?: boolean;
  reminderTimes?: string; // JSON array of times, e.g. ["08:00", "20:00"]
  createdAt: string;
}

export interface NewMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
  reminderEnabled?: boolean;
  reminderTimes?: string;
}

