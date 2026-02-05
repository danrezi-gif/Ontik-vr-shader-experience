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

// Palette shader - adapted from user's reference
// Creates a radial color burst effect centered in view
const fragmentShader = `
  precision highp float;

  #define PI 3.14159265359

  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float iTime;
  uniform vec2 iResolution;
  uniform float iIntroProgress;
  uniform float iBrightness;
  uniform float iSpeed;

  vec3 palette(in float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.2, 0.4, 0.5);
    return a + b * cos(2.0 * PI * (c * t + d));
  }

  void main() {
    // Use position for spherical coordinates - makes it immersive inside sphere
    vec2 uv = vPosition.xy * 2.0;

    // Adjust for aspect ratio
    uv.x *= iResolution.x / iResolution.y;

    // Time with speed control
    float time = iTime * iSpeed;

    float angle = atan(-uv.y, -uv.x) / (2.0 * PI);
    float dist = length(uv) * 1.5;

    // Simulated audio level - use time-based pulsing instead
    float level = 0.3 + 0.2 * sin(time * 2.0) + 0.1 * sin(time * 3.7);

    angle = abs(2.0 * (1.0 - angle));

    if (dist < 1.0) {
      dist = pow(dist, (1.0 - 0.95 * level) * 20.0);
    } else {
      float falloff = 1.01;
      dist = pow(pow(2.0, 100.0), 1.0 - dist);
    }

    vec3 result = (1.0 + 5.0 * level) * dist * palette(-time / 2.0 + angle);
    vec4 color = tanh(vec4(result, 1.0));

    // Apply brightness and intro fade
    float fade = smoothstep(0.0, 0.2, iIntroProgress);
    color.rgb *= iBrightness * fade;

    gl_FragColor = vec4(color.rgb, 1.0);
  }
`;

interface TunnelLightsShaderProps {
  speed?: number;
  zoom?: number;
  brightness?: number;
  colorShift?: number;
  pulse?: number;
  headRotationY?: number;
  introProgress?: number;
}

export function TunnelLightsShader({
  speed = 1.0,
  zoom = 0.0,
  brightness = 1.0,
  colorShift = 0.0,
  pulse = 0.0,
  headRotationY = 0,
  introProgress = 1
}: TunnelLightsShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const startTimeRef = useRef<number>(Date.now());

  const visibilityState = useXRSessionVisibilityState();

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(1920, 1080) },
    iIntroProgress: { value: introProgress },
    iBrightness: { value: brightness },
    iSpeed: { value: speed }
  }), []);

  useFrame(() => {
    if (materialRef.current) {
      if (visibilityState !== 'visible-blurred') {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        materialRef.current.uniforms.iTime.value = elapsed;
      }
      materialRef.current.uniforms.iIntroProgress.value = introProgress;
      materialRef.current.uniforms.iBrightness.value = brightness;
      materialRef.current.uniforms.iSpeed.value = speed;
    }
  });

  // Large sphere surrounding the user - they're inside looking at the effect
  return (
    <mesh ref={meshRef} rotation={[0, -headRotationY, 0]} scale={[-1, 1, 1]}>
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
