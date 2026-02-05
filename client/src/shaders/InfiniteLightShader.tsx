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

  // Phase timing - adjusted for track
  const float PHASE_DURATION = 97.0;
  const float TRANSITION_TIME = 5.0;

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

  // === PALETTE SHADER (Phase 4) ===
  vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.2, 0.4, 0.5);
    return a + b * cos(2.0 * PI * (c * t + d));
  }

  vec3 renderPalettePhase(vec3 rd, float time, float visibility) {
    vec2 uv = rd.xy * 2.0;

    float angle = atan(-uv.y, -uv.x) / (2.0 * PI);
    float dist = length(uv) * 1.5;

    // Simulated audio level
    float level = 0.3 + 0.2 * sin(time * 2.0) + 0.1 * sin(time * 3.7);

    angle = abs(2.0 * (1.0 - angle));

    if (dist < 1.0) {
      dist = pow(dist, (1.0 - 0.95 * level) * 20.0);
    } else {
      dist = pow(pow(2.0, 100.0), 1.0 - dist);
    }

    vec3 result = (1.0 + 5.0 * level) * dist * palette(-time / 2.0 + angle);
    vec3 color = tanh(result);

    return color * visibility;
  }

  // === TORUS SHADER (Phase 5) ===
  const float Radius1 = 8.0;
  const float Radius2 = 3.0;
  const float TorusSpeed1 = 0.3;
  const float TorusSpeed2 = 15.0;

  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }

  float mapTorus(vec3 pos) {
    vec3 q = pos;
    float d = -sdTorus(q.xzy, vec2(Radius1, Radius2));
    return d;
  }

  vec3 calcTorusNormal(vec3 pos) {
    const float ep = 0.0001;
    vec2 e = vec2(1.0, -1.0) * 0.5773;
    return normalize(
      e.xyy * mapTorus(pos + e.xyy * ep) +
      e.yyx * mapTorus(pos + e.yyx * ep) +
      e.yxy * mapTorus(pos + e.yxy * ep) +
      e.xxx * mapTorus(pos + e.xxx * ep)
    );
  }

  vec3 applyFog(vec3 rgb, float distance, float strength) {
    float fogAmount = 1.0 - exp(-distance * strength);
    vec3 fogColor = vec3(0.0);
    return mix(rgb, fogColor, fogAmount);
  }

  vec3 renderTorusPhase(vec3 rd, float time, float visibility, vec3 noiseCoord) {
    vec3 ro = vec3(0.0, Radius1, 0.0);
    rd = rd.zxy;

    float rotTime = time * TorusSpeed1;

    mat3 m = mat3(
      1.0, 0.0, 0.0,
      0.0, cos(rotTime), sin(rotTime),
      0.0, -sin(rotTime), cos(rotTime)
    );

    rd = m * rd;

    float t = 0.5;
    for (int i = 0; i < 64; i++) {
      vec3 p = ro + t * rd;
      float h = mapTorus(p);
      if (abs(h) < 0.001) break;
      t += h;
    }

    vec3 p = ro + t * rd;
    float theta = (atan(p.x, p.y) / PI + 1.0) * 150.0 - time * TorusSpeed2;
    float phi = (atan(length(p.xy) - Radius1, p.z) / PI + 1.0) * 30.0;

    float itheta = floor(theta);
    float iphi = floor(phi);
    float ftheta = theta - itheta;
    float fphi = phi - iphi;

    ftheta = clamp(ftheta * 0.6 + 0.2, 0.0, 1.0);
    fphi = clamp(fphi * 0.8 + 0.1, 0.0, 1.0);

    // Use noise for randomization
    float randVal = hash(vec3(iphi, itheta, 0.0) * 0.386557);
    float digit = floor(randVal * 10.0);

    // Time-based digit variation
    float freq = sin(time * 0.5 + randVal * 6.28) * 0.5 + 0.5;
    digit = mod(digit + (freq > 0.5 ? 1.0 : 0.0), 10.0);

    // Simple digit pattern
    vec2 digitUV = vec2(ftheta, fphi) * 2.0 - 1.0;
    float pattern = 0.0;
    float d = mod(digit, 10.0);
    if (d < 2.0) pattern = step(abs(digitUV.y - 0.5), 0.15) + step(abs(digitUV.y + 0.5), 0.15);
    else if (d < 4.0) pattern = step(abs(digitUV.y), 0.15);
    else if (d < 6.0) pattern = step(abs(digitUV.x), 0.15);
    else if (d < 8.0) pattern = step(length(digitUV), 0.4);
    else pattern = step(abs(digitUV.x - digitUV.y), 0.2);

    vec3 color = vec3(clamp(pattern, 0.0, 1.0));
    color *= vec3(0.2, 1.0, 0.3); // Green matrix color

    vec3 norm = calcTorusNormal(p);
    color = applyFog(color, t, 0.2 * ((norm.z * norm.z) / 3.0 + 0.1 + clamp(norm.y * 0.4, 0.0, 1.0)));

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
    currentPhase = min(currentPhase, 5);
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

      float beamWidth = exp(-beaconDistX * beaconDistX * 25.0);
      float beamHeight = smoothstep(0.9, 0.0, beaconDistY);
      float beaconCore = beamWidth * beamHeight * forwardFacing;
      float beaconGlow = exp(-beaconDistX * beaconDistX * 8.0) * forwardFacing;
      beaconGlow *= smoothstep(0.95, 0.2, beaconDistY);

      float pulse = sin(iTime * 0.8) * 0.15 + 0.85;

      float approachBright = 1.0 + smoothstep(transitionStart - 25.0, transitionStart, phaseTime) * 2.5;
      approachBright += inTransition * 4.0;

      float beaconIntensity = (beaconCore * 2.0 + beaconGlow * 0.8) * pulse * introComplete * approachBright;

      vec3 beaconColor = getBeaconColor(currentPhase);
      col += beaconColor * beaconIntensity;

      if (inTransition > 0.0) {
        float flash = sin(inTransition * 3.14159);
        col += beaconColor * flash * 2.5;
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
      float spacing = getSpacing(currentPhase);
      float t = 0.2;
      float maxDist = 60.0;

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
          // VERTICAL PILLARS (was phase 3)
          vec2 pillarCell = floor(p.xz / spacing);
          vec2 pillarQ = mod(p.xz, spacing) - spacing * 0.5;
          float vCell = floor(p.y / 1.5);
          cellId = vec3(pillarCell.x, vCell, pillarCell.y);
          float pillarDist = length(pillarQ);
          float vQ = mod(p.y, 1.5) - 0.75;
          d = length(vec2(pillarDist, vQ));
          h = hash(cellId);
        }
        else {
          // DIAMOND LATTICE (was phase 4)
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

        float lightSize = 0.03 + h * 0.05;
        float core = smoothstep(lightSize, 0.0, d) * 3.0;
        float glow = lightSize / (d + 0.02);
        float light = core + glow * glow * 0.4;

        light *= (0.7 + h3 * 0.5) / (1.0 + t * 0.025);

        float cellDist = length(cellId) * spacing;
        float reveal = smoothstep(maxDist, maxDist - 10.0, cellDist);
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

    // === PHASE 4: PALETTE SHADER ===
    if (currentPhase == 4 && introComplete > 0.0) {
      col += renderPalettePhase(rd, iTime, gridVisibility * introComplete);
    }

    // === PHASE 5: TORUS MATRIX ===
    if (currentPhase == 5 && introComplete > 0.0) {
      col += renderTorusPhase(rd, iTime, gridVisibility * introComplete, vWorldPosition);
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
