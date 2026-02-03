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

// Faithful execution of the reference shader
// Object grows from distant to enormous, absorbing the user
const fragmentShader = `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float iTime;
  uniform float iIntroProgress;

  void main() {
    // Output color accumulator
    vec4 o = vec4(0.0);

    // Camera depth
    float z = 5.0;
    // Raymarch step distance
    float d;

    // Center and scale UVs (reference: f = (f - .5*res)/res.y/.1)
    vec2 f = vPosition.xy * 10.0;

    // 3D sample point
    vec3 p;

    // === SCALE: grows from small to ENORMOUS ===
    // During intro: starts tiny, becomes massive
    // Uses cubic easing for dramatic acceleration at end
    float scaleProgress = iIntroProgress * iIntroProgress * iIntroProgress;
    float scale = mix(0.08, 80.0, scaleProgress); // 0.08 -> 80x (1000x size increase)

    // Rotation speed
    float rotTime = iTime * 0.4;

    // Raymarch loop (100 steps) - faithful to reference
    for (int i = 0; i < 100; i++) {
      // Sample point at current depth
      p = vec3(f, z);

      // Rotation about Y-axis (reference: p.xz *= mat2(cos(iTime+vec4(0,33,11,0))))
      float c1 = cos(rotTime);
      float s1 = sin(rotTime);
      float c2 = cos(rotTime + 33.0);
      float s2 = sin(rotTime + 11.0);
      p.xz = mat2(c1, s2, s1, c2) * p.xz;

      // Apply scale - divide position to make object appear larger
      vec3 scaledP = p / scale;

      // Octahedron SDF (reference: max(abs(p.x)+abs(p.y),abs(p.z))-3.5)/1.732
      float sdf = (max(abs(scaledP.x) + abs(scaledP.y), abs(scaledP.z)) - 3.5) / 1.732;

      // Step distance (reference: d = .1+.2*abs(sdf))
      d = 0.1 + 0.2 * abs(sdf * scale);

      // Accumulate color (reference: o += (sin(p.y+z+vec4(0,1,2,3))+1.)/d)
      o += (sin(p.y + z + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;

      // Advance depth
      z -= d;

      // Early exit
      if (z < -100.0) break;
    }

    // Tanh tonemapping (reference: o=tanh(o*o/1e5))
    o = tanh(o * o / 1e5);

    // Intro fade
    float fade = smoothstep(0.0, 0.1, iIntroProgress);
    o *= fade;

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

  const visibilityState = useXRSessionVisibilityState();

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iIntroProgress: { value: introProgress },
    }),
    []
  );

  useFrame(() => {
    if (materialRef.current) {
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
