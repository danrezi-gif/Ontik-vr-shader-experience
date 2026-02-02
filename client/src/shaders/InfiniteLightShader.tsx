import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float iBrightness;
  uniform float iIntroProgress;
  uniform float iColorShift;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    // Ray direction from center toward sphere surface
    vec3 rd = normalize(vWorldPosition);

    // Background - pure void
    vec3 col = vec3(0.0);

    // Grid spacing - dense like room of mirrors
    vec3 spacing = vec3(4.0);

    // Light properties - static, no breathing
    float coreRadius = 0.08;
    float glowRadius = 0.6;

    // Cool white color palette
    vec3 coreColor = vec3(1.0, 1.0, 1.0); // Pure white core
    vec3 glowColor = vec3(0.7, 0.85, 1.0); // Cool blue-white glow

    // Raymarching through infinite grid
    float t = 0.0;
    float totalLight = 0.0;

    for(int i = 0; i < 64; i++) {
      vec3 p = rd * t;

      // Infinite grid repetition
      vec3 q = mod(p + spacing * 0.5, spacing) - spacing * 0.5;

      // Distance to light center
      float d = length(q);

      // Two-layer glow: bright core + soft halo
      // Core - small, bright
      float core = smoothstep(coreRadius, 0.0, d) * 2.0;

      // Halo - larger, softer
      float halo = glowRadius / (d + 0.1);
      halo = halo * halo * 0.15;

      // Combine
      float light = core + halo;

      // Distance fade - lights further away are dimmer
      float distanceFade = 1.0 / (1.0 + t * 0.03);

      totalLight += light * distanceFade;

      // March forward
      t += max(d * 0.4, 0.2);

      // Stop when far enough
      if(t > 80.0) break;
    }

    // Apply colors - core is white, glow is cool blue
    col += coreColor * totalLight * 0.3;
    col += glowColor * totalLight * 0.15;

    // Apply brightness and intro fade
    // Intro: darkness fades, grid revealed
    float introFade = iIntroProgress;
    col *= iBrightness * introFade;

    // Subtle color shift support
    col.b += iColorShift * 0.05;

    // Tone mapping for smooth rolloff
    col = col / (col + vec3(1.0));

    // Slight contrast boost
    col = pow(col, vec3(0.95));

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
