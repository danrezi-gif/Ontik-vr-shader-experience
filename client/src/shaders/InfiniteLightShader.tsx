import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float iTime;
  uniform float iBrightness;
  uniform float iIntroProgress;
  uniform float iColorShift;
  varying vec3 vWorldPosition;

  // Hash functions
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 397.297, 491.187));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  // Phase timing - adjusted for 9:48 track
  // Using #define instead of const for Safari/iOS compatibility
  #define PHASE_DURATION 97.0
  #define TRANSITION_TIME 5.0

  // Beacon colors - using float for Safari/iOS compatibility
  vec3 getBeaconColor(float phase) {
    if (phase < 0.5) return vec3(1.0, 0.15, 0.1);      // Red
    if (phase < 1.5) return vec3(0.1, 0.9, 0.4);       // Emerald
    if (phase < 2.5) return vec3(0.3, 0.9, 1.0);       // Cyan (neon)
    if (phase < 3.5) return vec3(1.0, 0.75, 0.2);      // Golden
    if (phase < 4.5) return vec3(0.7, 0.2, 0.9);       // Amethyst
    return vec3(1.0, 1.0, 0.95);                       // White
  }

  // Grid colors - using float for Safari/iOS compatibility
  vec3 getGridColor(float phase, float h, float shellAngle, float time) {
    if (phase < 0.5) {
      vec3 coolBlue = vec3(0.7, 0.85, 1.0);
      vec3 warmAccent = vec3(1.0, 0.8, 0.5);
      return mix(coolBlue, warmAccent, smoothstep(0.7, 0.9, h));
    }
    if (phase < 1.5) {
      return mix(vec3(1.0, 0.2, 0.15), vec3(1.0, 0.5, 0.2), h);
    }
    if (phase < 2.5) {
      // Neon ring palette - cyan to magenta with angle-based variation
      float angleMix = sin(shellAngle * 2.0 + time * 0.3) * 0.5 + 0.5;
      vec3 cyan = vec3(0.1, 0.9, 1.0);
      vec3 magenta = vec3(1.0, 0.2, 0.8);
      vec3 blue = vec3(0.2, 0.4, 1.0);
      vec3 baseColor = mix(cyan, magenta, angleMix);
      return mix(baseColor, blue, h * 0.4);
    }
    if (phase < 3.5) {
      return mix(vec3(0.15, 0.35, 1.0), vec3(0.3, 0.7, 1.0), h);
    }
    if (phase < 4.5) {
      return mix(vec3(1.0, 0.8, 0.2), vec3(1.0, 0.6, 0.1), h);
    }
    return mix(vec3(0.7, 0.2, 0.9), vec3(0.9, 0.4, 1.0), h);
  }

  // Get spacing for each geometry - using float for Safari/iOS compatibility
  float getSpacing(float phase) {
    if (phase < 0.5) return 2.2;  // Cubic
    if (phase < 1.5) return 1.8;  // Hexagonal
    if (phase < 2.5) return 3.0;  // Spherical
    if (phase < 3.5) return 2.5;  // Pillars
    if (phase < 4.5) return 2.0;  // Diamond
    return 2.0;                   // Spiral
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    vec3 col = vec3(0.0);

    // === INTRO PHASES ===
    float singleLightFadeIn = smoothstep(0.0, 0.25, iIntroProgress);
    float singleLightFadeOut = 1.0 - smoothstep(0.7, 1.0, iIntroProgress);
    float singleLightPhase = singleLightFadeIn * singleLightFadeOut;
    float multiplyPhase = smoothstep(0.2, 0.95, iIntroProgress);
    float introComplete = smoothstep(0.95, 1.0, iIntroProgress);

    // Central light during intro
    float centralDist = length(rd.xz);
    float centralGlow = exp(-centralDist * centralDist * 3.0) * singleLightPhase;
    col += vec3(1.0, 0.95, 0.9) * centralGlow * 1.5;

    // === JOURNEY PHASE CALCULATION ===
    float journeyTime = max(0.0, iTime - 5.0); // Time since intro
    // Using float instead of int for Safari/iOS compatibility
    float currentPhase = floor(journeyTime / PHASE_DURATION);
    currentPhase = min(currentPhase, 5.0);
    float phaseTime = mod(journeyTime, PHASE_DURATION);

    // Transition timing
    float transitionStart = PHASE_DURATION - TRANSITION_TIME;
    float inTransition = smoothstep(transitionStart, PHASE_DURATION, phaseTime);
    float postTransition = smoothstep(0.0, 3.0, phaseTime); // Fade in after transition

    // Grid visibility: full during phase, fade during transition, fade in at start of new phase
    float gridVisibility = 1.0;
    if (phaseTime > transitionStart) {
      // Fade out current grid near end of phase
      gridVisibility = 1.0 - smoothstep(transitionStart, PHASE_DURATION - 1.0, phaseTime);
    }
    if (phaseTime < 3.0 && currentPhase > 0) {
      // Fade in new grid after transition (only for phases 1+, not phase 0)
      gridVisibility *= postTransition;
    }

    // Forward motion - resets each phase so new grid appears around viewer
    float forwardMotion = 0.0;
    if (introComplete > 0.0) {
      float accel = smoothstep(0.0, 10.0, phaseTime);
      forwardMotion = phaseTime * 0.8 * accel;
    }

    // === BEACON === (disabled for phase 5 - warp void has no destination)
    if (introComplete > 0.0 && currentPhase < 4.5) {
      float beaconDistX = abs(rd.x);
      float beaconDistY = abs(rd.y);
      float forwardFacing = smoothstep(0.1, -0.4, rd.z);

      float beamWidth = exp(-beaconDistX * beaconDistX * 25.0);
      float beamHeight = smoothstep(0.9, 0.0, beaconDistY);
      float beaconCore = beamWidth * beamHeight * forwardFacing;
      float beaconGlow = exp(-beaconDistX * beaconDistX * 8.0) * forwardFacing;
      beaconGlow *= smoothstep(0.95, 0.2, beaconDistY);

      float pulse = sin(iTime * 0.8) * 0.15 + 0.85;

      // Beacon intensifies near transition
      float approachBright = 1.0 + smoothstep(transitionStart - 25.0, transitionStart, phaseTime) * 2.5;
      approachBright += inTransition * 4.0; // Flash during transition

      float beaconIntensity = (beaconCore * 2.0 + beaconGlow * 0.8) * pulse * introComplete * approachBright;

      vec3 beaconColor = getBeaconColor(currentPhase);
      col += beaconColor * beaconIntensity;

      // Transition flash
      if (inTransition > 0.0) {
        float flash = sin(inTransition * 3.14159);
        col += beaconColor * flash * 2.5;
      }
    }

    // === INTRO GRID (cubic only, multiplying outward) ===
    if (iIntroProgress > 0.15 && introComplete < 1.0) {
      float spacing = 2.2;
      float t = 0.2;
      float maxDist = 3.0 + multiplyPhase * 57.0;

      for(int i = 0; i < 48; i++) {
        vec3 p = rd * t;
        vec3 cellId = floor(p / spacing);
        vec3 q = mod(p, spacing) - spacing * 0.5;

        if (abs(cellId.x) < 0.5 && abs(cellId.y) < 0.5 && abs(cellId.z) < 0.5) {
          t += 0.5;
          continue;
        }

        float h = hash(cellId);
        float h2 = fract(h * 127.1);
        float h3 = fract(h * 311.7);

        float d = length(q);
        float lightSize = 0.03 + h * 0.05;
        float core = smoothstep(lightSize, 0.0, d) * 3.0;
        float glow = lightSize / (d + 0.02);
        float light = core + glow * glow * 0.4;

        light *= (0.7 + h3 * 0.5) / (1.0 + t * 0.025);

        float cellDist = length(cellId) * spacing;
        float reveal = smoothstep(maxDist, maxDist - 8.0, cellDist);
        light *= reveal * multiplyPhase * (1.0 - introComplete);

        vec3 lightColor = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.8, 0.5), smoothstep(0.7, 0.9, h2));
        col += lightColor * light;

        t += max(d * 0.6, 0.3);
        if (t > maxDist) break;
      }
    }

    // === JOURNEY GRIDS (after intro, with geometry changes) ===
    if (introComplete > 0.0) {
      float spacing = getSpacing(currentPhase);
      float t = 0.2;
      float maxDist = 60.0;

      for(int i = 0; i < 48; i++) {
        // Motion offset - moves viewer forward through grid toward beacon
        vec3 motionOffset = vec3(0.0, 0.0, -forwardMotion);
        vec3 p = rd * t + motionOffset;

        vec3 cellId;
        float d;
        float h;
        float shellAngle = 0.0;

        // === GEOMETRY PER PHASE === (using float comparisons for Safari/iOS)
        if (currentPhase < 0.5) {
          // CUBIC
          cellId = floor(p / spacing);
          vec3 q = mod(p, spacing) - spacing * 0.5;
          d = length(q);
          h = hash(cellId);
        }
        else if (currentPhase < 1.5) {
          // HEXAGONAL
          float hexSize = spacing;
          vec2 hexP = p.xz;
          float row = floor(p.y / hexSize);
          if (mod(row, 2.0) > 0.5) hexP.x += hexSize * 0.5;
          vec2 hexCell = floor(hexP / hexSize);
          vec2 hexQ = mod(hexP, hexSize) - hexSize * 0.5;
          cellId = vec3(hexCell.x, row, hexCell.y);
          d = length(vec3(hexQ.x, mod(p.y, hexSize) - hexSize * 0.5, hexQ.y));
          h = hash(cellId);
        }
        else if (currentPhase < 2.5) {
          // SPHERICAL SHELLS - neon ring style
          float radius = length(p);
          float shellId = floor(radius / spacing);
          float shellQ = mod(radius, spacing) - spacing * 0.5;
          float theta = atan(p.z, p.x);
          float phi = asin(clamp(p.y / max(radius, 0.01), -1.0, 1.0));
          cellId = vec3(shellId, floor(theta * 3.0), floor(phi * 4.0));
          // Tighter ring effect
          d = abs(shellQ) * 0.6;
          h = hash(cellId);
          // Store angle for color cycling
          shellAngle = theta + phi * 2.0;
        }
        else if (currentPhase < 3.5) {
          // VERTICAL PILLARS
          vec2 pillarCell = floor(p.xz / spacing);
          vec2 pillarQ = mod(p.xz, spacing) - spacing * 0.5;
          float vCell = floor(p.y / 1.5);
          cellId = vec3(pillarCell.x, vCell, pillarCell.y);
          float pillarDist = length(pillarQ);
          float vQ = mod(p.y, 1.5) - 0.75;
          d = length(vec2(pillarDist, vQ));
          h = hash(cellId);
        }
        else if (currentPhase < 4.5) {
          // DIAMOND LATTICE
          vec3 offset = vec3(0.0);
          float layer = floor(p.y / spacing);
          if (mod(layer, 2.0) > 0.5) offset.xz = vec2(spacing * 0.5);
          vec3 dp = p + offset;
          cellId = floor(dp / spacing);
          vec3 q = mod(dp, spacing) - spacing * 0.5;
          d = (abs(q.x) + abs(q.y) + abs(q.z)) * 0.5;
          h = hash(cellId);
        }
        else {
          // PHASE 5: WARP THROUGH THE VOID
          // Lights move TOWARD user, short lifespans, darkness with bright flashes

          // Use spherical coordinates for omnidirectional spawning
          float theta = atan(p.z, p.x);
          float phi = asin(clamp(p.y / max(length(p), 0.01), -1.0, 1.0));
          float dist = length(p);

          // Time-based cell that creates movement toward viewer
          float speed = 4.0; // Fast movement
          float movingDist = dist + phaseTime * speed;

          // Sparse, random cell distribution
          float cellSize = 3.5;
          cellId = vec3(
            floor(theta * 3.0 + sin(phi * 5.0) * 0.5),
            floor(phi * 4.0 + cos(theta * 3.0) * 0.5),
            floor(movingDist / cellSize)
          );

          h = hash(cellId);
          float h4 = fract(h * 531.7);

          // Lifespan: each light appears, brightens, fades (2-4 second cycle)
          float lifespan = 2.0 + h * 2.0;
          float birthTime = h4 * lifespan;
          float localTime = mod(phaseTime + birthTime, lifespan);
          float lifeFade = sin(localTime / lifespan * 3.14159); // Smooth in-out

          // Only ~40% of cells have visible lights (darkness)
          float spawnChance = step(0.6, h);
          lifeFade *= spawnChance;

          // Distance within cell
          float cellDist = mod(movingDist, cellSize);
          d = abs(cellDist - cellSize * 0.5) * 0.4;

          // Streak effect: elongate based on speed
          float streak = smoothstep(0.8, 0.0, abs(cellDist - cellSize * 0.5) / cellSize);
          d = mix(d, d * 0.3, streak * 0.5);

          // Store lifeFade in h for use in lighting
          h = lifeFade;
        }

        float h2 = fract(h * 127.1);
        float h3 = fract(h * 311.7);

        // Skip origin
        if (length(cellId) < 0.5 && forwardMotion < 2.0) {
          t += 0.5;
          continue;
        }

        float lightSize = 0.03 + h * 0.05;
        float core = smoothstep(lightSize, 0.0, d) * 3.0;
        float glow = lightSize / (d + 0.02);
        float light = core + glow * glow * 0.4;

        // Enhanced neon glow for phase 2
        if (currentPhase > 1.5 && currentPhase < 2.5) {
          float neonGlow = exp(-d * d * 8.0) * 2.0;
          float pulse = sin(iTime * 1.5 + shellAngle) * 0.3 + 1.0;
          light = (core * 1.5 + glow * glow * 0.6 + neonGlow) * pulse;
        }

        // Phase 5: Warp void special lighting
        if (currentPhase > 4.5) {
          // h contains lifeFade for this phase
          float lifeFade = h;

          // Bright flash glow
          float warpGlow = exp(-d * d * 15.0) * 3.0;
          float streakGlow = exp(-d * 3.0) * 1.5;
          light = (warpGlow + streakGlow) * lifeFade;

          // Occasional bright beacon flashes
          if (h3 > 0.92) {
            light *= 3.0; // Extra bright beacons
          }
        }

        light *= (0.7 + h3 * 0.5) / (1.0 + t * 0.025);

        // Visibility
        float cellDist = length(cellId) * spacing;
        float reveal = smoothstep(maxDist, maxDist - 10.0, cellDist);
        light *= reveal * gridVisibility * introComplete;

        // Color
        vec3 lightColor = getGridColor(currentPhase, h2, shellAngle, iTime);

        // Phase 5: Multi-color from all previous phases
        if (currentPhase > 4.5) {
          // Cycle through all phase colors based on cell hash (using float for Safari/iOS)
          float colorPhase = mod(h2 * 6.0, 5.0);
          if (colorPhase < 1.0) lightColor = vec3(1.0, 0.15, 0.1);       // Red
          else if (colorPhase < 2.0) lightColor = vec3(0.1, 0.9, 0.4);   // Emerald
          else if (colorPhase < 3.0) lightColor = vec3(0.3, 0.9, 1.0);   // Cyan
          else if (colorPhase < 4.0) lightColor = vec3(1.0, 0.75, 0.2);  // Golden
          else lightColor = vec3(0.7, 0.2, 0.9);                         // Amethyst

          // Add white core to bright beacons
          if (h3 > 0.92) {
            lightColor = mix(lightColor, vec3(1.0), 0.5);
          }
        }

        // Tint toward beacon near horizon
        float forwardness = smoothstep(0.2, -0.6, rd.z);
        float horizonProx = smoothstep(0.4, 0.0, abs(rd.y));
        lightColor = mix(lightColor, getBeaconColor(currentPhase), forwardness * horizonProx * 0.4);

        col += lightColor * light;

        t += max(d * 0.5, 0.3);
        if (t > maxDist) break;
      }
    }

    // === PHASE 5: PULSE WAVE RINGS ===
    if (currentPhase > 4.5 && introComplete > 0.0) {
      // Multiple expanding rings from random origins
      for (int w = 0; w < 4; w++) {
        float waveOffset = float(w) * 23.7;
        float waveTime = mod(phaseTime + waveOffset, 12.0); // 12 second cycle per wave

        // Ring expands outward then fades
        float ringRadius = waveTime * 8.0; // Expansion speed
        float ringFade = 1.0 - smoothstep(8.0, 12.0, waveTime);

        // Distance from viewer to ring
        float viewerDist = length(rd * ringRadius);
        float ringDist = abs(length(vWorldPosition * 0.1) - ringRadius * 0.3);

        // Thin glowing ring
        float ringGlow = exp(-ringDist * ringDist * 2.0) * ringFade * 0.4;

        // Ring color cycles
        vec3 ringColor;
        if (w == 0) ringColor = vec3(1.0, 0.2, 0.3);
        else if (w == 1) ringColor = vec3(0.2, 0.9, 0.5);
        else if (w == 2) ringColor = vec3(0.3, 0.5, 1.0);
        else ringColor = vec3(1.0, 0.8, 0.2);

        col += ringColor * ringGlow * gridVisibility;
      }
    }

    // Apply brightness
    col *= iBrightness * 0.8;
    col.b += iColorShift * 0.05;

    // Tone mapping
    col = col / (col + vec3(0.8));
    col = pow(col, vec3(0.9));

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface InfiniteLightShaderProps {
  speed?: number;
  zoom?: number;
  brightness?: number;
  colorShift?: number;
  pulse?: number;
  headRotationY?: number;
  introProgress?: number;
}

export function InfiniteLightShader({
  speed = 1.0,
  zoom = 0.0,
  brightness = 1.0,
  colorShift = 0.0,
  pulse = 0.0,
  headRotationY = 0,
  introProgress = 0
}: InfiniteLightShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iBrightness: { value: brightness },
    iIntroProgress: { value: introProgress },
    iColorShift: { value: colorShift }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime * speed;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iIntroProgress.value = introProgress;
      material.uniforms.iColorShift.value = colorShift;
    }
  });

  return (
    <mesh
      ref={meshRef}
      scale={[-1, 1, 1]}
      rotation={[0, -headRotationY, 0]}
    >
      <sphereGeometry args={[50, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
