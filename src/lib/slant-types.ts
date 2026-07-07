export type Difficulty = 'easy' | 'medium' | 'hard';

export type CellValue = '' | '/' | '\\';

export type ClueGrid = Array<Array<number | null>>;

export type SlantPuzzle = {
  id: string;
  seed: string;
  difficulty: Difficulty;
  grid_size: number;
  title: string;
  clue_grid: ClueGrid;
  solution_grid?: string[];
  metrics?: Record<string, unknown>;
  difficulty_score?: number;
};

export type SlantDailyStats = {
  seed: string;
  players_today: number;
  success_rate: number;
};

export type SlantDailyStatus = {
  completed: boolean;
  seed: string | null;
  elapsed_seconds: number | null;
  completed_at: string | null;
};

export type SlantRecordResult = {
  recorded: boolean;
  already_completed: boolean;
  completed_at: string | null;
};

export type SlantPlayerRecords = {
  total_completed: number;
  daily_completed: number;
  challenges_completed: number;
  practice_completed: number;
  easy_completed: number;
  medium_completed: number;
  hard_completed: number;
  perfect_runs: number;
  current_streak_days: number;
  best_time_seconds: number | null;
  best_day: string | null;
  practice_runs: number;
  first_played_at: string | null;
  last_completed_at: string | null;
  longest_streak_days: number;
};

export type SlantArchiveDayStatus = 'no_puzzle' | 'unfinished' | 'completed';

export type SlantArchiveMonthOption = {
  year: number;
  month: number;
};

export type SlantArchiveDay = {
  date: string;
  day: number;
  seed: string | null;
  difficulty: Difficulty | null;
  status: SlantArchiveDayStatus;
};

export type SlantArchiveMonth = {
  year: number;
  month: number;
  months: SlantArchiveMonthOption[];
  days: SlantArchiveDay[];
};

export type ClueState = 'idle' | 'satisfied' | 'error';
