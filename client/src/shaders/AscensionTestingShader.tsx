import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ASCENSION TESTING - Bare bones version for iterative development
// Currently: Just flowing vertical streams on black background
// No fog, no lights, no phases, no figure

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
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Smooth noise function
  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0;
    return mix(
      mix(hash(n), hash(n + 1.0), f.x),
      mix(hash(n + 57.0), hash(n + 58.0), f.x),
      f.y
    );
  }

  // Fractal noise for organic flow
  float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p *= 2.02;
    f += 0.2500 * noise(p); p *= 2.03;
    f += 0.1250 * noise(p); p *= 2.01;
    f += 0.0625 * noise(p);
    return f / 0.9375;
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);

    // Convert to spherical coordinates for full 360 view
    float theta = atan(rd.z, rd.x);
    float phi = asin(rd.y);

    // UV mapping on sphere
    vec2 uv = vec2(theta / 3.14159, phi / 1.5708);

    // Start with pure black background
    vec3 col = vec3(0.0);

    // Time for animation
    float t = iTime * 0.15;

    // === ASCENDING MOVEMENT ===
    float ascentSpeed = iTime * 0.08;
    float ascentY = uv.y + ascentSpeed;

    // === ORGANIC WATERY LIGHT STREAMS ===
    float numColumns = 5.0;

    for(float i = 0.0; i < 5.0; i++) {
      float columnAngle = (i / numColumns) * 6.28318 + 0.5;
      float columnX = columnAngle / 3.14159;

      // Distance from column center - with organic wobble
      float wobble = sin(ascentY * 3.0 + i * 2.0 + iTime * 0.5) * 0.02;
      float dx = abs(uv.x - columnX + 1.0 + wobble);
      dx = min(dx, abs(uv.x - columnX + wobble));
      dx = min(dx, abs(uv.x - columnX - 1.0 + wobble));

      // Column width varies with flow
      float columnWidth = 0.08 + 0.03 * sin(i * 2.5 + iTime * 0.3);

      float columnMask = smoothstep(columnWidth, 0.0, dx);

      // === ORGANIC, WATERY PARTICLES ===
      float particles = 0.0;

      for(float j = 0.0; j < 4.0; j++) {
        float scale = 6.0 + j * 3.0;
        float speed = t * (1.2 + j * 0.4);

        // Flowing, organic UV with turbulence
        vec2 flowOffset = vec2(
          fbm(vec2(uv.y * 2.0 + iTime * 0.2, i)) * 0.3,
          0.0
        );

        vec2 particleUV = vec2(
          uv.x * scale + i * 3.7 + flowOffset.x,
          ascentY * scale * 2.0 - speed
        );

        // Multiple noise layers for water-like flow
        float n1 = noise(particleUV);
        float n2 = noise(particleUV * 1.5 + vec2(iTime * 0.1, 0.0));
        float n = mix(n1, n2, 0.5);

        // Softer, more fluid particles
        float particle = smoothstep(0.5, 0.75, n);

        // Vertical streaking - water drips
        float streak = noise(vec2(uv.x * 40.0 + i * 7.0, ascentY * 4.0 - speed * 2.5));
        streak = smoothstep(0.4, 0.9, streak);

        // Water ripple effect
        float ripple = sin(ascentY * 30.0 - iTime * 3.0 + i) * 0.5 + 0.5;
        ripple = pow(ripple, 3.0);

        particles += (particle * 0.5 + streak * 0.3 + ripple * 0.2) / (1.0 + j * 0.4);
      }

      // Central glow
      float centerGlow = exp(-dx * dx * 600.0) * 2.0;

      float intensity = columnMask * particles + centerGlow;

      // Vertical gradient
      float verticalGrad = smoothstep(-1.0, 0.3, uv.y);
      intensity *= verticalGrad;

      // Ethereal blue-white color with subtle variation
      vec3 streamColor = vec3(0.55 + 0.1 * sin(i), 0.75, 1.0);
      vec3 coreColor = vec3(1.0, 1.0, 1.0);
      float coreMix = exp(-dx * dx * 1500.0);

      vec3 finalColor = mix(streamColor, coreColor, coreMix);
      col += finalColor * intensity * 0.45;
    }

    // Apply brightness and intro
    col *= iBrightness * iIntroProgress;

    // Color shift
    col.b += iColorShift * 0.1;

    // Tone mapping
    col = col / (col + vec3(0.5));
    col = pow(col, vec3(0.85));

    col *= 1.3;

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface AscensionTestingShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  headRotationY?: number;
  introProgress?: number;
  audioTime?: number;
}

export function AscensionTestingShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0
}: AscensionTestingShaderProps) {
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
