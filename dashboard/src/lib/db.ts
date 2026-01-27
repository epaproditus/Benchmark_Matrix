import Dexie, { type Table } from 'dexie';

export interface Student {
  id?: number;
  LocalId: string;
  FirstName: string;
  LastName: string;
  Grade: string;
  Campus: string;
  Teacher: string;
  StaarScore: number | null;
  StaarLevel: string | null;
  FallScore: number | null;
  FallLevel: string | null;
  SpringScore: number | null;
  SpringLevel: string | null;
}

export interface Settings {
  id: string;
  value: any;
}

export class BenchmarkDatabase extends Dexie {
  students!: Table<Student>;
  settings!: Table<Settings>;

  constructor() {
    super('BenchmarkDatabase');
    this.version(1).stores({
      students: '++id, &LocalId, FirstName, LastName, Grade, Teacher, Campus',
      settings: '&id'
    });
  }
}

export const db = new Dexie('BenchmarkDatabase') as BenchmarkDatabase;
db.version(1).stores({
  students: '++id, &LocalId, FirstName, LastName, Grade, Teacher, Campus',
  settings: '&id'
});

export const DEFAULT_THRESHOLDS = {
  math: {
    previous: [
      { label: "Masters", min: 80, max: 100, color: "#9333ea" },
      { label: "Meets", min: 60, max: 79, color: "#16a34a" },
      { label: "High Approaches", min: 50, max: 59, color: "#2563eb" },
      { label: "Low Approaches", min: 40, max: 49, color: "#2563eb" },
      { label: "High Did Not Meet", min: 20, max: 39, color: "#dc2626" },
      { label: "Low Did Not Meet", min: 0, max: 19, color: "#dc2626" }
    ],
    current: [
      { label: "Masters", min: 85, max: 100, color: "#9333ea" },
      { label: "Meets", min: 65, max: 84, color: "#16a34a" },
      { label: "High Approaches", min: 55, max: 64, color: "#2563eb" },
      { label: "Low Approaches", min: 45, max: 54, color: "#2563eb" },
      { label: "High Did Not Meet", min: 22, max: 44, color: "#dc2626" },
      { label: "Low Did Not Meet", min: 0, max: 21, color: "#dc2626" }
    ]
  },
  rla: {
    previous: [
      { label: "Masters", min: 80, max: 100, color: "#9333ea" },
      { label: "Meets", min: 60, max: 79, color: "#16a34a" },
      { label: "High Approaches", min: 50, max: 59, color: "#2563eb" },
      { label: "Low Approaches", min: 40, max: 49, color: "#2563eb" },
      { label: "High Did Not Meet", min: 20, max: 39, color: "#dc2626" },
      { label: "Low Did Not Meet", min: 0, max: 19, color: "#dc2626" }
    ],
    current: [
      { label: "Masters", min: 85, max: 100, color: "#9333ea" },
      { label: "Meets", min: 65, max: 84, color: "#16a34a" },
      { label: "High Approaches", min: 55, max: 64, color: "#2563eb" },
      { label: "Low Approaches", min: 45, max: 54, color: "#2563eb" },
      { label: "High Did Not Meet", min: 22, max: 44, color: "#dc2626" },
      { label: "Low Did Not Meet", min: 0, max: 21, color: "#dc2626" }
    ]
  }
};