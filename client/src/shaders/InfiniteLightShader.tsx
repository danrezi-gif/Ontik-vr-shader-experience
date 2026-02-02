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

  // Hash function for pseudo-random values per light
  float hash(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  vec3 hash3(vec3 p) {
    return vec3(
      hash(p),
      hash(p + vec3(127.1, 311.7, 74.7)),
      hash(p + vec3(269.5, 183.3, 246.1))
    );
  }

  void main() {
    // Ray direction from center toward sphere surface
    vec3 rd = normalize(vWorldPosition);

    // Background - pure void
    vec3 col = vec3(0.0);

    // Dense grid spacing - Kusama infinity room density
    float spacing = 1.8;

    // Raymarching through infinite grid
    float t = 0.1;

    for(int i = 0; i < 100; i++) {
      vec3 p = rd * t;

      // Get grid cell ID for this point
      vec3 cellId = floor(p / spacing);

      // Infinite grid repetition - position within cell
      vec3 q = mod(p, spacing) - spacing * 0.5;

      // Get random values for this specific light
      vec3 rand = hash3(cellId);
      float randSize = rand.x;
      float randColor = rand.y;
      float randBright = rand.z;

      // Vary light size - some large, many small (like Kusama)
      float lightSize = 0.02 + randSize * 0.06;

      // Distance to light center
      float d = length(q);

      // Star-like glow with sharp core
      float core = smoothstep(lightSize, lightSize * 0.3, d);
      float glow = lightSize * 0.8 / (d + 0.02);
      glow = glow * glow * 0.08;

      float light = core * 1.5 + glow;

      // Brightness variation per light
      light *= 0.5 + randBright * 0.8;

      // Distance fade - further lights dimmer
      float distanceFade = 1.0 / (1.0 + t * 0.025);
      light *= distanceFade;

      // Color palette - mix of warm and cool like Kusama
      // Blue-dominant with occasional warm accents
      vec3 lightColor;
      if (randColor < 0.4) {
        // Cool blue-white (most common)
        lightColor = vec3(0.7, 0.85, 1.0);
      } else if (randColor < 0.55) {
        // Pure white
        lightColor = vec3(1.0, 1.0, 1.0);
      } else if (randColor < 0.7) {
        // Cyan-green
        lightColor = vec3(0.5, 1.0, 0.8);
      } else if (randColor < 0.82) {
        // Warm yellow
        lightColor = vec3(1.0, 0.9, 0.5);
      } else if (randColor < 0.92) {
        // Orange
        lightColor = vec3(1.0, 0.6, 0.3);
      } else {
        // Red/pink accent
        lightColor = vec3(1.0, 0.4, 0.6);
      }

      col += lightColor * light;

      // Adaptive step size - smaller steps near lights
      t += max(d * 0.5, 0.15);

      // Extended range for deep infinity effect
      if(t > 120.0) break;
    }

    // Apply brightness and intro fade
    float introFade = iIntroProgress;
    col *= iBrightness * introFade * 0.4;

    // Color shift affects blue channel
    col.b += iColorShift * 0.05;

    // Tone mapping for smooth rolloff
    col = col / (col + vec3(0.8));

    // Slight contrast boost
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
