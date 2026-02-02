# Transition References - Digital Sanctuary

This document captures effective transition techniques developed for the VR shader experiences.

---

## Kusama-Style Emergence (Infinite Light)

**Concept:** A single light emerges from complete darkness, then multiplies to infinity.

### Timing Structure

```
Duration: 35 seconds
Easing: Cubic ease-in (t³) - very slow start, dramatic acceleration

Timeline:
├── 0-25%:   Single central light fades in from void
├── 15-95%:  Lights multiply outward from center
└── 70-100%: Central glow fades out (high contrast finale)
```

### Implementation (VRIntroAnimator)

```typescript
// Extended duration for contemplative emergence
const duration = shaderId === 'infinite-light' ? 35000 : 8000;
const linearProgress = Math.min(1, elapsed / duration);

// Cubic ease-in: extremely slow start, accelerates dramatically
// Creates meditative patience, then revelation
progress = linearProgress * linearProgress * linearProgress;
```

### Shader Phases (InfiniteLightShader.tsx)

```glsl
// Phase control
float singleLightFadeIn = smoothstep(0.0, 0.25, iIntroProgress);
float singleLightFadeOut = 1.0 - smoothstep(0.7, 1.0, iIntroProgress);
float singleLightPhase = singleLightFadeIn * singleLightFadeOut;
float multiplyPhase = smoothstep(0.2, 0.95, iIntroProgress);

// Central singular light - the origin point
float centralDist = length(rd.xz);
float centralGlow = exp(-centralDist * centralDist * 3.0) * singleLightPhase;
vec3 centralColor = vec3(1.0, 0.95, 0.9); // Warm white

// Grid reveal - expands outward from center
float maxRevealDist = 3.0 + multiplyPhase * 57.0; // 3 -> 60 units

// Per-light reveal based on distance from center
float cellDist = length(cellId) * spacing;
float revealFade = smoothstep(maxRevealDist, maxRevealDist - 8.0, cellDist);
light *= revealFade * multiplyPhase;
```

### Key Principles

1. **Patience before revelation** - The slow ease-in creates anticipation
2. **Single origin point** - Establishes focus before multiplication
3. **Radial expansion** - Lights appear closer to center first
4. **Clean exit** - Central glow fades to leave only the grid (high contrast)
5. **Warm to cool** - Central light is warm white, grid lights are cool blue

### Psychological Effect

- Void → singular presence → infinite multiplication
- Mirrors contemplative/meditative states
- The waiting creates meaning in the revelation
- Final high contrast (no central glow) emphasizes the infinite grid

---

## Future Transition Ideas

### Slow Materialization
- Objects/forms gradually gain opacity/solidity
- From transparent suggestion to full presence

### Depth Reveal
- Start with flat/close plane, gradually reveal depth
- Near becomes far, intimate becomes vast

### Color Temperature Shift
- Begin monochrome, gradually introduce color
- Or: warm to cool, dawn to night

### Particle Coalescence
- Scattered particles slowly gather into form
- Chaos to order, formlessness to structure

---

## Technical Notes

### Easing Functions Reference

```typescript
// Linear (no easing)
progress = t;

// Ease-in-quad (slow start)
progress = t * t;

// Ease-in-cubic (very slow start) - USED IN KUSAMA
progress = t * t * t;

// Ease-out-quad (slow end)
progress = t * (2 - t);

// Ease-in-out-quad (slow both ends)
progress = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
```

### Intro Progress Usage in Shaders

The `iIntroProgress` uniform (0 → 1) can control:
- Overall brightness/opacity
- Reveal distance (raymarching)
- Phase transitions (smoothstep ranges)
- Color temperature shifts
- Animation speed modulation

---

*Document created: 2026-02-02*
*Digital Sanctuary - VR Meditation Experiences*
