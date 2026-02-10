# VR Shader Experience - Style Palette

## Core Visual Language

### 1. Waterfall Effect
**Used in:** Ascension, Transcendent Domain

**Characteristics:**
- Organic flowing light streams
- FBM (fractal brownian motion) noise for natural turbulence
- Multiple noise layers creating water-like movement
- Vertical streaking (water drips effect)
- Ripple patterns
- Gentle wobble/sway animation

**Color Treatment:**
- Bright white core (high intensity center)
- Ethereal blue-white edges: `vec3(0.55, 0.75, 1.0)` to `vec3(1.0, 1.0, 1.0)`
- Smooth gradient falloff from center

**Technical Notes:**
- Uses `smoothstep` for soft edges
- Central glow: `exp(-dx * dx * 600.0)` for sharp bright core
- Particle opacity: `smoothstep(0.5, 0.75, noise)`

---

## Color Palettes

### Cathedral Colors (Sacred/Divine)
| Name | RGB | Use Case |
|------|-----|----------|
| Ruby | `(0.95, 0.25, 0.35)` | Warm accent |
| Sapphire | `(0.2, 0.45, 0.95)` | Cool accent |
| Emerald | `(0.2, 0.9, 0.45)` | Nature/life |
| Amethyst | `(0.85, 0.3, 0.9)` | Mystical |
| Amber | `(0.95, 0.55, 0.2)` | Warmth |
| Teal | `(0.3, 0.85, 0.9)` | Ethereal |

### Ethereal Blue-White (Transcendence)
| Name | RGB | Use Case |
|------|-----|----------|
| Stream Blue | `(0.55, 0.75, 1.0)` | Edges/glow |
| Pure White | `(1.0, 1.0, 1.0)` | Cores/peaks |
| Seam Glow | `(0.6, 0.8, 1.0)` | Transitions |

### Crimson Corridor (Transcendent Domain)
A warm red-to-magenta gradient spectrum with organic breathing walls.

| Name | RGB Formula | Use Case |
|------|-------------|----------|
| Deep Crimson | `(1.0, 0.15, 0.3)` | Wall base low |
| Warm Red | `(0.6, 0.15, 0.3)` to `(1.0, 0.25, 0.55)` | Wall gradient range |
| Hot Magenta | `(0.85, 0.2, 0.55)` | Wall peaks |
| Ambient Warmth | `(0.5, 0.15, 0.4)` | Atmospheric tint |
| Scatter Pink | `(1.0, 0.4, 0.7)` | Light scatter |

**Gradient Formula (GLSL):**
```glsl
float colorPos = wallY * 0.12 + wallZ * 0.06 + iTime * 0.25;
float r = 0.6 + 0.4 * sin(colorPos);
float g = 0.15 + 0.1 * sin(colorPos * 0.7 + 1.0);
float b = 0.3 + 0.25 * sin(colorPos * 1.2 + 2.0);
```
This creates flowing, time-animated gradients that shift between warm reds and magentas.

### Golden Divine
| Name | RGB | Use Case |
|------|-----|----------|
| Deep Gold | `(1.0, 0.75, 0.3)` | Depths |
| Warm Gold | `(1.0, 0.85, 0.5)` | Mid-presence |
| Divine Gold | `(1.0, 0.88, 0.45)` | Peak moments |
| White-Gold | `(1.0, 0.98, 0.9)` | Transcendence |

---

## Experiences Using This Palette

### Transcendent Domain
- **Wall Style:** Breathing/morphing walls with organic pulsing
- **Feeling:** Moving through an infinite crimson corridor into the unknown
- **Colors:** Crimson Corridor palette - warm reds flowing to magentas
- **Movement:** Constant forward motion with gradual acceleration, walls streaming past

### Ascension (The Sacred Vessels)
- **Environment:** Spherical with 5 light columns
- **Phases:** Blue streams → Golden emergence → Cathedral colors
- **Duration:** ~5+ minutes with audio-synced phases

---

## Notes
- [Add notes as we develop new experiences]
