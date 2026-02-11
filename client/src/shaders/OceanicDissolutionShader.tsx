import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// OCEANIC DISSOLUTION - Deep underwater bioluminescence
// Ego boundaries dissolving into infinite dark ocean
// Glowing jellyfish-like forms, caustic light patterns, depth pressure

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
  uniform float iSpeed;
  uniform float iBrightness;
  uniform float iColorShift;
  uniform float iIntroProgress;
  uniform float iElapsedTime;

  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Simplex-style hash for smooth noise
  vec3 hash33(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p.zxy, p.yxz + 19.19);
    return fract(vec3(p.x * p.y, p.y * p.z, p.z * p.x));
  }

  // Smooth 3D noise
  float noise3d(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n = mix(
      mix(
        mix(dot(hash33(i), f), dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
        mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x),
        f.y
      ),
      mix(
        mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
        mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x),
        f.y
      ),
      f.z
    );
    return n * 0.5 + 0.5;
  }

  // Fractal brownian motion
  float fbm(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) {
      val += amp * noise3d(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  // Caustic light pattern - underwater light refraction
  float caustic(vec2 uv, float time) {
    float c = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 p = uv * (3.0 + fi * 1.5);
      p += time * vec2(0.3 + fi * 0.1, 0.2 - fi * 0.05);
      c += sin(p.x * sin(p.y + time * 0.3) + p.y * cos(p.x - time * 0.2));
    }
    return pow(abs(sin(c * 0.5)), 3.0);
  }

  // Bioluminescent organism - soft glowing sphere in the deep
  float biolum(vec3 p, vec3 center, float radius, float time) {
    // Organic pulsing
    float pulse = 1.0 + 0.3 * sin(time * 1.2 + center.x * 3.0) * sin(time * 0.8 + center.z * 2.0);
    float r = radius * pulse;

    float dist = length(p - center);
    // Inner glow + outer halo
    float inner = exp(-dist * dist / (r * r * 0.5));
    float outer = exp(-dist / (r * 3.0));
    return inner * 0.6 + outer * 0.15;
  }

  // Jellyfish tendril effect
  float tendril(vec3 p, float time) {
    float t = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float phase = fi * 1.2566; // 2PI/5
      vec3 origin = vec3(
        sin(phase + time * 0.15) * 12.0,
        -5.0 - fi * 3.0 + sin(time * 0.4 + fi) * 2.0,
        cos(phase + time * 0.12) * 12.0
      );

      // Swaying tendril line
      vec3 dir = vec3(
        sin(time * 0.3 + fi * 0.7) * 0.3,
        -1.0,
        cos(time * 0.25 + fi * 0.9) * 0.3
      );

      // Distance to line segment
      vec3 toP = p - origin;
      float along = dot(toP, dir);
      along = clamp(along, 0.0, 15.0);
      vec3 closest = origin + dir * along;
      float dist = length(p - closest);

      // Thin glowing strand with taper
      float taper = 1.0 - along / 15.0;
      float strand = exp(-dist * dist * 2.0) * taper;

      // Pulsing light along tendril
      float pulseAlong = sin(along * 1.5 - time * 2.0 + fi) * 0.5 + 0.5;
      t += strand * pulseAlong * 0.3;
    }
    return t;
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    float time = iTime * iSpeed;

    // === PHASE SYSTEM (3 phases, ~2 min each) ===
    float phase = clamp(iElapsedTime / 120.0, 0.0, 2.99);
    float phase1 = smoothstep(0.0, 1.0, phase);          // 0→1 over first phase
    float phase2 = smoothstep(1.0, 2.0, phase);          // 0→1 over second phase
    float phase3 = smoothstep(2.0, 3.0, phase);          // 0→1 over third phase

    // === DEPTH / DESCENT ===
    float depth = iElapsedTime * 0.08;
    vec3 sinkOffset = vec3(0.0, -depth, 0.0);

    // === BASE OCEAN COLOR - deep blue with visible gradient ===
    vec3 deepColor = mix(
      vec3(0.02, 0.05, 0.15),   // visible midnight blue
      vec3(0.01, 0.03, 0.08),   // deeper
      phase2
    );
    deepColor = mix(deepColor, vec3(0.005, 0.01, 0.04), phase3);

    // Vertical gradient - lighter above, darker below
    float viewGrad = rd.y * 0.5 + 0.5;
    vec3 col = deepColor * (0.6 + viewGrad * 0.8);

    // === CAUSTIC LIGHT from above (Phase 1 - fades as we descend) ===
    float causticFade = 1.0 - phase1 * 0.5 - phase2 * 0.3;
    {
      float caust = caustic(rd.xz * 2.0, time * 0.5);
      float fromAbove = max(0.0, rd.y) * 0.6 + 0.4;
      vec3 causticColor = vec3(0.15, 0.4, 0.6) * caust * fromAbove * causticFade;
      col += causticColor * 0.8;
    }

    // === PARTICLE / MARINE SNOW ===
    float particles = 0.0;
    for (int i = 0; i < 30; i++) {
      float fi = float(i);
      vec3 pDir = normalize(hash33(vec3(fi * 127.1, fi * 311.7, fi * 74.7)) * 2.0 - 1.0);
      // Slowly drift downward
      pDir.y -= 0.3;
      pDir = normalize(pDir);
      // Rotate over time for movement
      float angle = time * 0.05 + fi * 0.5;
      float ca = cos(angle);
      float sa = sin(angle);
      pDir.xz = mat2(ca, sa, -sa, ca) * pDir.xz;

      float alignment = max(0.0, dot(rd, pDir));
      float sparkle = pow(alignment, 200.0) * 0.8;
      // Twinkle
      sparkle *= 0.5 + 0.5 * sin(time * 2.0 + fi * 7.0);
      particles += sparkle;
    }
    vec3 particleColor = vec3(0.5, 0.7, 0.9) * (1.0 - phase3 * 0.5);
    col += particleColor * particles;

    // === BIOLUMINESCENT ORGANISMS ===
    // Scattered glowing entities in the deep
    float bioGlow = 0.0;
    vec3 bioColor = vec3(0.0);

    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      vec3 h = hash33(vec3(fi * 73.1, fi * 157.3, fi * 213.7));

      // Orbit in 3D space - use direction-based placement
      float orbitSpeed = 0.05 + h.x * 0.08;

      // Place organisms as bright spots in specific directions
      vec3 orgDir = normalize(vec3(
        sin(time * orbitSpeed + fi * 1.256),
        sin(time * orbitSpeed * 0.7 + fi * 2.0) * 0.6,
        cos(time * orbitSpeed * 0.8 + fi * 1.876)
      ));

      // How close is our view direction to this organism's direction?
      float alignment = max(0.0, dot(rd, orgDir));
      // Sharp falloff for point-like glow
      float glow = pow(alignment, 40.0 + h.z * 60.0);
      // Outer halo
      float halo = pow(alignment, 8.0) * 0.15;

      // Pulsing
      float pulse = 0.6 + 0.4 * sin(time * 1.2 + fi * 2.5);
      glow = (glow + halo) * pulse;

      // Color variety: cyan, blue, violet, green
      vec3 orgColor;
      float colorSelect = fract(fi * 0.381);
      if (colorSelect < 0.25) {
        orgColor = vec3(0.2, 0.9, 1.0); // cyan
      } else if (colorSelect < 0.5) {
        orgColor = vec3(0.3, 0.4, 1.0); // deep blue
      } else if (colorSelect < 0.75) {
        orgColor = vec3(0.6, 0.3, 1.0); // violet
      } else {
        orgColor = vec3(0.2, 1.0, 0.5); // bioluminescent green
      }

      // Phase progression: more organisms glow brighter as we descend
      float phaseIntensity = 0.6 + phase1 * 0.2 + phase2 * 0.1 + phase3 * 0.2;
      bioGlow += glow * phaseIntensity;
      bioColor += orgColor * glow * phaseIntensity;
    }

    col += bioColor * 1.5;

    // === JELLYFISH TENDRILS (Phase 2+) ===
    if (phase1 > 0.3) {
      float tendrils = 0.0;
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float phase_offset = fi * 1.2566;
        // Tendril hangs from above, swaying
        vec3 tendrilDir = normalize(vec3(
          sin(phase_offset + time * 0.15) * 0.5,
          -0.7 - fi * 0.05,
          cos(phase_offset + time * 0.12) * 0.5
        ));
        float alignment = max(0.0, dot(rd, tendrilDir));
        // Thin strands
        float strand = pow(alignment, 80.0);
        // Pulsing light
        float pulsing = sin(time * 2.0 + fi * 1.5) * 0.5 + 0.5;
        tendrils += strand * pulsing * 0.6;
      }
      float tendrilIntensity = smoothstep(0.3, 1.0, phase1) * 0.5 + phase2 * 0.3;
      vec3 tendrilColor = mix(
        vec3(0.3, 0.5, 1.0),
        vec3(0.7, 0.3, 0.9),
        sin(time * 0.1) * 0.5 + 0.5
      );
      col += tendrilColor * tendrils * tendrilIntensity;
    }

    // === DEEP CURRENT / VOLUMETRIC FOG ===
    float current = fbm(rd * 2.0 + vec3(time * 0.05, -depth * 0.1, time * 0.03));
    float currentIntensity = 0.15 + phase2 * 0.1;
    vec3 currentColor = mix(
      vec3(0.08, 0.15, 0.3),
      vec3(0.04, 0.08, 0.2),
      phase2
    );
    col += currentColor * current * currentIntensity;

    // === DISSOLUTION EFFECT (Phase 3) ===
    // Visual ego dissolution - edges of vision blur and merge
    if (phase3 > 0.0) {
      // Radial dissolution from edges
      float edgeDist = length(rd.xz);
      float dissolution = fbm(rd * 3.0 + time * 0.1) * phase3;
      float dissolvePattern = smoothstep(0.3, 0.8, dissolution);

      // Everything merges into deep bioluminescent glow
      vec3 dissolveColor = vec3(0.05, 0.15, 0.3) * (1.0 + dissolvePattern * 0.5);
      // Scattered bright spots - like neurons firing
      float neuralFlash = pow(fbm(rd * 8.0 + time * 0.3), 4.0) * phase3;
      dissolveColor += vec3(0.3, 0.6, 1.0) * neuralFlash * 2.0;

      col = mix(col, dissolveColor, phase3 * 0.6);
    }

    // === PRESSURE PULSE ===
    // Deep ocean pressure felt as subtle whole-field pulsing
    float pressure = sin(time * 0.6) * 0.03 + sin(time * 0.23) * 0.02;
    col *= 1.0 + pressure;

    // === FINAL COLOR PROCESSING ===
    // Apply intro progress and brightness
    col *= iBrightness * iIntroProgress;

    // Color shift
    col = mix(col, col.gbr, iColorShift * 0.3);

    // Slight contrast enhancement for the deep
    col = pow(col, vec3(0.95));

    // Soft tonemapping
    col = col / (1.0 + col);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface OceanicDissolutionShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  headRotationY?: number;
  introProgress?: number;
  audioTime?: number;
}

export function OceanicDissolutionShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0
}: OceanicDissolutionShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number | null>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iSpeed: { value: speed },
    iBrightness: { value: brightness },
    iColorShift: { value: colorShift },
    iIntroProgress: { value: introProgress },
    iElapsedTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
      material.uniforms.iSpeed.value = speed;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iColorShift.value = colorShift;
      material.uniforms.iIntroProgress.value = introProgress;

      // Track elapsed time since intro started
      if (introProgress > 0 && startTimeRef.current === null) {
        startTimeRef.current = state.clock.elapsedTime;
      }
      if (startTimeRef.current !== null) {
        material.uniforms.iElapsedTime.value = state.clock.elapsedTime - startTimeRef.current;
      }
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
