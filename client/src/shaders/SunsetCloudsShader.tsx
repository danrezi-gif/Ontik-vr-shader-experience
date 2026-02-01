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
    float s = 0.0;
    vec4 O = vec4(0.0);

    vec3 rd = normalize(vec3(uv * 2.0, -1.0));

    for(float i = 0.0; i < 40.0; i += 1.0) {
      vec3 p = z * rd;

      // Simplified turbulence - 3 octaves
      p += 0.12 * sin(p.yzx * 5.0 - 0.2 * t);
      p += 0.06 * sin(p.yzx * 10.0 - 0.2 * t);
      p += 0.03 * sin(p.yzx * 20.0 - 0.2 * t);

      s = 0.3 - abs(p.y);
      d = 0.01 + max(s, -s * 0.2) * 0.25;
      z += d;

      // Simpler accumulation like Abstract Waves
      float brightness = (1.0 + s * 8.0) / (d * 100.0);
      O += (cos(s * 14.0 + p.x + 0.5 * t - vec4(3.0, 4.0, 5.0, 0.0)) + 1.5) * brightness;
    }

    // Use tanh like working shaders, with smaller constant
    O = tanh(O / 2e3);

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
