export interface Emotion {
  id: number;
  syncId: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmotionOption {
  id: number;
  syncId: string;
  name: string;
  slug: string;
  color: string;
}

export interface EmotionInput {
  name: string;
  color: string;
  active?: boolean;
}