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

## Project-Specific Notes

- The Mirror of Lights shader (abstract-waves) is the focus
- Audio file: "The Birth of the Holy.mp3"
- Intro sequence: brightness fade from 0.1 to 1.0 over 8 seconds
- VRIntroAnimator component handles the fade using useFrame
