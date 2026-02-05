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
