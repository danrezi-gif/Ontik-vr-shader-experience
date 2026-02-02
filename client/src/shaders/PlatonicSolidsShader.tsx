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

// Rewritten to match the reference shader's accumulation-based raymarching style
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
  // Returns distance normalized by size factor for consistent glow

  // Tetrahedron (4 faces)
  float sdTetrahedron(vec3 p) {
    float k = sqrt(2.0);
    p.xz = abs(p.xz);
    float m = 2.0 * p.z - k * p.y - 1.0;
    p = (m > 0.0) ? p : vec3(p.z, p.y, p.x);
    m = 2.0 * p.z - k * p.y - 1.0;
    p = (m > 0.0) ? p : vec3(p.z, p.y, p.x);
    p.xz -= clamp(p.xz, 0.0, 1.0);
    return length(p) * sign(p.y);
  }

  // Octahedron (8 faces) - from reference shader style
  float sdOctahedron(vec3 p) {
    return (abs(p.x) + abs(p.y) + abs(p.z) - 3.5) / 1.732;
  }

  // Cube/Hexahedron (6 faces)
  float sdCube(vec3 p) {
    vec3 d = abs(p) - vec3(2.5);
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
  }

  // Dodecahedron (12 faces)
  float sdDodecahedron(vec3 p) {
    vec3 n1 = normalize(vec3(PHI, 1.0, 0.0));
    vec3 n2 = normalize(vec3(1.0, PHI, 0.0));
    vec3 n3 = normalize(vec3(0.0, 1.0, PHI));
    p = abs(p);
    return max(max(dot(p, n1), dot(p, n2)), dot(p, n3)) - 2.8;
  }

  // Icosahedron (20 faces)
  float sdIcosahedron(vec3 p) {
    vec3 n1 = normalize(vec3(PHI, 1.0, 0.0));
    vec3 n2 = normalize(vec3(1.0, 0.0, PHI));
    vec3 n3 = normalize(vec3(0.0, PHI, 1.0));
    p = abs(p);
    return max(max(dot(p, n1), dot(p, n2)), dot(p, n3)) - 2.5;
  }

  void main() {
    // Setup ray from sphere position (like reference: f = (f - .5*res)/res.y/.1)
    vec2 f = vPosition.xy * 10.0;

    // Camera depth (z) and raymarch distance (d)
    float z = 5.0;
    float d;

    // 3D sample point
    vec3 p;

    // Output color accumulator (vec4 for the sin trick)
    vec4 o = vec4(0.0);

    // === INTRO PHASES ===
    float introProgress = iIntroProgress;

    // Early phase - just a point of light emerging
    if (introProgress < 0.15) {
      float pointPhase = smoothstep(0.0, 0.15, introProgress);
      float pointDist = length(vPosition.xy);
      float point = exp(-pointDist * 0.5) * pointPhase * 2.0;
      gl_FragColor = vec4(vec3(0.9, 0.92, 1.0) * point, 1.0);
      return;
    }

    // Calculate which solid to show (0-4)
    float sequenceTime = introProgress < 1.0
      ? (introProgress - 0.15) / 0.17
      : iTime * 0.12;

    int solidIndex = int(mod(sequenceTime, 5.0));
    float solidBlend = fract(sequenceTime);

    // Fade factor for transitions
    float fadeIn = smoothstep(0.0, 0.2, solidBlend);
    float fadeOut = 1.0 - smoothstep(0.8, 1.0, solidBlend);
    float solidAlpha = introProgress < 1.0 ? fadeIn : fadeIn * fadeOut;

    // Color offset per solid (creates different hues)
    float colorOffset = float(solidIndex) * 1.2;

    // Rotation speed
    float rotTime = iTime * 0.5;

    // === RAYMARCH LOOP (reference style: accumulate color) ===
    for (int i = 0; i < 100; i++) {
      // Sample point at current depth
      p = vec3(f, z);

      // Rotation about Y-axis (reference style: mat2 with cos vec4 trick)
      float c = cos(rotTime);
      float s = sin(rotTime);
      p.xz = mat2(c, -s, s, c) * p.xz;

      // Secondary rotation for more interest
      c = cos(rotTime * 0.7);
      s = sin(rotTime * 0.7);
      p.xy = mat2(c, -s, s, c) * p.xy;

      // Get distance to current solid
      if (solidIndex == 0) {
        d = 0.1 + 0.2 * abs(sdTetrahedron(p / 2.5) * 2.5);
      } else if (solidIndex == 1) {
        d = 0.1 + 0.2 * abs(sdCube(p));
      } else if (solidIndex == 2) {
        // Octahedron - closest to reference shader
        d = 0.1 + 0.2 * abs(sdOctahedron(p));
      } else if (solidIndex == 3) {
        d = 0.1 + 0.2 * abs(sdDodecahedron(p));
      } else {
        d = 0.1 + 0.2 * abs(sdIcosahedron(p));
      }

      // Accumulate color (reference style: sin wave + attenuation by distance)
      // The vec4(0,1,2,3) creates RGB phase offset for rainbow effect
      o += (sin(p.y + z + colorOffset + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;

      // Advance depth
      z -= d;

      // Early exit if too far
      if (z < -10.0) break;
    }

    // Tanh tonemapping (reference style: tanh(o*o/1e5))
    o = tanh(o * o / 1e5);

    // Apply transition alpha
    o *= solidAlpha;

    // Intro brightness fade
    float introBrightness = smoothstep(0.15, 0.5, introProgress);
    o *= introBrightness;

    gl_FragColor = vec4(o.rgb, 1.0);
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
