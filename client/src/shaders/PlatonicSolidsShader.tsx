import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useXRSessionVisibilityState } from '@react-three/xr';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float iTime;
  uniform float iIntroProgress;
  uniform vec2 iResolution;

  // Golden ratio for dodecahedron and icosahedron
  #define PHI 1.618033988749895

  // === PLATONIC SOLID SDFs ===

  // Tetrahedron
  float sdTetrahedron(vec3 p, float size) {
    float k = sqrt(2.0);
    p /= size;
    p.xz = abs(p.xz);
    float m = 2.0 * p.z - k * p.y - 1.0;
    p = (m > 0.0) ? p : vec3(p.z, p.y, p.x);
    float m2 = 2.0 * p.z - k * p.y - 1.0;
    p = (m2 > 0.0) ? p : vec3(p.z, p.y, p.x);
    p.xz -= clamp(p.xz, 0.0, 1.0);
    float d = length(p) * sign(p.y);
    return d * size;
  }

  // Cube (Hexahedron)
  float sdCube(vec3 p, float size) {
    vec3 d = abs(p) - vec3(size);
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
  }

  // Octahedron
  float sdOctahedron(vec3 p, float size) {
    p = abs(p);
    float m = p.x + p.y + p.z - size;
    vec3 q;
    if (3.0 * p.x < m) q = p.xyz;
    else if (3.0 * p.y < m) q = p.yzx;
    else if (3.0 * p.z < m) q = p.zxy;
    else return m * 0.57735027;
    float k = clamp(0.5 * (q.z - q.y + size), 0.0, size);
    return length(vec3(q.x, q.y - size + k, q.z - k));
  }

  // Dodecahedron
  float sdDodecahedron(vec3 p, float size) {
    vec3 n1 = normalize(vec3(PHI, 1.0, 0.0));
    vec3 n2 = normalize(vec3(1.0, PHI, 0.0));
    vec3 n3 = normalize(vec3(0.0, 1.0, PHI));
    p = abs(p);
    float a = dot(p, n1);
    float b = dot(p, n2);
    float c = dot(p, n3);
    return (max(max(a, b), c) - size * 0.8) * 0.8;
  }

  // Icosahedron
  float sdIcosahedron(vec3 p, float size) {
    float g = PHI;
    vec3 n1 = normalize(vec3(g, 1.0, 0.0));
    vec3 n2 = normalize(vec3(1.0, 0.0, g));
    vec3 n3 = normalize(vec3(0.0, g, 1.0));
    p = abs(p);
    float d = max(max(dot(p, n1), dot(p, n2)), dot(p, n3));
    return d - size * 0.7;
  }

  // Rotation matrix
  mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  void main() {
    // Setup ray direction from sphere surface
    vec3 ro = vec3(0.0);
    vec3 rd = normalize(vPosition);

    // Initialize color
    vec3 col = vec3(0.0);

    // === INTRO PHASES ===
    // Phase 1 (0.0 - 0.15): Complete darkness, single point of light emerges
    // Phase 2 (0.15 - 1.0): Solids appear in sequence

    float introProgress = iIntroProgress;

    // Early phase - just a point of light
    if (introProgress < 0.15) {
      float pointPhase = smoothstep(0.0, 0.15, introProgress);
      float pointDist = length(rd.xy);
      float point = exp(-pointDist * 20.0) * pointPhase * 2.0;
      col = vec3(0.9, 0.92, 1.0) * point;
      gl_FragColor = vec4(col, 1.0);
      return;
    }

    // Calculate which solid to show (0-4 cycle after intro)
    float sequenceTime = introProgress < 1.0
      ? (introProgress - 0.15) / 0.17  // During intro: show each solid for ~17% of remaining time
      : iTime * 0.15;  // After intro: slow cycle

    int solidIndex = int(mod(sequenceTime, 5.0));
    float solidBlend = fract(sequenceTime); // For transitions

    // Smooth transition factor
    float fadeIn = smoothstep(0.0, 0.15, solidBlend);
    float fadeOut = smoothstep(0.85, 1.0, solidBlend);
    float solidAlpha = fadeIn * (1.0 - fadeOut);

    // During intro, don't fade out the last shown solid
    if (introProgress < 1.0) {
      solidAlpha = smoothstep(0.0, 0.3, solidBlend);
    }

    // Raymarching
    float t = 0.0;
    float minDist = 1000.0;
    vec3 hitPos = vec3(0.0);

    // Slow rotation
    float rotSpeed = introProgress < 1.0 ? iTime * 0.3 : iTime * 0.2;

    for (int i = 0; i < 80; i++) {
      vec3 p = ro + rd * t;

      // Move ray origin forward (camera at distance)
      p.z += 6.0;

      // Apply rotation
      p.xz *= rot(rotSpeed);
      p.xy *= rot(rotSpeed * 0.7);

      // Calculate distance to current solid
      float d;
      float size = 1.8;

      if (solidIndex == 0) {
        d = sdTetrahedron(p, size * 1.2);
      } else if (solidIndex == 1) {
        d = sdCube(p, size * 0.9);
      } else if (solidIndex == 2) {
        d = sdOctahedron(p, size);
      } else if (solidIndex == 3) {
        d = sdDodecahedron(p, size);
      } else {
        d = sdIcosahedron(p, size);
      }

      minDist = min(minDist, d);
      hitPos = p;

      if (d < 0.001) break;
      if (t > 20.0) break;

      t += d * 0.8;
    }

    // === COLORING ===
    // Base color varies by solid type
    vec3 solidColors[5];
    solidColors[0] = vec3(1.0, 0.4, 0.3);   // Tetrahedron - warm red/orange
    solidColors[1] = vec3(0.3, 0.8, 1.0);   // Cube - cyan
    solidColors[2] = vec3(1.0, 0.9, 0.3);   // Octahedron - gold
    solidColors[3] = vec3(0.6, 0.3, 1.0);   // Dodecahedron - purple
    solidColors[4] = vec3(0.3, 1.0, 0.5);   // Icosahedron - green

    vec3 baseColor = solidColors[solidIndex];

    // Glow based on proximity to surface
    float glow = exp(-minDist * 3.0);

    // Edge highlighting using gradient of distance
    float edge = exp(-minDist * 8.0);

    // Rainbow shimmer based on position (like reference)
    vec3 rainbow = 0.5 + 0.5 * cos(hitPos.y * 2.0 + iTime + vec3(0.0, 2.1, 4.2));

    // Combine colors
    col = baseColor * glow * 1.5;
    col += vec3(1.0) * edge * 0.8;  // White edges
    col += rainbow * glow * 0.3;     // Subtle rainbow

    // Apply solid alpha for transitions
    col *= solidAlpha;

    // Overall intro brightness
    float introBrightness = smoothstep(0.15, 0.4, introProgress);
    col *= introBrightness;

    // Add subtle ambient glow in the void
    float ambientGlow = exp(-length(rd.xy) * 2.0) * 0.05;
    col += baseColor * ambientGlow * solidAlpha;

    // Tanh tonemapping (from reference)
    col = tanh(col);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface PlatonicSolidsShaderProps {
  introProgress?: number;
}

export function PlatonicSolidsShader({ introProgress = 1 }: PlatonicSolidsShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Check if XR session is active and visible
  const visibilityState = useXRSessionVisibilityState();

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iIntroProgress: { value: introProgress },
      iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    }),
    []
  );

  useFrame(() => {
    if (materialRef.current) {
      // Only update time when visible in XR
      if (visibilityState !== 'visible-blurred') {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        materialRef.current.uniforms.iTime.value = elapsed;
      }
      materialRef.current.uniforms.iIntroProgress.value = introProgress;
    }
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
