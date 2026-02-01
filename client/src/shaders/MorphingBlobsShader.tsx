import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  uniform float iTime;
  uniform vec2 iResolution;
  varying vec2 vUv;

  float sdfSphere(vec3 p, float s) {
    return length(p) - s;
  }

  mat2 rotate(float r) {
    return mat2(cos(r), -sin(r), sin(r), cos(r));
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= iResolution.x / iResolution.y;

    vec3 col = vec3(0.0);
    vec3 ro = vec3(0.0, 0.0, 1.25);
    vec3 rd = normalize(vec3(uv, -1.0));

    float d = 0.0;
    for (int i = 0; i < 80; ++i) {
      vec3 p = ro + d * rd;

      vec3 s1 = p + vec3(0.2, 0.2, 0.0);
      vec3 s2 = p - vec3(0.2, 0.2, 0.0);

      for (int k = 1; k < 6; ++k) {
        float kf = float(k);
        s1 += sin(s2.yyx * 3.0 * kf + iTime) * 0.08;
        s2 += sin(s1.yxy * 3.0 * kf + iTime) * 0.08;

        s1.xz *= rotate(iTime * 0.1);
        s1.xy *= rotate(iTime * 0.075);

        s2.xz *= rotate(iTime * 0.05);
        s2.xy *= rotate(iTime * 0.02);
      }

      float ds1 = sdfSphere(s1, 0.6);
      float ds2 = sdfSphere(s2, 0.6);

      float dt = abs(min(ds1, ds2)) * 0.2 + 0.005;
      d += dt;

      col += (cos(vec3(1.0, 2.0, 3.0) + p * 8.0) + 1.0) / dt;
    }
    col = tanh(col * 1e-4);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function MorphingBlobsShader() {
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
