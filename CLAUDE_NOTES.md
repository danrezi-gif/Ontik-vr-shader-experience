# Claude Development Notes - VR Shader Experiences

## Claude Code Skills

### p5-brush
Installed at `~/.claude/skills/p5-brush`. Generates standalone HTML generative art files using p5.js 2.x + p5.brush v2 library.

**Usage**: `/p5-brush <description>` — e.g. `/p5-brush a stormy ocean in watercolor`

**Source**: https://github.com/progen/p5-brush-skill

To reinstall: copy/symlink the `SKILL.md` from the above repo into `~/.claude/skills/p5-brush/SKILL.md`

---

## WORKFLOW RULES - READ FIRST
1. **ASK before running build/lint** - Never auto-build
2. **Read this file first** when starting a new session
3. **Update this file** after making changes to preserve context
4. **Confirm before major actions** - commits, builds, large edits

---

## Latest: The Journey — unified longform experience (2026-07-02)

### What Was Built
- **Journey mode**: single ~21-min arc chaining 7 chapters with fade-through-black
  transitions (6s), driven by `JourneyConductor` (useFrame, VR-safe timing).
  Timeline in `client/src/journey/journey.ts`.
- **Original generative soundtrack**: `client/src/audio/generativeSoundtrack.ts` —
  WebAudio drones/pads/sub/shimmer per chapter mood, crossfades on chapter change.
  Replaces mp3 tracks in journey mode (mp3s are NOT store-licensing-safe; gallery
  single-mode still uses them for now — replace before store submission).
- **New shaders**: `PrismaticBloomShader` (kaleidoscopic onset, chapter 1),
  `SolarReturnShader` (dawn comedown, chapter 7). Both loop-free angular math,
  Quest-friendly.
- **Frontpage remodel**: hero = Begin the Journey CTA + chapter arc strip;
  sections reframed as chapters.

### Key wiring (App.tsx)
- `journeyActive` overrides `selectedShader` via `activeShaderId`
- journey fade multiplies brightness; per-shader intros disabled in journey mode
- `journeySoundtrack.ensureRunning()` called in VRControllerHandler frame loop
  (Quest suspends AudioContext on VR entry)
- journey passes `journeyChapterTime` as `audioTime` to audio-synced shaders

---

## Previous: TranscendentDomainShader.tsx (Transcendent Domain)

### What Was Built (2026-02-07)
- **New experience**: Cosmic volumetric fractal journey
- **Quest 3 optimized**: 6 volsteps, 5 iterations
- **Duration**: ~6 minutes in 3 phases (2 min each)
- **Movement**: Constant gentle forward drift through fractal space
- **Color progression**: Deep cosmic blue → Ethereal cyan → Transcendent white-blue
- **Intro**: 12-second fade with ease-in-quad curve
- **Effects**: Central pulsing glow, depth sparkles, phase transition flashes

### Audio Required
Add to `client/public/audio/`:
- `The Transcendent Domain - Psychedelic Visuals Cosmic Consciousness - 4K.mp3`

### Files Modified
- `client/src/shaders/TranscendentDomainShader.tsx` (new)
- `client/src/shaders/index.ts` (registry)
- `client/src/App.tsx` (rendering, audio, intro config)

---

## Previous: SacredVesselsShader.tsx (The Ascension)

### What We've Done
- **REVERTED** cotton candy clouds changes (commit e47a26b) due to rendering problems
- Shader is now back to pre-cotton-candy state (from commit 7d37222)

### Previous Attempt (Reverted)
The cotton candy clouds implementation had rendering issues. The approach was:
1. Reduced pole fog - Only at apex (rd.y > 0.94), opacity 0.15
2. Added 8 colored volumetric clouds (Ruby, Sapphire, Cyan, Magenta, Emerald, Amber, Violet, Orange)
3. Removed heavy fog layers

### User's Original Vision (for future reference)
- Multiple colored fogs like "colored cotton candy clouds covering the user"
- Fog only needed close to pole to hide vertex convergence
- Lower opacity, lower coverage
- Beautiful translucent colored atmosphere

### Workflow Rules
- **ASK before running build/lint**
- **Maintain this notes file** for context across sessions
- Review changes before committing

### Files Modified
- `client/src/shaders/SacredVesselsShader.tsx`

### Branch
- `claude/fix-vr-initialization-ZPa5l`
