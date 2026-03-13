import type { EmotionOption } from '@/types/emotion';

export interface MonthlyEmotionMetric {
  emotion: EmotionOption;
  count: number;
  share: number;
}

export interface MonthlyStats {
  month: number;
  label: string;
  registeredDays: number;
  noteDays: number;
  uniqueEmotionCount: number;
  averageEmotionsPerDay: number;
  dominantEmotion: EmotionOption | null;
  dominantCount: number;
  changeFromPreviousMonth: number | null;
  trend: 'up' | 'down' | 'stable';
  emotionBreakdown: MonthlyEmotionMetric[];
}