# Development Practices for Claude

## Core Principles

### 1. One Change at a Time
- Make ONE functional change per commit
- Test/verify before moving to next change
- Never bundle unrelated changes together

### 2. Simplicity First
- Start with the simplest working solution
- Add complexity only when simple approach fails
- Prefer modifying existing code over adding new components

### 3. Avoid Breaking Changes
- Don't add new imports unless absolutely necessary (especially from external packages)
- Don't add new 3D components (Text, etc.) without confirming they work on Quest
- Use existing parameters/props when possible instead of adding new ones

### 4. VR-Specific Considerations
- `requestAnimationFrame` may not work in VR - use `useFrame` inside Canvas
- HTML overlays are NOT visible in VR headset - only 3D scene content
- Quest browser has limited GPU - keep shaders simple (< 50 iterations)
- Always test that changes don't break iPad AND Quest

### 5. Before Making Changes
- Read the current code state first
- Understand what's already working
- Identify the minimal change needed

### 6. After Making Changes
- Build and verify no compilation errors
- Commit immediately if build succeeds
- Push so user can test on device

## Collaborative Design Workflow

### Roles
- **User = Creative Director**: Has the artistic vision, makes aesthetic decisions, approves direction
- **Claude = Expert Technician**: Has technical skills, proposes solutions, implements after approval

This is a partnership. Claude does NOT make creative decisions alone. Frequent discussion is expected and necessary.

**CRITICAL: Do NOT jump straight to code.** When the user suggests a new effect or feature:

### Step 1: Understand the Vision
- Ask for **references** (images, videos, other artworks, descriptions)
- Ask **clarifying questions** about the feeling/mood they want
- Discuss what makes the reference work visually

### Step 2: Propose Architecture
Before writing any code, present:
- **Layer name**: What this effect will be called
- **Parameters**: What controls will it have? (intensity, speed, color, etc.)
- **Behavior**: How does it interact with existing layers?
- **Dependencies**: Does it need audioTime? headRotation? New uniforms?

Example discussion:
```
User: "I want a cathedral vitral effect"

Claude: "Before I build this, let me propose:

LAYER: Cathedral Vitral
- Parameters:
  - rayCount (how many colored rays, default 8?)
  - saturation (how vivid, 0.0-1.0?)
  - rotationSpeed (do rays rotate slowly?)
  - fadeHeight (where do rays start appearing?)

- Behavior: Additive colored rays from above
- Timing: Should this be always-on or phase-triggered?

Do you have reference images for the color palette?
Should the rays be sharp or soft/diffuse?"
```

### Step 3: Agree Before Building
- Wait for user confirmation on the architecture
- Adjust parameters based on feedback
- Only then write the code

### Step 4: Implement Minimally
- Start with the simplest version of the effect
- Push and let user test
- Iterate based on feedback

### Why This Matters
- Building too fast wastes time if it's not what the user wanted
- Creative work requires conversation, not just execution
- The user has the artistic vision; Claude has the technical skills
- Together we build something neither could alone

## Anti-Patterns to Avoid

- Adding drei Text component (causes white screen on mobile)
- Complex 3D text rendering (canvas textures can fail)
- Multiple new state variables for one feature
- Changing multiple files for one feature when one file would suffice
- Using external font URLs in 3D components

## Debugging Flow

1. If something breaks, REVERT first
2. Then implement simpler alternative
3. Don't try to fix broken complex code - simplify instead

## Layer-Based Shader Development

When building or modifying shader effects, use a **layer approach** for maximum creative control:

### Principle
Each visual effect should be an **independent, additive layer** that can be:
- Toggled on/off without affecting other layers
- Adjusted independently (intensity, color, timing)
- Removed completely without rewriting surrounding code

### Implementation Pattern
```glsl
// In fragment shader:
vec3 col = vec3(0.0);  // Start with black (or base)

// Layer 1: Streams (always on for testing)
vec3 streamsLayer = calculateStreams(uv, time);
col += streamsLayer;

// Layer 2: Fog (toggleable)
// float fogEnabled = 1.0;  // Set to 0.0 to disable
// vec3 fogLayer = calculateFog(uv, time) * fogEnabled;
// col += fogLayer;

// Layer 3: Glow (toggleable)
// vec3 glowLayer = calculateGlow(uv, time);
// col += glowLayer;
```

### Workflow
1. **Start bare bones** - only essential elements visible
2. **Add one layer** - test it in isolation
3. **If it works** - keep it, move to next layer
4. **If it doesn't work** - comment it out or delete, no damage done
5. **Iterate** - adjust parameters until happy

### Benefits
- No fear of breaking what works
- Easy A/B comparison (toggle layer on/off)
- Clear separation of concerns
- Quick rollback (comment out one section)

### Example: Ascension Testing
The `AscensionTestingShader` follows this pattern:
- Base: flowing vertical streams only
- Future layers can be added one at a time
- Each layer is self-contained in the shader code

## Project-Specific Notes

- The Mirror of Lights shader (abstract-waves) is the focus
- Audio file: "The Birth of the Holy.mp3"
- Intro sequence: brightness fade from 0.1 to 1.0 over 8 seconds
- VRIntroAnimator component handles the fade using useFrame
