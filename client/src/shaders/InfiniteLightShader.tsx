import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float iBrightness;
  uniform float iIntroProgress;
  uniform float iColorShift;
  uniform vec2 iResolution;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  #define PI 3.14159265359

  // Hash functions
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 397.297, 491.187));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  // Phase timing - halved duration for each light
  const float PHASE_DURATION = 48.0;
  const float TRANSITION_TIME = 5.0;
  const float TUNNEL_DURATION = 40.0;

  // Beacon colors
  vec3 getBeaconColor(int phase) {
    if (phase == 0) return vec3(1.0, 0.15, 0.1);      // Red
    if (phase == 1) return vec3(0.1, 0.9, 0.4);       // Emerald
    if (phase == 2) return vec3(1.0, 0.75, 0.2);      // Golden (was pillars)
    if (phase == 3) return vec3(0.7, 0.2, 0.9);       // Amethyst (was diamond)
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
      // Pillars - blue tones
      return mix(vec3(0.15, 0.35, 1.0), vec3(0.3, 0.7, 1.0), h);
    }
    if (phase == 3) {
      // Diamond - golden
      return mix(vec3(1.0, 0.8, 0.2), vec3(1.0, 0.6, 0.1), h);
    }
    return vec3(1.0);
  }

  // Get spacing for each geometry
  float getSpacing(int phase) {
    if (phase == 0) return 2.2;  // Cubic
    if (phase == 1) return 1.8;  // Hexagonal
    if (phase == 2) return 2.5;  // Pillars
    if (phase == 3) return 2.0;  // Diamond
    return 2.0;
  }

  // Get speed multiplier - progressively faster from phase 1 to 4
  float getSpeedMultiplier(int phase, float phaseProgress) {
    if (phase == 0) return 1.0;
    if (phase == 1) return 1.5 + phaseProgress * 0.5;  // 1.5 -> 2.0
    if (phase == 2) return 2.5 + phaseProgress * 1.0;  // 2.5 -> 3.5
    if (phase == 3) return 4.0 + phaseProgress * 2.0;  // 4.0 -> 6.0
    return 6.0;
  }

  // === FLOWING TUNNEL SHADER (Phase 4) ===
  vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.2, 0.4, 0.5);
    return a + b * cos(2.0 * PI * (c * t + d));
  }

  vec3 renderTunnelPhase(vec3 rd, float time, float visibility, float tunnelProgress) {
    // Tunnel coordinate system - looking forward into -Z
    float angle = atan(rd.y, rd.x);
    float radialDist = length(rd.xy);

    // Create tunnel depth illusion based on view angle
    float tunnelDepth = 1.0 / (radialDist + 0.1);

    // Flowing motion through tunnel
    float flow = time * 2.0;

    // Create glowing rings that flow toward viewer
    float ringFreq = 8.0;
    float rings = sin((tunnelDepth * ringFreq - flow) * PI);
    rings = smoothstep(0.3, 1.0, rings);

    // Spiral glow pattern
    float spiral = sin(angle * 3.0 + tunnelDepth * 4.0 - flow * 1.5);
    spiral = spiral * 0.5 + 0.5;

    // Color shifts as user travels through tunnel
    float colorPhase = tunnelDepth * 0.3 - time * 0.15;
    vec3 tunnelColor = palette(colorPhase + angle / (2.0 * PI));

    // Glowing edges of tunnel
    float edgeGlow = smoothstep(0.8, 0.2, radialDist);
    float coreGlow = exp(-radialDist * radialDist * 3.0);

    // Combine effects
    float glow = (rings * 0.6 + spiral * 0.4) * edgeGlow + coreGlow * 0.5;

    // Pulsing intensity
    float pulse = 0.8 + 0.2 * sin(time * 3.0) + 0.1 * sin(time * 5.3);
    glow *= pulse;

    vec3 color = tunnelColor * glow * 2.0;

    // === ENDING SEQUENCE (last 10 seconds of 40) ===
    float endingStart = 30.0;
    float endingProgress = smoothstep(endingStart, TUNNEL_DURATION, tunnelProgress * TUNNEL_DURATION);

    if (endingProgress > 0.0) {
      // Multiple glows appear from different directions
      vec3 multiGlow = vec3(0.0);

      // Glow 1 - from above
      float glow1Dist = length(rd - vec3(0.0, 0.8, -0.6));
      float glow1 = exp(-glow1Dist * glow1Dist * 8.0);
      multiGlow += palette(0.0) * glow1;

      // Glow 2 - from below left
      float glow2Dist = length(rd - vec3(-0.7, -0.5, -0.5));
      float glow2 = exp(-glow2Dist * glow2Dist * 8.0);
      multiGlow += palette(0.33) * glow2;

      // Glow 3 - from below right
      float glow3Dist = length(rd - vec3(0.7, -0.5, -0.5));
      float glow3 = exp(-glow3Dist * glow3Dist * 8.0);
      multiGlow += palette(0.66) * glow3;

      // Glow 4 - from center front
      float glow4Dist = length(rd - vec3(0.0, 0.0, -1.0));
      float glow4 = exp(-glow4Dist * glow4Dist * 6.0);
      multiGlow += vec3(1.0, 0.95, 0.9) * glow4;

      // Glows intensify
      float glowIntensity = smoothstep(0.0, 0.5, endingProgress) * 3.0;
      multiGlow *= glowIntensity;

      // All glows converge and transform to white
      float whiteTransition = smoothstep(0.6, 1.0, endingProgress);
      vec3 pureWhite = vec3(1.0, 1.0, 1.0);

      // Mix colored glows to white
      multiGlow = mix(multiGlow, pureWhite * (glow1 + glow2 + glow3 + glow4) * 2.0, whiteTransition);

      // Fade tunnel, bring in glows
      float tunnelFade = 1.0 - smoothstep(0.0, 0.4, endingProgress);
      color = color * tunnelFade + multiGlow;

      // Final fade to silence (white fades out)
      float finalFade = smoothstep(0.85, 1.0, endingProgress);
      color *= (1.0 - finalFade);
    }

    return color * visibility;
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
    float journeyTime = max(0.0, iTime - 5.0);
    int currentPhase = int(floor(journeyTime / PHASE_DURATION));
    currentPhase = min(currentPhase, 4);
    float phaseTime = mod(journeyTime, PHASE_DURATION);
    float phaseProgress = phaseTime / PHASE_DURATION;

    // Transition timing
    float transitionStart = PHASE_DURATION - TRANSITION_TIME;
    float inTransition = smoothstep(transitionStart, PHASE_DURATION, phaseTime);
    float postTransition = smoothstep(0.0, 3.0, phaseTime);

    // Grid visibility
    float gridVisibility = 1.0;
    if (phaseTime > transitionStart) {
      gridVisibility = 1.0 - smoothstep(transitionStart, PHASE_DURATION - 1.0, phaseTime);
    }
    if (phaseTime < 3.0 && currentPhase > 0) {
      gridVisibility *= postTransition;
    }

    // Forward motion with progressive speed
    float forwardMotion = 0.0;
    if (introComplete > 0.0 && currentPhase < 4) {
      float speedMult = getSpeedMultiplier(currentPhase, phaseProgress);
      float accel = smoothstep(0.0, 10.0, phaseTime);
      forwardMotion = phaseTime * 0.8 * accel * speedMult;
    }

    // === BEACON === (only for phases 0-3)
    if (introComplete > 0.0 && currentPhase < 4) {
      float beaconDistX = abs(rd.x);
      float beaconDistY = abs(rd.y);
      float forwardFacing = smoothstep(0.1, -0.4, rd.z);

      // Approach factor: starts at 0, grows to 1 as user approaches light
      float approachFactor = smoothstep(0.0, transitionStart, phaseTime);

      // Light starts smaller (narrower beam) and grows as user approaches
      float beamTightness = 40.0 - approachFactor * 20.0; // 40 -> 20 (gets wider)
      float beamWidth = exp(-beaconDistX * beaconDistX * beamTightness);
      float beamHeight = smoothstep(0.9, 0.0, beaconDistY);
      float beaconCore = beamWidth * beamHeight * forwardFacing;

      float glowTightness = 12.0 - approachFactor * 6.0; // 12 -> 6 (gets wider)
      float beaconGlow = exp(-beaconDistX * beaconDistX * glowTightness) * forwardFacing;
      beaconGlow *= smoothstep(0.95, 0.2, beaconDistY);

      // Pulsation increases as user approaches - starts subtle, becomes very alive
      float pulseSpeed = 0.8 + approachFactor * 4.0; // 0.8 -> 4.8 Hz
      float pulseIntensity = 0.05 + approachFactor * 0.4; // 5% -> 45% variation
      float pulse = 1.0 + sin(iTime * pulseSpeed) * pulseIntensity;
      // Add secondary faster pulse when very close
      float closePulse = smoothstep(0.7, 1.0, approachFactor);
      pulse += sin(iTime * 8.0) * 0.2 * closePulse;
      pulse += sin(iTime * 12.0) * 0.1 * closePulse;

      // Intensity grows from small to bright as user approaches
      float baseIntensity = 0.3 + approachFactor * 0.7; // starts at 30%, grows to 100%
      float approachBright = baseIntensity + smoothstep(transitionStart - 15.0, transitionStart, phaseTime) * 3.0;
      approachBright += inTransition * 5.0;

      float beaconIntensity = (beaconCore * 2.0 + beaconGlow * 0.8) * pulse * introComplete * approachBright;

      vec3 beaconColor = getBeaconColor(currentPhase);
      col += beaconColor * beaconIntensity;

      if (inTransition > 0.0) {
        float flash = sin(inTransition * 3.14159);
        col += beaconColor * flash * 3.0;
      }
    }

    // === INTRO GRID (cubic only) ===
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

    // === JOURNEY GRIDS (phases 0-3) ===
    if (introComplete > 0.0 && currentPhase < 4) {
      float baseSpacing = getSpacing(currentPhase);

      // Grid becomes increasingly sparse as user approaches light
      // Spacing grows from 1x to 3x as phaseProgress goes 0 -> 1
      float sparseFactor = 1.0 + phaseProgress * 2.0;
      float spacing = baseSpacing * sparseFactor;

      // Dots become brighter as grid becomes sparser
      float sparseBrightness = 1.0 + phaseProgress * 2.5; // 1x -> 3.5x brighter

      float t = 0.2;
      float maxDist = 80.0 + phaseProgress * 40.0; // Extended view distance

      for(int i = 0; i < 48; i++) {
        vec3 motionOffset = vec3(0.0, 0.0, -forwardMotion);
        vec3 p = rd * t + motionOffset;

        vec3 cellId;
        float d;
        float h;

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
          // VERTICAL PILLARS
          float vSpacing = 1.5 * sparseFactor;
          vec2 pillarCell = floor(p.xz / spacing);
          vec2 pillarQ = mod(p.xz, spacing) - spacing * 0.5;
          float vCell = floor(p.y / vSpacing);
          cellId = vec3(pillarCell.x, vCell, pillarCell.y);
          float pillarDist = length(pillarQ);
          float vQ = mod(p.y, vSpacing) - vSpacing * 0.5;
          d = length(vec2(pillarDist, vQ));
          h = hash(cellId);
        }
        else {
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

        float h2 = fract(h * 127.1);
        float h3 = fract(h * 311.7);

        if (length(cellId) < 0.5 && forwardMotion < 2.0) {
          t += 0.5;
          continue;
        }

        // Light size grows slightly as grid becomes sparser
        float lightSize = (0.03 + h * 0.05) * (1.0 + phaseProgress * 0.5);
        float core = smoothstep(lightSize, 0.0, d) * 3.0;
        float glow = lightSize / (d + 0.02);
        float light = core + glow * glow * 0.4;

        // Apply sparse brightness boost
        light *= sparseBrightness;
        light *= (0.7 + h3 * 0.5) / (1.0 + t * 0.02);

        float cellDist = length(cellId) * spacing;
        float reveal = smoothstep(maxDist, maxDist - 15.0, cellDist);
        light *= reveal * gridVisibility * introComplete;

        vec3 lightColor = getGridColor(currentPhase, h2);

        float forwardness = smoothstep(0.2, -0.6, rd.z);
        float horizonProx = smoothstep(0.4, 0.0, abs(rd.y));
        lightColor = mix(lightColor, getBeaconColor(currentPhase), forwardness * horizonProx * 0.4);

        col += lightColor * light;

        t += max(d * 0.5, 0.3);
        if (t > maxDist) break;
      }
    }

    // === PHASE 4: FLOWING TUNNEL ===
    if (currentPhase == 4 && introComplete > 0.0) {
      // Calculate tunnel progress (0 to 1 over TUNNEL_DURATION seconds)
      float tunnelTime = journeyTime - (PHASE_DURATION * 4.0);
      float tunnelProgress = clamp(tunnelTime / TUNNEL_DURATION, 0.0, 1.0);
      col += renderTunnelPhase(rd, iTime, gridVisibility * introComplete, tunnelProgress);
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
    iColorShift: { value: colorShift },
    iResolution: { value: new THREE.Vector2(1920, 1080) }
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
