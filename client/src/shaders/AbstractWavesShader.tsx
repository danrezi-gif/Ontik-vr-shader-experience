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
    float z = 0.0;
    float d = 0.0;
    float i = 0.0;
    vec4 o = vec4(0.0);

    vec3 s = normalize(vec3(uv * 2.1, -1.0));
    vec3 c = s / max(s.y, 0.001);
    vec3 p;
    vec3 v = vec3(0.0, 1.0, 0.0);

    for(float iter = 0.0; iter < 30.0; iter++) {
      i = iter;
      p = s * z + v;
      p.z -= t;
      d = min(p.y + p.y, 0.0);
      p.y -= d;
      p += 0.03 * sin(length(c - 2.0) / 0.1) * d;

      float sinVal = length(sin(p + p * v.y - sin(p.zxy * 0.6 - t * 0.2)) - v);
      d = 0.01 + 0.6 * abs(sinVal - 0.1);
      z += d;

      o += (9.0 - cos(p.y / 0.2) / (0.1 + d)) / d / z;
    }

    o = tanh(vec4(9.0, 3.0, 1.0, 0.0) * o / 6e3);

    gl_FragColor = vec4(o.rgb, 1.0);
  }
`;

export function AbstractWavesShader() {
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
