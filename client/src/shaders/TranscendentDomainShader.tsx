import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// TRANSCENDENT DOMAIN - Cosmic volumetric fractal journey
// Optimized for Quest 3: reduced iterations, simplified math
// ~6 minute experience in 3 phases with gentle forward drift

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float iBrightness;
  uniform float iIntroProgress;
  uniform float iColorShift;
  uniform float iForwardMotion;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Volumetric rendering parameters - Quest 3 optimized
  #define VOLSTEPS 6
  #define ITERATIONS 5

  const float formuparam = 0.53;
  const float stepsize = 0.15;
  const float tile = 0.85;
  const float brightness = 0.002;
  const float darkmatter = 0.4;
  const float distfading = 0.73;
  const float saturation = 0.85;

  // Phase timing - 3 phases over ~6 minutes (360 seconds)
  const float PHASE_DURATION = 120.0;  // 2 minutes per phase
  const float TRANSITION_TIME = 15.0;

  // Phase color palettes - cool blue progression
  vec3 getPhaseColor(int phase, float t) {
    if (phase == 0) {
      // Phase 1: Deep cosmic blue
      vec3 base = vec3(0.15, 0.3, 0.8);
      vec3 accent = vec3(0.4, 0.6, 1.0);
      return mix(base, accent, t);
    }
    if (phase == 1) {
      // Phase 2: Ethereal cyan-blue
      vec3 base = vec3(0.2, 0.5, 0.9);
      vec3 accent = vec3(0.5, 0.9, 1.0);
      return mix(base, accent, t);
    }
    // Phase 3: Transcendent white-blue
    vec3 base = vec3(0.5, 0.7, 1.0);
    vec3 accent = vec3(0.9, 0.95, 1.0);
    return mix(base, accent, t);
  }

  // Smooth noise for organic movement
  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);

    // Forward motion - gentle drift through the field
    vec3 from = vec3(0.0, 0.0, -iForwardMotion * 0.5);

    // Slight organic sway
    float sway = sin(iTime * 0.2) * 0.1;
    from.x += sway;
    from.y += cos(iTime * 0.15) * 0.05;

    // === INTRO PHASES ===
    float introFadeIn = smoothstep(0.0, 0.3, iIntroProgress);
    float introComplete = smoothstep(0.9, 1.0, iIntroProgress);

    // === JOURNEY PHASE CALCULATION ===
    float journeyTime = max(0.0, iTime - 8.0);  // Start journey after intro
    int currentPhase = int(floor(journeyTime / PHASE_DURATION));
    currentPhase = min(currentPhase, 2);  // 3 phases (0-2)
    float phaseTime = mod(journeyTime, PHASE_DURATION);
    float phaseProgress = phaseTime / PHASE_DURATION;

    // Transition timing
    float transitionProgress = smoothstep(PHASE_DURATION - TRANSITION_TIME, PHASE_DURATION, phaseTime);

    // Experience ending (fade to white at end of phase 2)
    float experienceProgress = journeyTime / (PHASE_DURATION * 3.0);
    float endingFade = smoothstep(0.9, 1.0, experienceProgress);

    // === VOLUMETRIC RENDERING ===
    float s = 0.1;
    float fade = 1.0;
    vec3 v = vec3(0.0);

    // Slow rotation for cosmic feel
    float rotAngle = iTime * 0.03;
    mat2 rot = mat2(cos(rotAngle), sin(rotAngle), -sin(rotAngle), cos(rotAngle));

    for (int r = 0; r < VOLSTEPS; r++) {
      vec3 p = from + s * rd * 0.5;

      // Tiling fold - creates infinite repetition
      p = abs(vec3(tile) - mod(p, vec3(tile * 2.0)));

      float pa = 0.0;
      float a = 0.0;

      for (int i = 0; i < ITERATIONS; i++) {
        p = abs(p) / dot(p, p) - formuparam;
        // Slow rotation for organic movement
        p.xy *= rot;
        a += abs(length(p) - pa);
        pa = length(p);
      }

      float dm = max(0.0, darkmatter - a * a * 0.001);
      a *= a * a;

      if (r > 3) fade *= 1.3 - dm;

      v += fade;
      v += vec3(s, s * s, s * s * s * s) * a * brightness;
      fade *= distfading;
      s += stepsize;
    }

    // Color adjust with saturation
    v = mix(vec3(length(v)), v, saturation);

    // Base volumetric color
    vec3 col = v * 0.03;

    // === PHASE COLORING ===
    vec3 phaseColor = getPhaseColor(currentPhase, phaseProgress);

    // Blend to next phase color during transition
    if (currentPhase < 2 && transitionProgress > 0.0) {
      vec3 nextColor = getPhaseColor(currentPhase + 1, 0.0);
      phaseColor = mix(phaseColor, nextColor, transitionProgress);
    }

    // Apply phase color to volumetric result
    col *= phaseColor * 2.5;

    // === CENTRAL GLOW ===
    // Soft central glow that pulses with phases
    float centralDist = length(rd.xy);
    float pulseSpeed = 0.5 + float(currentPhase) * 0.3;
    float pulse = 0.7 + 0.3 * sin(iTime * pulseSpeed);
    float centralGlow = exp(-centralDist * centralDist * 2.0) * pulse * 0.3;
    col += phaseColor * centralGlow;

    // === DEPTH SPARKLES ===
    // Distant star-like points
    for (float i = 0.0; i < 3.0; i++) {
      float sparkleScale = 20.0 + i * 15.0;
      vec2 sparkleUV = rd.xy * sparkleScale + vec2(iTime * 0.1 + i * 100.0, iForwardMotion * 0.2);
      float sparkle = hash(floor(sparkleUV.x) * 100.0 + floor(sparkleUV.y));
      sparkle = smoothstep(0.97, 1.0, sparkle);
      float twinkle = sin(iTime * (3.0 + i) + sparkle * 100.0) * 0.5 + 0.5;
      col += vec3(0.8, 0.9, 1.0) * sparkle * twinkle * 0.15 / (1.0 + i * 0.5);
    }

    // === PHASE TRANSITION FLASH ===
    if (transitionProgress > 0.0 && transitionProgress < 1.0) {
      float flash = sin(transitionProgress * 3.14159);
      col += phaseColor * flash * 0.5;
    }

    // === ENDING WHITE FADE ===
    if (endingFade > 0.0) {
      col = mix(col, vec3(1.0), endingFade);
    }

    // Apply brightness and intro
    col *= iBrightness * iIntroProgress;

    // Color shift control
    col.b += iColorShift * 0.1;

    // Tone mapping
    col = col / (col + vec3(0.6));
    col = pow(col, vec3(0.9));

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface TranscendentDomainShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  headRotationY?: number;
  introProgress?: number;
  audioTime?: number;
}

export function TranscendentDomainShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0
}: TranscendentDomainShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const forwardMotionRef = useRef(0);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iBrightness: { value: brightness },
    iIntroProgress: { value: introProgress },
    iColorShift: { value: colorShift },
    iForwardMotion: { value: 0 }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime * speed;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iIntroProgress.value = introProgress;
      material.uniforms.iColorShift.value = colorShift;

      // Constant gentle forward drift - accelerates slightly over time
      const baseSpeed = 0.3;
      const accel = 1.0 + state.clock.elapsedTime * 0.005; // Gentle acceleration
      forwardMotionRef.current += baseSpeed * accel * 0.016; // ~60fps delta
      material.uniforms.iForwardMotion.value = forwardMotionRef.current;
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
