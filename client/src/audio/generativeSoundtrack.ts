// ─────────────────────────────────────────────────────────────────────────────
// Generative Soundtrack Engine
//
// A fully procedural, original ambient score for the Journey. Every sound is
// synthesized in-browser with the Web Audio API — no samples, no licensed
// material — so the experience is safe to ship on the Meta Store / Steam.
//
// Architecture:
//   drone voices ─┐
//   pad swells   ─┤→ chapter bus → master gain ─┬→ destination (dry)
//   sub pulse    ─┤                             └→ convolver → reverb gain → destination (wet)
//   shimmer      ─┘
//
// Each chapter of the journey supplies a ChapterMood (root note, scale,
// filter color, swell pacing). setChapter() crossfades the drone bus to the
// new mood over several seconds so transitions feel like modulations, not cuts.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChapterMood {
  /** Root frequency in Hz (e.g. 55 = A1) */
  root: number;
  /** Scale as semitone offsets from root, used for pad swells and shimmer */
  scale: number[];
  /** Lowpass cutoff for the drone bed — dark (400) to radiant (4000) */
  filterHz: number;
  /** Average seconds between pad swells */
  swellInterval: number;
  /** 0–1: level of high bell-like shimmer partials */
  shimmer: number;
  /** 0–1: level of the sub-bass breathing pulse */
  sub: number;
  /** Overall loudness trim for the chapter, 0–1 */
  level: number;
}

interface DroneVoice {
  osc: OscillatorNode;
  gain: GainNode;
  /** Multiplier applied to the mood root to get this voice's frequency */
  ratio: number;
  detuneCents: number;
}

const MOOD_RAMP_SECONDS = 8;
const MASTER_LEVEL = 0.5;

function createReverbImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function semitoneToRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

class GenerativeSoundtrack {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private chapterBus: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private subGain: GainNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private subLfo: OscillatorNode | null = null;
  private subLfoGain: GainNode | null = null;
  private drones: DroneVoice[] = [];
  private mood: ChapterMood | null = null;
  private swellTimer: ReturnType<typeof setTimeout> | null = null;
  private shimmerTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  /** Must be called from a user gesture (click / VR controller) the first time. */
  start(mood: ChapterMood) {
    if (this.running) {
      this.setChapter(mood);
      return;
    }
    const ctx = this.ctx ?? new AudioContext();
    this.ctx = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(MASTER_LEVEL, ctx.currentTime + 6);
    master.connect(ctx.destination);
    this.master = master;

    // Cathedral-scale reverb send
    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbImpulse(ctx, 5.0, 2.2);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.55;
    master.connect(convolver);
    convolver.connect(reverbGain);
    reverbGain.connect(ctx.destination);
    this.convolver = convolver;
    this.reverbGain = reverbGain;

    const chapterBus = ctx.createGain();
    chapterBus.gain.value = mood.level;
    chapterBus.connect(master);
    this.chapterBus = chapterBus;

    // ── Drone bed: root, octave, fifth — slightly detuned, through a shared lowpass
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = mood.filterHz;
    droneFilter.Q.value = 0.4;
    droneFilter.connect(chapterBus);
    this.droneFilter = droneFilter;

    // Slow wander on the filter so the bed never sits still
    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.02;
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = mood.filterHz * 0.25;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(droneFilter.frequency);
    filterLfo.start();

    const droneSpecs: Array<{ ratio: number; detuneCents: number; level: number; type: OscillatorType }> = [
      { ratio: 1, detuneCents: 0, level: 0.22, type: 'sawtooth' },
      { ratio: 1, detuneCents: 7, level: 0.16, type: 'sawtooth' },
      { ratio: 2, detuneCents: -5, level: 0.10, type: 'triangle' },
      { ratio: semitoneToRatio(7), detuneCents: 4, level: 0.08, type: 'triangle' },
    ];
    this.drones = droneSpecs.map(spec => {
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = mood.root * spec.ratio;
      osc.detune.value = spec.detuneCents;
      const gain = ctx.createGain();
      gain.gain.value = spec.level;
      osc.connect(gain);
      gain.connect(droneFilter);
      osc.start();
      return { osc, gain, ratio: spec.ratio, detuneCents: spec.detuneCents };
    });

    // ── Sub-bass breathing pulse
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = mood.root / 2;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.16 * mood.sub;
    const subLfo = ctx.createOscillator();
    subLfo.frequency.value = 0.07; // ~14s breath cycle
    const subLfoGain = ctx.createGain();
    subLfoGain.gain.value = 0.08 * mood.sub;
    subLfo.connect(subLfoGain);
    subLfoGain.connect(subGain.gain);
    subOsc.connect(subGain);
    subGain.connect(chapterBus);
    subOsc.start();
    subLfo.start();
    this.subOsc = subOsc;
    this.subGain = subGain;
    this.subLfo = subLfo;
    this.subLfoGain = subLfoGain;

    this.mood = mood;
    this.running = true;
    this.scheduleSwell();
    this.scheduleShimmer();
  }

