import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform float iSpeed;        // Animation speed
  uniform float iZoom;         // Camera zoom
  uniform float iBrightness;   // Overall brightness
  uniform float iColorShift;   // Color palette shift
  uniform float iPulse;        // Audio-reactive pulse (0-1)
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime * iSpeed;
    float z = 0.0;
    float d = 0.0;
    float i = 0.0;
    vec4 o = vec4(0.0);

    // Zoom affects the ray direction spread
    vec3 s = normalize(vec3(uv * (2.1 - iZoom * 0.5), -1.0));
    vec3 c = s / max(s.y, 0.001);
    vec3 p;
    vec3 v = vec3(0.0, 1.0, 0.0);

    // Pulse affects iteration intensity
    float iterMult = 1.0 + iPulse * 0.3;

    for(float iter = 0.0; iter < 30.0; iter++) {
      i = iter;
      p = s * z + v;
      p.z -= t;
      d = min(p.y + p.y, 0.0);
      p.y -= d;

      // Pulse affects the wave distortion
      float waveAmp = 0.03 + iPulse * 0.02;
      p += waveAmp * sin(length(c - 2.0) / 0.1) * d;

      float sinVal = length(sin(p + p * v.y - sin(p.zxy * 0.6 - t * 0.2)) - v);
      d = 0.01 + 0.6 * abs(sinVal - 0.1);
      z += d;

      o += (9.0 * iterMult - cos(p.y / 0.2) / (0.1 + d)) / d / z;
    }

    // Color with shift and brightness
    vec3 colorBase = vec3(9.0 + iColorShift * 3.0, 3.0 + iColorShift, 1.0);
    o = tanh(vec4(colorBase, 0.0) * o * iBrightness / 6e3);

    // Pole glow - brighten near top and bottom poles
    float poleProximity = abs(vPosition.y);
    float poleGlow = smoothstep(0.7, 1.0, poleProximity) * 0.8;
    vec3 glowColor = vec3(1.0, 0.9, 0.7); // Warm white glow
    o.rgb += glowColor * poleGlow * iBrightness;

    gl_FragColor = vec4(o.rgb, 1.0);
  }
`;

interface AbstractWavesShaderProps {
  speed?: number;
  zoom?: number;
  brightness?: number;
  colorShift?: number;
  pulse?: number;
}

export function AbstractWavesShader({
  speed = 1.0,
  zoom = 0.0,
  brightness = 1.0,
  colorShift = 0.0,
  pulse = 0.0
}: AbstractWavesShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(1920, 1080) },
    iSpeed: { value: speed },
    iZoom: { value: zoom },
    iBrightness: { value: brightness },
    iColorShift: { value: colorShift },
    iPulse: { value: pulse }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
      material.uniforms.iSpeed.value = speed;
      material.uniforms.iZoom.value = zoom;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iColorShift.value = colorShift;
      material.uniforms.iPulse.value = pulse;
    }
  });

  // Tilt sphere forward so top pole is visible in upper third of view
  // 35 degrees = ~0.61 radians
  const tiltAngle = 35 * (Math.PI / 180);

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]} rotation={[tiltAngle, 0, 0]}>
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
