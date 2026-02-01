import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  // Quest 3 optimized version
  precision mediump float;

  uniform float iTime;
  uniform vec2 iResolution;
  varying vec2 vUv;

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime;
    float z = 0.0;
    float d = 0.0;
    float s = 0.0;
    vec4 O = vec4(0.0);

    // Precompute ray direction (moved outside loop)
    vec3 rd = normalize(vec3(uv * 2.0, -1.0));

    // Reduced iterations: 100 -> 40 for Quest 3
    for(int iter = 0; iter < 40; iter++) {
      // Raymarch sample point
      vec3 p = z * rd;

      // Reduced turbulence octaves: 6 -> 3 for Quest 3
      // Unrolled loop for better mobile GPU performance
      p += 0.6 * sin(p.yzx * 5.0 - 0.2 * t) / 5.0;
      p += 0.6 * sin(p.yzx * 10.0 - 0.2 * t) / 10.0;
      p += 0.6 * sin(p.yzx * 20.0 - 0.2 * t) / 20.0;

      // Compute distance with larger step multiplier (1.2x)
      s = 0.3 - abs(p.y);
      d = 0.006 + max(s, -s * 0.2) * 0.3;
      z += d * 1.2;

      // Coloring - simplified exp approximation
      float expVal = clamp(1.0 + s * 10.0, 0.0, 3.0);
      O += (cos(s * 14.3 + p.x + 0.5 * t - vec4(3.0, 4.0, 5.0, 0.0)) + 1.5) * expVal / d;

      // Early exit when saturated
      if(O.r > 5e7) break;
    }

    // Reinhard tonemapping (cheaper than tanh)
    O = O * O / 4e8;
    O = O / (1.0 + O);

    gl_FragColor = vec4(O.rgb, 1.0);
  }
`;

export function SunsetCloudsShader() {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(1920, 1080) }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
