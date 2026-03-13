import type { EmotionInput } from '@/types/emotion';

export const INITIAL_EMOTIONS: Array<EmotionInput & { slug: string }> = [
  { name: 'Alegria', slug: 'alegria', color: '#f59e0b' },
  { name: 'Miedo', slug: 'miedo', color: '#6366f1' },
  { name: 'Rabia', slug: 'rabia', color: '#ef4444' },
  { name: 'Tristeza', slug: 'tristeza', color: '#3b82f6' },
  { name: 'Calma', slug: 'calma', color: '#14b8a6' },
  { name: 'Amor', slug: 'amor', color: '#ec4899' },
  { name: 'Verguenza', slug: 'verguenza', color: '#8b5cf6' },
  { name: 'Orgullo', slug: 'orgullo', color: '#f97316' },
  { name: 'Ternura', slug: 'ternura', color: '#fb7185' },
  { name: 'Gratitud', slug: 'gratitud', color: '#22c55e' },
  { name: 'Felicidad', slug: 'felicidad', color: '#eab308' },
  { name: 'Nostalgia', slug: 'nostalgia', color: '#64748b' },
  { name: 'Ansiedad', slug: 'ansiedad', color: '#0ea5e9' },
  { name: 'Confusion', slug: 'confusion', color: '#a855f7' },
  { name: 'Aburrimiento', slug: 'aburrimiento', color: '#94a3b8' },
];