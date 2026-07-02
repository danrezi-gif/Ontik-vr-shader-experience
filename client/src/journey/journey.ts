import { ChapterMood } from '../audio/generativeSoundtrack';

// ─────────────────────────────────────────────────────────────────────────────
// THE JOURNEY — Ontik's unified longform experience
//
// A single continuous psychedelic arc (~21 minutes) that moves through seven
// chapters: onset → deepening → threshold → ascent → void → dissolution →
// return. Each chapter is one shader environment plus a mood for the
// generative score. Chapters are joined by slow fades through black — a blink,
// not a cut.
// ─────────────────────────────────────────────────────────────────────────────

export interface JourneyChapter {
  shaderId: string;
  title: string;
  phase: string;
  /** Chapter length in seconds, including its fades */
  duration: number;
  color: string;
  mood: ChapterMood;
}

/** Seconds spent fading down at the end of a chapter and up into the next */
export const CHAPTER_FADE_SECONDS = 6;

// Scale reference (semitones): minor pentatonic [0,3,5,7,10],
// lydian fragments [0,4,6,7,11], major pentatonic [0,2,4,7,9]
export const JOURNEY_CHAPTERS: JourneyChapter[] = [
  {
    shaderId: 'prismatic-bloom',
    title: 'Prismatic Bloom',
    phase: 'Onset',
    duration: 170,
    color: '#c084fc',
    mood: { root: 55, scale: [0, 3, 5, 7, 10], filterHz: 700, swellInterval: 14, shimmer: 0.5, sub: 0.5, level: 0.8 },
  },
  {
    shaderId: 'abstract-waves',
    title: 'The Cosmic Attractor',
    phase: 'Deepening',
    duration: 170,
    color: '#ffa500',
    mood: { root: 49, scale: [0, 3, 5, 7, 10], filterHz: 900, swellInterval: 12, shimmer: 0.4, sub: 0.7, level: 0.9 },
  },
  {
    shaderId: 'tunnel-lights',
    title: 'Alpha and Omega',
    phase: 'Threshold',
    duration: 180,
    color: '#4488ff',
    mood: { root: 41.2, scale: [0, 2, 3, 7, 8], filterHz: 500, swellInterval: 16, shimmer: 0.3, sub: 0.9, level: 0.95 },
  },
  {
    shaderId: 'sacred-vessels',
    title: 'The Ascension',
    phase: 'Ascent',
    duration: 180,
    color: '#6699ff',
    mood: { root: 61.7, scale: [0, 4, 6, 7, 11], filterHz: 1600, swellInterval: 10, shimmer: 0.8, sub: 0.4, level: 0.9 },
  },
  {
    shaderId: 'transcendent-domain',
    title: 'Transcendent Domain',
    phase: 'The Void',
    duration: 180,
    color: '#DC143C',
    mood: { root: 46.2, scale: [0, 1, 5, 7, 8], filterHz: 600, swellInterval: 13, shimmer: 0.25, sub: 1.0, level: 1.0 },
  },
  {
    shaderId: 'oceanic-dissolution',
    title: 'Alien Womb',
    phase: 'Dissolution',
    duration: 200,
    color: '#2DD4BF',
    mood: { root: 36.7, scale: [0, 3, 5, 7, 10], filterHz: 450, swellInterval: 18, shimmer: 0.35, sub: 1.0, level: 0.95 },
  },
  {
    shaderId: 'solar-return',
    title: 'Solar Return',
    phase: 'Return',
    duration: 160,
    color: '#fbbf24',
    mood: { root: 65.4, scale: [0, 2, 4, 7, 9], filterHz: 2200, swellInterval: 9, shimmer: 0.9, sub: 0.3, level: 0.85 },
  },
];

export const JOURNEY_TOTAL_SECONDS = JOURNEY_CHAPTERS.reduce((sum, c) => sum + c.duration, 0);
export const JOURNEY_TOTAL_MINUTES = Math.round(JOURNEY_TOTAL_SECONDS / 60);

export interface JourneyPosition {
  chapterIndex: number;
  /** Seconds into the current chapter */
  chapterTime: number;
  /** 0–1 brightness envelope: fades in/out at chapter edges, 0 after the end */
  fade: number;
  complete: boolean;
}

/** Resolve elapsed journey time into chapter + fade envelope. */
export function getJourneyPosition(elapsedSeconds: number): JourneyPosition {
  let t = elapsedSeconds;
  for (let i = 0; i < JOURNEY_CHAPTERS.length; i++) {
    const chapter = JOURNEY_CHAPTERS[i];
    if (t < chapter.duration) {
      const fadeIn = Math.min(1, t / CHAPTER_FADE_SECONDS);
      const fadeOut = Math.min(1, (chapter.duration - t) / CHAPTER_FADE_SECONDS);
      // First chapter opens slower (the journey's own intro breath)
      const opening = i === 0 ? Math.min(1, t / (CHAPTER_FADE_SECONDS * 3)) : fadeIn;
      return {
        chapterIndex: i,
        chapterTime: t,
        fade: Math.max(0, Math.min(opening, fadeOut)),
        complete: false,
      };
    }
    t -= chapter.duration;
  }
  return {
    chapterIndex: JOURNEY_CHAPTERS.length - 1,
    chapterTime: JOURNEY_CHAPTERS[JOURNEY_CHAPTERS.length - 1].duration,
    fade: 0,
    complete: true,
  };
}
