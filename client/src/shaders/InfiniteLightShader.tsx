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

  // Optimized hash functions
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 397.297, 491.187));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Phase timing constants
  const float PHASE_DURATION = 70.0;
  const float TRANSITION_DURATION = 5.0;

  // Beacon colors for each phase
  vec3 getBeaconColor(int phase) {
    if (phase == 0) return vec3(1.0, 0.15, 0.1);      // Red
    if (phase == 1) return vec3(0.1, 0.9, 0.4);       // Emerald
    if (phase == 2) return vec3(0.15, 0.4, 1.0);      // Sapphire
    if (phase == 3) return vec3(1.0, 0.75, 0.2);      // Golden
    if (phase == 4) return vec3(0.7, 0.2, 0.9);       // Amethyst
    return vec3(1.0, 1.0, 0.95);                       // White finale
  }

  // Grid light colors for each phase
  vec3 getGridBaseColor(int phase, float h) {
    if (phase == 0) {
      // Cool blue/white
      vec3 coolBlue = vec3(0.7, 0.85, 1.0);
      vec3 warmAccent = vec3(1.0, 0.8, 0.5);
      return mix(coolBlue, warmAccent, smoothstep(0.7, 0.9, h));
    }
    if (phase == 1) {
      // Red/crimson
      vec3 deepRed = vec3(1.0, 0.2, 0.15);
      vec3 orangeRed = vec3(1.0, 0.5, 0.2);
      return mix(deepRed, orangeRed, h);
    }
    if (phase == 2) {
      // Emerald green
      vec3 deepGreen = vec3(0.1, 0.85, 0.4);
      vec3 tealGreen = vec3(0.2, 1.0, 0.7);
      return mix(deepGreen, tealGreen, h);
    }
    if (phase == 3) {
      // Sapphire blue
      vec3 deepBlue = vec3(0.15, 0.35, 1.0);
      vec3 cyanBlue = vec3(0.3, 0.7, 1.0);
      return mix(deepBlue, cyanBlue, h);
    }
    if (phase == 4) {
      // Golden amber
      vec3 gold = vec3(1.0, 0.8, 0.2);
      vec3 amber = vec3(1.0, 0.6, 0.1);
      return mix(gold, amber, h);
    }
    // Amethyst purple (phase 5)
    vec3 purple = vec3(0.7, 0.2, 0.9);
    vec3 violet = vec3(0.9, 0.4, 1.0);
    return mix(purple, violet, h);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    vec3 col = vec3(0.0);

    // === INTRO PHASE ===
    float singleLightFadeIn = smoothstep(0.0, 0.25, iIntroProgress);
    float singleLightFadeOut = 1.0 - smoothstep(0.7, 1.0, iIntroProgress);
    float singleLightPhase = singleLightFadeIn * singleLightFadeOut;
    float multiplyPhase = smoothstep(0.2, 0.95, iIntroProgress);

    // Central singular light
    float centralDist = length(rd.xz);
    float centralGlow = exp(-centralDist * centralDist * 3.0) * singleLightPhase;
    col += vec3(1.0, 0.95, 0.9) * centralGlow * 1.5;

    // === PHASE CALCULATION ===
    float motionPhase = smoothstep(0.95, 1.0, iIntroProgress);
    float timeSinceMotion = max(0.0, iTime - 5.0); // Assuming intro ~5s

    // Current phase (0-5)
    int currentPhase = int(floor(timeSinceMotion / PHASE_DURATION));
    currentPhase = min(currentPhase, 5);

    // Time within current phase
    float phaseTime = mod(timeSinceMotion, PHASE_DURATION);

    // Transition progress (0 = normal, 1 = peak transition)
    float transitionStart = PHASE_DURATION - TRANSITION_DURATION;
    float transitionProgress = smoothstep(transitionStart, PHASE_DURATION, phaseTime);
    float transitionFlash = sin(transitionProgress * 3.14159) * transitionProgress;

    // Grid visibility (fades during transition)
    float gridFade = 1.0 - smoothstep(transitionStart, PHASE_DURATION - 1.0, phaseTime);
    float nextGridFade = smoothstep(0.0, 3.0, phaseTime); // Fade in after transition

    // Forward motion - continuous through phases
    float forwardMotion = 0.0;
    if (iIntroProgress >= 0.95) {
      float accelCurve = smoothstep(0.0, 15.0, timeSinceMotion);
      forwardMotion = timeSinceMotion * 0.8 * accelCurve;
    }

    // === BEACON ===
    if (motionPhase > 0.0 && currentPhase < 6) {
      float beaconDistX = abs(rd.x);
      float beaconDistY = abs(rd.y);
      float forwardFacing = smoothstep(0.1, -0.4, rd.z);

      float beamWidth = exp(-beaconDistX * beaconDistX * 25.0);
      float beamHeight = smoothstep(0.9, 0.0, beaconDistY);
      float beaconCore = beamWidth * beamHeight * forwardFacing;
      float beaconGlow = exp(-beaconDistX * beaconDistX * 8.0) * forwardFacing * smoothstep(0.95, 0.2, beaconDistY);

      float beaconPulse = sin(iTime * 0.8) * 0.15 + 0.85;

      // Beacon brightness increases as transition approaches
      float approachBrightness = 1.0 + smoothstep(transitionStart - 20.0, transitionStart, phaseTime) * 2.0;
      // Flash bright during transition
      approachBrightness += transitionFlash * 3.0;

      float horizonBeaconIntensity = (beaconCore * 2.0 + beaconGlow * 0.8) * beaconPulse * motionPhase * approachBrightness;

      vec3 beaconColor = getBeaconColor(currentPhase);
      col += beaconColor * horizonBeaconIntensity;
    }

    // === TRANSITION FLASH ===
    if (transitionFlash > 0.0) {
      vec3 flashColor = getBeaconColor(currentPhase);
      col += flashColor * transitionFlash * 2.0;
    }

    // === GRID RENDERING ===
    if (iIntroProgress > 0.15 && motionPhase > 0.0) {
      float spacing = 2.2;
      float t = 0.2;
      float maxRevealDist = 3.0 + multiplyPhase * 57.0;

      for(int i = 0; i < 48; i++) {
        vec3 motionOffset = vec3(0.0, 0.0, -forwardMotion);
        vec3 p = rd * t + motionOffset;

        float h = 0.0;
        float h2 = 0.0;
        float h3 = 0.0;
        vec3 q = vec3(0.0);
        vec3 cellId = vec3(0.0);
        float d = 0.0;

        // === GEOMETRY SELECTION BASED ON PHASE ===
        if (currentPhase == 0) {
          // CUBIC GRID
          cellId = floor(p / spacing);
          q = mod(p, spacing) - spacing * 0.5;
          d = length(q);
          h = hash(cellId);
        }
        else if (currentPhase == 1) {
          // HEXAGONAL HONEYCOMB
          float hexSize = 1.8;
          vec2 hexP = p.xz;
          // Hex grid offset
          float row = floor(p.y / hexSize);
          if (mod(row, 2.0) > 0.5) hexP.x += hexSize * 0.5;
          vec2 hexCell = floor(hexP / hexSize);
          vec2 hexQ = mod(hexP, hexSize) - hexSize * 0.5;
          cellId = vec3(hexCell.x, row, hexCell.y);
          q = vec3(hexQ.x, mod(p.y, hexSize) - hexSize * 0.5, hexQ.y);
          d = length(q);
          h = hash(cellId);
        }
        else if (currentPhase == 2) {
          // SPHERICAL SHELLS - concentric rings
          float shellSpacing = 3.0;
          float shellRadius = length(p);
          float shellId = floor(shellRadius / shellSpacing);
          float shellQ = mod(shellRadius, shellSpacing) - shellSpacing * 0.5;
          // Angular position on shell
          float theta = atan(p.z, p.x);
          float phi = asin(p.y / max(shellRadius, 0.01));
          float angularCell = floor(theta * 3.0 + phi * 2.0);
          cellId = vec3(shellId, angularCell, floor(phi * 4.0));
          d = abs(shellQ) + abs(mod(theta * shellRadius, 1.5) - 0.75) * 0.5;
          h = hash(cellId);
        }
        else if (currentPhase == 3) {
          // VERTICAL PILLARS
          float pillarSpacing = 2.5;
          vec2 pillarCell = floor(p.xz / pillarSpacing);
          vec2 pillarQ = mod(p.xz, pillarSpacing) - pillarSpacing * 0.5;
          // Lights stacked vertically on pillars
          float verticalCell = floor(p.y / 1.5);
          cellId = vec3(pillarCell.x, verticalCell, pillarCell.y);
          q = vec3(pillarQ.x, mod(p.y, 1.5) - 0.75, pillarQ.y);
          d = length(vec2(length(pillarQ), q.y)); // Distance to pillar axis
          h = hash(cellId);
        }
        else if (currentPhase == 4) {
          // DIAMOND/OCTAHEDRAL LATTICE
          float diamondSpacing = 2.0;
          // Offset every other layer
          vec3 offset = vec3(0.0);
          float layer = floor(p.y / diamondSpacing);
          if (mod(layer, 2.0) > 0.5) {
            offset.xz = vec2(diamondSpacing * 0.5);
          }
          vec3 dp = p + offset;
          cellId = floor(dp / diamondSpacing);
          q = mod(dp, diamondSpacing) - diamondSpacing * 0.5;
          // Diamond distance (octahedral)
          d = (abs(q.x) + abs(q.y) + abs(q.z)) * 0.6;
          h = hash(cellId);
        }
        else {
          // SPIRAL (phase 5+)
          float spiralRadius = length(p.xz);
          float spiralAngle = atan(p.z, p.x);
          // Spiral arm calculation
          float armAngle = spiralAngle + spiralRadius * 0.5 + p.y * 0.3;
          float armId = floor(armAngle / 1.047); // 6 arms
          float armQ = mod(armAngle, 1.047) - 0.524;
          cellId = vec3(floor(spiralRadius / 2.0), armId, floor(p.y / 1.5));
          d = abs(armQ) * spiralRadius * 0.3 + abs(mod(spiralRadius, 2.0) - 1.0);
          h = hash(cellId);
        }

        h2 = fract(h * 127.1);
        h3 = fract(h * 311.7);

        // Skip central cells at start
        if (length(cellId) < 0.5 && forwardMotion < 1.0) {
          t += 0.5;
          continue;
        }

        float lightSize = 0.03 + h * 0.05;
        float core = smoothstep(lightSize, 0.0, d) * 3.0;
        float glow = lightSize / (d + 0.02);
        float halo = glow * glow * 0.4;
        float light = core + halo;

        light *= (0.7 + h3 * 0.5) / (1.0 + t * 0.025);

        // Reveal fade
        float cellDist = length(cellId) * spacing;
        float revealFade = smoothstep(maxRevealDist, maxRevealDist - 8.0, cellDist);
        light *= revealFade * multiplyPhase;

        // Apply grid fade during transitions
        light *= mix(gridFade, nextGridFade, smoothstep(0.0, 0.5, phaseTime / PHASE_DURATION));

        // Get phase-appropriate color
        vec3 lightColor = getGridBaseColor(currentPhase, h2);

        // Color shift toward next beacon near horizon
        float forwardness = smoothstep(0.2, -0.6, rd.z);
        float horizonProximity = smoothstep(0.4, 0.0, abs(rd.y));
        float beaconShiftAmount = forwardness * horizonProximity * 0.5;
        vec3 beaconTint = getBeaconColor(currentPhase);
        lightColor = mix(lightColor, beaconTint, beaconShiftAmount);

        col += lightColor * light;

        t += max(d * 0.6, 0.3);
        if(t > maxRevealDist) break;
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
