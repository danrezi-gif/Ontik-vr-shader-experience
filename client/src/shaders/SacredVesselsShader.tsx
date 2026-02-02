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

    // Time for animation
    float t = iTime * 0.15;

    // === ASCENDING MOVEMENT ===
    // User rises upward through the light - creates vertical drift
    float ascentSpeed = iTime * 0.08; // Slow, meditative rise
    float ascentY = uv.y - ascentSpeed; // Shift view upward over time

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

      // Particle streams using noise - now with ascent
      float particles = 0.0;

      // Multiple particle layers for depth
      for(float j = 0.0; j < 3.0; j++) {
        float scale = 8.0 + j * 4.0;
        float speed = t * (1.0 + j * 0.3);

        // Ascending UV - particles stream past as we rise
        vec2 particleUV = vec2(
          uv.x * scale + i * 3.7,
          ascentY * scale * 2.0 + speed
        );

        float n = noise(particleUV);

        // Create distinct particles
        float particle = smoothstep(0.6, 0.8, n);

        // Vertical streaking - enhanced for ascent feel
        float streak = noise(vec2(uv.x * 50.0 + i * 7.0, ascentY * 3.0 + speed * 2.0));
        streak = smoothstep(0.3, 0.85, streak);

        particles += (particle * 0.6 + streak * 0.4) / (1.0 + j * 0.5);
      }

      // Central glow within column - brighter core
      float centerGlow = exp(-dx * dx * 800.0) * 2.5;

      // Combine particles with column
      float intensity = columnMask * particles + centerGlow;

      // Vertical gradient shifts with ascent - always bright above
      float verticalGrad = smoothstep(-1.0, 0.3, uv.y);
      intensity *= verticalGrad;

      // Ethereal blue-white color
      vec3 streamColor = vec3(0.6, 0.8, 1.0);

      // Brighter white in center
      vec3 coreColor = vec3(1.0, 1.0, 1.0);
      float coreMix = exp(-dx * dx * 2000.0);

      vec3 finalColor = mix(streamColor, coreColor, coreMix);

      col += finalColor * intensity * 0.5;
    }

    // Luminous presence above - we ascend toward it
    // Position shifts down as we rise (we approach from below)
    float figureY = 0.4 - ascentSpeed * 0.3; // Figure descends relative to us
    float figureY_clamped = mod(figureY + 1.0, 2.0) - 1.0; // Wrap around

    float centerDist = length(vec2(uv.x, (uv.y - figureY_clamped) * 0.5));

    // Ethereal body glow
    float presence = exp(-centerDist * centerDist * 6.0) * 0.7;

    // Head region - brighter, above
    float headY = uv.y - figureY_clamped - 0.25;
    float headDist = length(vec2(uv.x * 1.5, headY));
    float head = exp(-headDist * headDist * 40.0) * 0.9;

    // Arms/reaching gesture - welcoming from above
    float armSpread = abs(uv.x) * 2.0;
    float armY = uv.y - figureY_clamped + 0.1 - armSpread * 0.3;
    float arms = exp(-armY * armY * 15.0) * smoothstep(0.5, 0.1, abs(uv.y - figureY_clamped + 0.1));
    arms *= smoothstep(0.0, 0.3, abs(uv.x)) * smoothstep(0.5, 0.2, abs(uv.x));

    // Combine presence
    float figureGlow = presence + head + arms * 0.5;

    // Figure color - ethereal white-blue, brighter
    vec3 figureColor = vec3(0.95, 0.98, 1.0);
    col += figureColor * figureGlow;

    // Light rays descending from above
    float rays = 0.0;
    for(float k = 0.0; k < 5.0; k++) {
      float rayAngle = (k / 5.0) * 6.28318 + ascentSpeed * 0.2;
      float rayX = sin(rayAngle) * 0.15;
      float rayDist = abs(uv.x - rayX);
      float ray = exp(-rayDist * rayDist * 200.0);
      ray *= smoothstep(-0.5, 0.8, uv.y); // Rays from above
      ray *= (0.5 + 0.5 * sin(ascentY * 20.0 + k * 2.0)); // Shimmer
      rays += ray * 0.15;
    }
    col += vec3(0.8, 0.9, 1.0) * rays;

    // Breathing/pulsing - very subtle
    float breath = sin(iTime * 0.3) * 0.5 + 0.5;
    col *= 0.9 + breath * 0.1;

    // === POLE EFFECTS ===
    // Inferior pole - dark fog rising from below (hides seam, creates abyss)
    float inferiorPole = smoothstep(-0.1, -0.7, rd.y); // Extended coverage - starts higher
    col = mix(col, vec3(0.0), inferiorPole); // Full fade to black
    // Add subtle dark blue fog tint
    col += vec3(0.01, 0.015, 0.03) * inferiorPole;

    // Superior pole - subtle glow from above (preserves tunnel effect)
    float superiorPole = smoothstep(0.7, 0.98, rd.y); // Only very top
    vec3 divineLight = vec3(0.8, 0.85, 0.95); // Softer ethereal glow
    col += divineLight * superiorPole * 0.6; // Reduced intensity
    // Gentle bright core at very top
    float poleCore = smoothstep(0.92, 1.0, rd.y);
    col += vec3(1.0, 1.0, 1.0) * poleCore * 0.8;

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
