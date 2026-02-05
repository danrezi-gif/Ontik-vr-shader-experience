# Claude Development Notes - Ascension Experience

## Current Focus: SacredVesselsShader.tsx (The Ascension)

### What We've Done
1. **Reduced pole fog** - Now only at apex (rd.y > 0.94), opacity 0.15, just to hide vertex convergence
2. **Added cotton candy clouds** - 8 colored volumetric clouds (Ruby, Sapphire, Cyan, Magenta, Emerald, Amber, Violet, Orange)
3. **Removed heavy fog layers** - Removed Phase 1-4 spreading golden/colored fogs that were competing with cotton candy clouds

### Current State of Fog/Atmosphere
- **Pole fog**: Minimal, just at apex (lines 594-601)
- **Cotton candy clouds**: 8 colored clouds orbiting user (lines 603-662)
- **Phase rays**: Colored light rays remain (not fog) in phases 3 & 4
- **Golden glows**: Subtle center glows remain

### User's Vision (from stained glass reference)
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
