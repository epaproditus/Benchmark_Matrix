export interface Grade {
  Grade: string;
}

export interface Teacher {
  teacher: string;
  Grade: string;
}

export interface TeacherResponse {
  name: string;
  grade: string;
}

export type DatabaseParams = (string | number)[];
