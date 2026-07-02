export interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface ShuffledOption {
  text: string;
  originalIndex: number;
}

export interface PlayQuestion {
  id: string;
  question: string;
  shuffledOptions: ShuffledOption[];
  correctAnswerOriginalIndex: number;
  explanation?: string;
}

export interface UserInfo {
  name: string;
  className: string;
}

export type GameMode = "dinhTinh" | "dinhLuong";

export type GameState = "welcome" | "select_mode" | "gameplay" | "result";
