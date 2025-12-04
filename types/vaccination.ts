export interface Vaccination {
  id: number;
  name: string;
  date: string; // ISO date string
  notes?: string;
  createdAt: string;
}

export interface NewVaccination {
  name: string;
  date: string; // ISO date string
  notes?: string;
}

