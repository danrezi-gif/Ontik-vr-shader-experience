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
  uniform float iTime;
  uniform vec2 iResolution;
  varying vec2 vUv;

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime;
    float i = 0.0;
    float z = 0.0;
    float d = 0.0;
    float s = 0.0;
    vec4 O = vec4(0.0);

    for(float iter = 0.0; iter < 50.0; iter++) {
      i = iter;

      // Compute raymarch sample point
      vec3 p = z * normalize(vec3(uv * 2.0, -1.0));

      // Turbulence loop
      for(float td = 5.0; td < 200.0; td *= 2.0) {
        p += 0.6 * sin(p.yzx * td - 0.2 * t) / td;
      }

      // Compute distance (smaller steps in clouds when s is negative)
      s = 0.3 - abs(p.y);
      d = 0.005 + max(s, -s * 0.2) / 4.0;
      z += d;

      // Coloring with sine wave using cloud depth and x-coordinate
      O += (cos(s / 0.07 + p.x + 0.5 * t - vec4(3.0, 4.0, 5.0, 0.0)) + 1.5) * exp(s / 0.1) / d;
    }

    // Tanh tonemapping
    O = tanh(O * O / 4e8);

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