  /** Crossfade the score into a new chapter mood. */
  setChapter(mood: ChapterMood) {
    if (!this.running || !this.ctx || !this.droneFilter || !this.chapterBus) {
      this.start(mood);
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.mood = mood;

    this.chapterBus.gain.cancelScheduledValues(now);
    this.chapterBus.gain.setValueAtTime(this.chapterBus.gain.value, now);
    this.chapterBus.gain.linearRampToValueAtTime(mood.level, now + MOOD_RAMP_SECONDS);

    this.droneFilter.frequency.cancelScheduledValues(now);
    this.droneFilter.frequency.setValueAtTime(this.droneFilter.frequency.value, now);
    this.droneFilter.frequency.exponentialRampToValueAtTime(
      Math.max(80, mood.filterHz),
      now + MOOD_RAMP_SECONDS
    );

    this.drones.forEach(voice => {
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.setValueAtTime(voice.osc.frequency.value, now);
      voice.osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, mood.root * voice.ratio),
        now + MOOD_RAMP_SECONDS
      );
    });

    if (this.subOsc && this.subGain && this.subLfoGain) {
      this.subOsc.frequency.cancelScheduledValues(now);
      this.subOsc.frequency.setValueAtTime(this.subOsc.frequency.value, now);
      this.subOsc.frequency.exponentialRampToValueAtTime(
        Math.max(16, mood.root / 2),
        now + MOOD_RAMP_SECONDS
      );
      this.subGain.gain.cancelScheduledValues(now);
      this.subGain.gain.setValueAtTime(this.subGain.gain.value, now);
      this.subGain.gain.linearRampToValueAtTime(0.16 * mood.sub, now + MOOD_RAMP_SECONDS);
      this.subLfoGain.gain.setValueAtTime(this.subLfoGain.gain.value, now);
      this.subLfoGain.gain.linearRampToValueAtTime(0.08 * mood.sub, now + MOOD_RAMP_SECONDS);
    }
  }

  /** Resume a suspended AudioContext (Quest suspends it on VR entry). */
  ensureRunning() {
    if (this.running && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Gentle fade used at the end of the journey. */
  fadeOut(seconds: number) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + seconds);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.swellTimer) clearTimeout(this.swellTimer);
    if (this.shimmerTimer) clearTimeout(this.shimmerTimer);
    this.swellTimer = null;
    this.shimmerTimer = null;

    const ctx = this.ctx;
    if (ctx && this.master) {
      const master = this.master;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 1.5);
    }
    const drones = this.drones;
    const subOsc = this.subOsc;
    const subLfo = this.subLfo;
    setTimeout(() => {
      drones.forEach(v => {
        try { v.osc.stop(); } catch { /* already stopped */ }
      });
      try { subOsc?.stop(); } catch { /* already stopped */ }
      try { subLfo?.stop(); } catch { /* already stopped */ }
    }, 1700);
    this.drones = [];
    this.subOsc = null;
    this.subLfo = null;
    this.subGain = null;
    this.subLfoGain = null;
    this.master = null;
    this.chapterBus = null;
    this.droneFilter = null;
    this.convolver = null;
    this.reverbGain = null;
    this.mood = null;
  }

  // ── Pad swells: slow-breathing chord tones drawn from the chapter scale ────
  private scheduleSwell() {
    if (!this.running || !this.mood) return;
    const interval = this.mood.swellInterval * (0.6 + Math.random() * 0.8);
    this.swellTimer = setTimeout(() => {
      this.playSwell();
      this.scheduleSwell();
    }, interval * 1000);
  }

  private playSwell() {
    const ctx = this.ctx;
    const mood = this.mood;
    if (!ctx || !mood || !this.chapterBus || !this.running) return;

    const degree = pick(mood.scale);
    const octave = pick([1, 2, 2, 4]);
    const freq = mood.root * semitoneToRatio(degree) * octave;

    const attack = 3 + Math.random() * 4;
    const release = 6 + Math.random() * 6;
    const peak = 0.05 + Math.random() * 0.06;
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(mood.filterHz * 2, freq * 6);
    filter.connect(this.chapterBus);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(peak, now + attack);
    env.gain.linearRampToValueAtTime(0, now + attack + release);
    env.connect(filter);

    // Two detuned voices per swell for width
    [-6, 6].forEach(detune => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(env);
      osc.start(now);
      osc.stop(now + attack + release + 0.2);
    });
  }

  // ── Shimmer: sparse high bell partials, mostly reverb tail ────────────────
  private scheduleShimmer() {
    if (!this.running || !this.mood) return;
    const base = 6 + Math.random() * 14;
    this.shimmerTimer = setTimeout(() => {
      if (this.mood && this.mood.shimmer > 0.01 && Math.random() < this.mood.shimmer) {
        this.playShimmer();
      }
      this.scheduleShimmer();
    }, base * 1000);
  }

  private playShimmer() {
    const ctx = this.ctx;
    const mood = this.mood;
    if (!ctx || !mood || !this.chapterBus || !this.running) return;

    const degree = pick(mood.scale);
    const freq = mood.root * semitoneToRatio(degree) * 8;
    const now = ctx.currentTime;

    const env = ctx.createGain();
    const peak = 0.015 + Math.random() * 0.02 * mood.shimmer;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 4 + Math.random() * 3);
    env.connect(this.chapterBus);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(env);
    osc.start(now);
    osc.stop(now + 8);
  }
}

/** Shared singleton — the journey has exactly one score. */
export const journeySoundtrack = new GenerativeSoundtrack();
