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

  // Phase timing
  const float PHASE_DURATION = 70.0;
  const float TRANSITION_TIME = 5.0;

  // Beacon colors
  vec3 getBeaconColor(int phase) {
    if (phase == 0) return vec3(1.0, 0.15, 0.1);      // Red
    if (phase == 1) return vec3(0.1, 0.9, 0.4);       // Emerald
    if (phase == 2) return vec3(0.15, 0.4, 1.0);      // Sapphire
    if (phase == 3) return vec3(1.0, 0.75, 0.2);      // Golden
    if (phase == 4) return vec3(0.7, 0.2, 0.9);       // Amethyst
    return vec3(1.0, 1.0, 0.95);                       // White
  }

  // Grid colors
  vec3 getGridColor(int phase, float h) {
    if (phase == 0) {
      vec3 coolBlue = vec3(0.7, 0.85, 1.0);
      vec3 warmAccent = vec3(1.0, 0.8, 0.5);
      return mix(coolBlue, warmAccent, smoothstep(0.7, 0.9, h));
    }
    if (phase == 1) {
      return mix(vec3(1.0, 0.2, 0.15), vec3(1.0, 0.5, 0.2), h);
    }
    if (phase == 2) {
      return mix(vec3(0.1, 0.85, 0.4), vec3(0.2, 1.0, 0.7), h);
    }
    if (phase == 3) {
      return mix(vec3(0.15, 0.35, 1.0), vec3(0.3, 0.7, 1.0), h);
    }
    if (phase == 4) {
      return mix(vec3(1.0, 0.8, 0.2), vec3(1.0, 0.6, 0.1), h);
    }
    return mix(vec3(0.7, 0.2, 0.9), vec3(0.9, 0.4, 1.0), h);
  }

  // Get spacing for each geometry
  float getSpacing(int phase) {
    if (phase == 0) return 2.2;  // Cubic
    if (phase == 1) return 1.8;  // Hexagonal
    if (phase == 2) return 3.0;  // Spherical
    if (phase == 3) return 2.5;  // Pillars
    if (phase == 4) return 2.0;  // Diamond
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
    int currentPhase = int(floor(journeyTime / PHASE_DURATION));
    currentPhase = min(currentPhase, 5);
    float phaseTime = mod(journeyTime, PHASE_DURATION);

    // Transition timing
    float transitionStart = PHASE_DURATION - TRANSITION_TIME;
    float inTransition = smoothstep(transitionStart, PHASE_DURATION, phaseTime);
    float postTransition = smoothstep(0.0, 3.0, phaseTime); // Fade in after transition

    // Grid visibility: full during phase, fade during transition, fade in at start
    float gridVisibility = 1.0;
    if (phaseTime > transitionStart) {
      gridVisibility = 1.0 - smoothstep(transitionStart, PHASE_DURATION - 1.0, phaseTime);
    }
    if (phaseTime < 3.0 && journeyTime > 1.0) {
      gridVisibility *= postTransition;
    }

    // Forward motion
    float forwardMotion = 0.0;
    if (introComplete > 0.0) {
      float accel = smoothstep(0.0, 15.0, journeyTime);
      forwardMotion = journeyTime * 0.8 * accel;
    }

    // === BEACON ===
    if (introComplete > 0.0 && currentPhase < 6) {
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
        vec3 motionOffset = vec3(0.0, 0.0, -forwardMotion);
        vec3 p = rd * t + motionOffset;

        vec3 cellId;
        float d;
        float h;

        // === GEOMETRY PER PHASE ===
        if (currentPhase == 0) {
          // CUBIC
          cellId = floor(p / spacing);
          vec3 q = mod(p, spacing) - spacing * 0.5;
          d = length(q);
          h = hash(cellId);
        }
        else if (currentPhase == 1) {
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
        else if (currentPhase == 2) {
          // SPHERICAL SHELLS
          float radius = length(p);
          float shellId = floor(radius / spacing);
          float shellQ = mod(radius, spacing) - spacing * 0.5;
          float theta = atan(p.z, p.x);
          float phi = asin(clamp(p.y / max(radius, 0.01), -1.0, 1.0));
          cellId = vec3(shellId, floor(theta * 2.0), floor(phi * 3.0));
          d = abs(shellQ) * 0.8;
          h = hash(cellId);
        }
        else if (currentPhase == 3) {
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
        else if (currentPhase == 4) {
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
          // SPIRAL
          float radius = length(p.xz);
          float angle = atan(p.z, p.x);
          float armAngle = angle + radius * 0.4 + p.y * 0.2;
          float armId = floor(armAngle / 1.047);
          float armQ = mod(armAngle, 1.047) - 0.524;
          cellId = vec3(floor(radius / spacing), armId, floor(p.y / 1.5));
          d = abs(armQ) * max(radius * 0.25, 0.5) + abs(mod(radius, spacing) - spacing * 0.5) * 0.5;
          h = hash(cellId);
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

        light *= (0.7 + h3 * 0.5) / (1.0 + t * 0.025);

        // Visibility
        float cellDist = length(cellId) * spacing;
        float reveal = smoothstep(maxDist, maxDist - 10.0, cellDist);
        light *= reveal * gridVisibility * introComplete;

        // Color
        vec3 lightColor = getGridColor(currentPhase, h2);

        // Tint toward beacon near horizon
        float forwardness = smoothstep(0.2, -0.6, rd.z);
        float horizonProx = smoothstep(0.4, 0.0, abs(rd.y));
        lightColor = mix(lightColor, getBeaconColor(currentPhase), forwardness * horizonProx * 0.4);

        col += lightColor * light;

        t += max(d * 0.5, 0.3);
        if (t > maxDist) break;
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
