import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

    vec3 col = vec3(0.0);

    // Slow time for meditative feel
    float t = iTime * 0.15;

    // Create multiple vertical light columns (vessels)
    float numColumns = 5.0;

    for(float i = 0.0; i < 5.0; i++) {
      // Column position - spread around the viewer
      float columnAngle = (i / numColumns) * 6.28318 + 0.5;
      float columnX = columnAngle / 3.14159;

      // Distance from this column's center
      float dx = abs(uv.x - columnX + 1.0);
      dx = min(dx, abs(uv.x - columnX));
      dx = min(dx, abs(uv.x - columnX - 1.0));

      // Column width varies slightly
      float columnWidth = 0.08 + 0.02 * sin(i * 2.5);

      // Soft column falloff
      float columnMask = smoothstep(columnWidth, 0.0, dx);

      // Streaming particles flowing down
      float flow = uv.y * 3.0 + t * (0.8 + i * 0.1);

      // Particle streams using noise
      float particles = 0.0;

      // Multiple particle layers for depth
      for(float j = 0.0; j < 3.0; j++) {
        float scale = 8.0 + j * 4.0;
        float speed = t * (1.0 + j * 0.3);

        vec2 particleUV = vec2(
          uv.x * scale + i * 3.7,
          uv.y * scale * 2.0 + speed
        );

        float n = noise(particleUV);

        // Create distinct particles
        float particle = smoothstep(0.6, 0.8, n);

        // Vertical streaking
        float streak = noise(vec2(uv.x * 50.0 + i * 7.0, uv.y * 2.0 + speed * 2.0));
        streak = smoothstep(0.4, 0.9, streak);

        particles += (particle * 0.7 + streak * 0.3) / (1.0 + j * 0.5);
      }

      // Central glow within column - brighter core
      float centerGlow = exp(-dx * dx * 800.0) * 2.0;

      // Combine particles with column
      float intensity = columnMask * particles + centerGlow;

      // Vertical fade - brighter at top, streams down
      float verticalGrad = smoothstep(-0.8, 0.5, uv.y);
      intensity *= verticalGrad;

      // Ethereal blue-white color
      vec3 streamColor = vec3(0.6, 0.8, 1.0);

      // Brighter white in center
      vec3 coreColor = vec3(1.0, 1.0, 1.0);
      float coreMix = exp(-dx * dx * 2000.0);

      vec3 finalColor = mix(streamColor, coreColor, coreMix);

      col += finalColor * intensity * 0.4;
    }

    // Add central luminous presence (abstract figure suggestion)
    float centerDist = length(vec2(uv.x, uv.y * 0.5));

    // Ethereal body glow
    float presence = exp(-centerDist * centerDist * 8.0) * 0.6;

    // Head region - brighter
    float headY = uv.y - 0.3;
    float headDist = length(vec2(uv.x * 1.5, headY));
    float head = exp(-headDist * headDist * 50.0) * 0.8;

    // Arms/reaching gesture
    float armSpread = abs(uv.x) * 2.0;
    float armY = uv.y + 0.1 - armSpread * 0.3;
    float arms = exp(-armY * armY * 20.0) * smoothstep(0.4, 0.1, abs(uv.y + 0.1));
    arms *= smoothstep(0.0, 0.3, abs(uv.x)) * smoothstep(0.5, 0.2, abs(uv.x));

    // Combine presence
    float figureGlow = presence + head + arms * 0.4;

    // Figure color - ethereal white-blue
    vec3 figureColor = vec3(0.9, 0.95, 1.0);
    col += figureColor * figureGlow;

    // Cascading water/light from figure
    float cascade = 0.0;
    for(float k = 0.0; k < 4.0; k++) {
      float cascadeX = uv.x + sin(uv.y * 10.0 + t + k) * 0.02;
      float cascadeStream = exp(-cascadeX * cascadeX * 100.0);
      float cascadeFlow = noise(vec2(cascadeX * 30.0, uv.y * 20.0 - t * 3.0 - k));
      cascadeStream *= smoothstep(0.3, -0.5, uv.y); // Only below figure
      cascade += cascadeStream * cascadeFlow * 0.3;
    }
    col += vec3(0.7, 0.85, 1.0) * cascade;

    // Breathing/pulsing - very subtle
    float breath = sin(iTime * 0.3) * 0.5 + 0.5;
    col *= 0.9 + breath * 0.1;

    // Apply brightness and intro
    col *= iBrightness * iIntroProgress;

    // Color shift
    col.b += iColorShift * 0.1;

    // Tone mapping - preserve bright highlights
    col = col / (col + vec3(0.5));
    col = pow(col, vec3(0.85));

    // Boost overall
    col *= 1.3;

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface SacredVesselsShaderProps {
  speed?: number;
  zoom?: number;
  brightness?: number;
  colorShift?: number;
  pulse?: number;
  headRotationY?: number;
  introProgress?: number;
}

export function SacredVesselsShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0
}: SacredVesselsShaderProps) {
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
