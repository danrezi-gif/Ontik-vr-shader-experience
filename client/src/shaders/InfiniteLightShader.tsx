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

  // Optimized hash - single function for Quest performance
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 397.297, 491.187));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    vec3 col = vec3(0.0);

    // === INTRO: Single light emerges, then multiplies to infinity ===

    // Phase 1 (0-0.15): Single central light fades in
    // Phase 2 (0.15-1.0): Lights multiply outward to infinity
    float singleLightPhase = smoothstep(0.0, 0.15, iIntroProgress);
    float multiplyPhase = smoothstep(0.15, 1.0, iIntroProgress);

    // Central singular light - visible first
    float centralDist = length(rd.xz); // Distance from vertical axis
    float centralGlow = exp(-centralDist * centralDist * 3.0) * singleLightPhase;
    vec3 centralColor = vec3(1.0, 0.95, 0.9); // Warm white
    col += centralColor * centralGlow * 1.5;

    // Only show grid lights after initial phase
    if (iIntroProgress > 0.1) {
      float spacing = 2.2;
      float t = 0.2;

      // Max visible distance expands with intro progress
      float maxRevealDist = 3.0 + multiplyPhase * 57.0; // 3 -> 60

      for(int i = 0; i < 48; i++) {
        vec3 p = rd * t;
        vec3 cellId = floor(p / spacing);
        vec3 q = mod(p, spacing) - spacing * 0.5;

        // Skip the central cell (0,0,0) to avoid doubling central light
        if (abs(cellId.x) < 0.5 && abs(cellId.y) < 0.5 && abs(cellId.z) < 0.5) {
          t += 0.5;
          continue;
        }

        float h = hash(cellId);
        float h2 = fract(h * 127.1);
        float h3 = fract(h * 311.7);

        float lightSize = 0.03 + h * 0.05;
        float d = length(q);

        float core = smoothstep(lightSize, 0.0, d) * 3.0;
        float glow = lightSize / (d + 0.02);
        float halo = glow * glow * 0.4;
        float light = core + halo;

        light *= (0.7 + h3 * 0.5) / (1.0 + t * 0.025);

        // Intro reveal: lights fade in based on distance from center
        float cellDist = length(cellId) * spacing;
        float revealFade = smoothstep(maxRevealDist, maxRevealDist - 8.0, cellDist);
        light *= revealFade * multiplyPhase;

        vec3 coolBlue = vec3(0.7, 0.85, 1.0);
        vec3 warmAccent = vec3(1.0, 0.8, 0.5);
        vec3 lightColor = mix(coolBlue, warmAccent, smoothstep(0.7, 0.9, h2));
        lightColor = mix(lightColor, vec3(0.6, 1.0, 0.85), smoothstep(0.4, 0.5, h2) * (1.0 - smoothstep(0.5, 0.6, h2)));

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
