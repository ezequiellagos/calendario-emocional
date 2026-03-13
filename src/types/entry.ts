import type { EmotionOption } from '@/types/emotion';

export interface EntryRecord {
  date: string;
  note: string;
  primaryEmotionId: number | null;
  primaryColor: string | null;
  createdAt: string;
  updatedAt: string;
  emotions: EmotionOption[];
}

export interface EntryInput {
  date: string;
  note: string;
  emotionIds: number[];
  primaryEmotionId?: number | null;
}

export interface CalendarDay {
  date: string;
  day: number;
  month: number;
  isCurrentYear: boolean;
  entry: EntryRecord | null;
}

export interface CalendarMonth {
  month: number;
  label: string;
  weeks: Array<Array<CalendarDay | null>>;
}