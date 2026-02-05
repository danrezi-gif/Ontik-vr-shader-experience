# Claude Development Notes - Ascension Experience

## WORKFLOW RULES - READ FIRST
1. **ASK before running build/lint** - Never auto-build
2. **Read this file first** when starting a new session
3. **Update this file** after making changes to preserve context
4. **Confirm before major actions** - commits, builds, large edits

---

## Current Focus: SacredVesselsShader.tsx (The Ascension)

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
