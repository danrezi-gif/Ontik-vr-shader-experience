# Claude Development Notes - VR Shader Experiences

## WORKFLOW RULES - READ FIRST
1. **ASK before running build/lint** - Never auto-build
2. **Read this file first** when starting a new session
3. **Update this file** after making changes to preserve context
4. **Confirm before major actions** - commits, builds, large edits

---

## Latest: TranscendentDomainShader.tsx (Transcendent Domain)

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
