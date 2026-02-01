import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vSphereDir;
  void main() {
    vUv = uv;
    // Pass the sphere direction (position on unit sphere = direction from center)
    vSphereDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float iSpeed;
  uniform vec2 iResolution;
  varying vec2 vUv;
  varying vec3 vSphereDir;

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime;
    float i = 0.0;
    float z = 0.0;
    float d = 0.0;
    float s = 0.0;
    vec4 O = vec4(0.0);

    // Ray direction for raymarch (screen-space)
    vec3 rd = normalize(vec3(uv * 2.0, -1.0));

    for(float iter = 0.0; iter < 50.0; iter++) {
      i = iter;

      // Compute raymarch sample point
      vec3 p = z * rd;

      // Forward motion - flying through clouds (speed controlled)
      p.z -= t * iSpeed;

      // Turbulence - unrolled for mobile GPU (6 octaves)
      p += 0.12 * sin(p.yzx * 5.0 - 0.2 * t);
      p += 0.06 * sin(p.yzx * 10.0 - 0.2 * t);
      p += 0.03 * sin(p.yzx * 20.0 - 0.2 * t);
      p += 0.015 * sin(p.yzx * 40.0 - 0.2 * t);
      p += 0.0075 * sin(p.yzx * 80.0 - 0.2 * t);
      p += 0.00375 * sin(p.yzx * 160.0 - 0.2 * t);

      // Compute distance (smaller steps in clouds when s is negative)
      s = 0.3 - abs(p.y);
      d = 0.005 + max(s, -s * 0.2) / 4.0;
      z += d;

      // Original brightness with clamping
      float brightness = max(0.0, min(8.0, 1.0 + s * 10.0 + s * s * 30.0));
      float safeD = max(0.01, d);
      O += (cos(s / 0.07 + p.x + 0.5 * t - vec4(3.0, 4.0, 5.0, 0.0)) + 1.5) * brightness / safeD;
    }

    // Tanh tonemapping with extra clamping
    O = clamp(O, 0.0, 1e9);
    O = tanh(O * O / 4e8);

    // Fog to hide seams using actual sphere position (works with VR head tracking)
    // Fade at poles (top/bottom of sphere)
    float polesFade = 1.0 - smoothstep(0.85, 0.98, abs(vSphereDir.y));
    // Fade at UV seam (try positive x - original geometry seam location)
    float seamFade = 1.0 - smoothstep(0.7, 0.95, vSphereDir.x);
    // Combine fades
    float fog = polesFade * seamFade;

    O.rgb *= fog;

    gl_FragColor = vec4(O.rgb, 1.0);
  }
`;

interface SunsetCloudsShaderProps {
  speed?: number;
}

export function SunsetCloudsShader({ speed = 0.5 }: SunsetCloudsShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iSpeed: { value: speed },
    iResolution: { value: new THREE.Vector2(1920, 1080) }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
      material.uniforms.iSpeed.value = speed;
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
