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

  // Uniforms with default values baked in
  const float uAnimationSpeed = 0.5;
  const float uBokehSize = 0.5;
  const float uBokehIntensity = 1.2;
  const float uWhiteIntensity = 1.5;
  const float uBlurStrength = 0.002;
  const int uBokehCount = 100;
  const vec3 uMagentaColor = vec3(0.9, 0.2, 0.6);
  const vec3 uCyanColor = vec3(0.2, 0.8, 0.9);
  const vec3 uWhiteColor = vec3(1.0, 0.95, 0.9);

  // Pseudo-random functions
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  vec2 random2(vec2 st) {
    return vec2(
      fract(sin(dot(st, vec2(127.1, 311.7))) * 43758.5453),
      fract(sin(dot(st, vec2(269.5, 183.3))) * 43758.5453)
    ) * 2.0 - 1.0;
  }

  // Bokeh effect
  float complexBokeh(vec2 center, vec2 uv, float radius, float softness) {
    float dist = distance(uv, center);
    float bokeh = exp(-dist * dist / (radius * radius * softness));
    return bokeh;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    uv.x *= iResolution.x / iResolution.y;

    float time = iTime * uAnimationSpeed;

    // Dark background
    vec3 background = vec3(0.02, 0.01, 0.03);
    vec3 finalColor = background;

    // Main magenta bokeh lights (left side)
    vec2 magentaCenter1 = vec2(-0.3 + sin(time * 0.5) * 0.1, 0.2 + cos(time * 0.3) * 0.15);
    vec2 magentaCenter2 = vec2(-0.5 + sin(time * 0.7) * 0.08, -0.1 + cos(time * 0.4) * 0.12);
    vec2 magentaCenter3 = vec2(-0.2 + sin(time * 0.9) * 0.06, -0.3 + cos(time * 0.6) * 0.1);

    float magenta1 = complexBokeh(magentaCenter1, uv, uBokehSize * 0.4, 2.0) * uBokehIntensity;
    float magenta2 = complexBokeh(magentaCenter2, uv, uBokehSize * 0.6, 1.5) * uBokehIntensity;
    float magenta3 = complexBokeh(magentaCenter3, uv, uBokehSize * 0.3, 2.5) * uBokehIntensity;

    finalColor += uMagentaColor * (magenta1 + magenta2 * 0.8 + magenta3 * 0.6);

    // Main cyan bokeh lights (right side)
    vec2 cyanCenter1 = vec2(0.4 + sin(time * -0.6) * 0.12, 0.1 + cos(time * 0.8) * 0.1);
    vec2 cyanCenter2 = vec2(0.6 + sin(time * -0.4) * 0.09, -0.2 + cos(time * -0.5) * 0.13);
    vec2 cyanCenter3 = vec2(0.3 + sin(time * -0.8) * 0.07, 0.3 + cos(time * -0.7) * 0.11);

    float cyan1 = complexBokeh(cyanCenter1, uv, uBokehSize * 0.5, 1.8) * uBokehIntensity;
    float cyan2 = complexBokeh(cyanCenter2, uv, uBokehSize * 0.7, 1.3) * uBokehIntensity;
    float cyan3 = complexBokeh(cyanCenter3, uv, uBokehSize * 0.35, 2.2) * uBokehIntensity;

    finalColor += uCyanColor * (cyan1 + cyan2 * 0.9 + cyan3 * 0.7);

    // Central white glow
    vec2 whiteCenter = vec2(0.1 + sin(time * 0.2) * 0.05, 0.0 + cos(time * 0.15) * 0.08);
    float whiteBokeh = complexBokeh(whiteCenter, uv, uBokehSize * 0.8, 1.0) * uWhiteIntensity;
    finalColor += uWhiteColor * whiteBokeh;

    // Many small bokeh particles
    for(int i = 0; i < 100; i++) {
      if(i >= uBokehCount) break;

      float fi = float(i);
      vec2 seed = vec2(fi * 0.1, fi * 0.05);
      vec2 randomPos = random2(seed);

      float timeOffset = fi * 0.1;
      float angle = random(seed) * 6.28318 + time * 0.1;
      float radius = 0.1 + random(seed + vec2(1.0, 0.0)) * 0.8;

      vec2 movement = vec2(cos(angle + timeOffset), sin(angle + timeOffset)) * 0.1;
      vec2 bokehPos = randomPos * vec2(1.5, 1.0) + movement;

      float bokehRadius = uBokehSize * (0.05 + random(seed + vec2(0.0, 1.0)) * 0.3);
      float bokehStrength = 0.2 + random(seed + vec2(1.0, 1.0)) * 0.6;

      float bokeh = complexBokeh(bokehPos, uv, bokehRadius, 2.0 + random(seed) * 2.0);

      float colorMix = (bokehPos.x + 1.0) * 0.5;
      vec3 bokehColor = mix(uMagentaColor, uCyanColor, colorMix);

      if(random(seed + vec2(2.0, 2.0)) > 0.7) {
        bokehColor = mix(bokehColor, uWhiteColor, 0.5);
      }

      finalColor += bokehColor * bokeh * bokehStrength * uBokehIntensity * 0.3;
    }

    // Center glow spread
    float centerGlow = 1.0 - length(uv - whiteCenter) * 0.8;
    centerGlow = smoothstep(0.0, 1.0, centerGlow);
    finalColor += uWhiteColor * centerGlow * 0.1;

    // Color mixing zone
    float mixZone = smoothstep(-0.2, 0.2, uv.x);
    vec3 colorMix = mix(uMagentaColor, uCyanColor, mixZone) * 0.05;
    finalColor += colorMix;

    finalColor = clamp(finalColor, 0.0, 1.0);
    finalColor = pow(finalColor, vec3(0.9));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export function BokehLightsShader() {
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
