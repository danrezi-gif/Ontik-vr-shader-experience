import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// SOLAR RETURN — the journey's comedown
// After dissolution: an endless dawn. Deep indigo overhead melts through rose
// into molten gold at the horizon, where a slow sun breathes. Golden motes
// drift upward like the last embers of the experience. Integration, warmth,
// return to the body.
//
// Performance: gradient + 2-octave value noise + hash motes; no raymarching.

const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float iSpeed;
  uniform float iBrightness;
  uniform float iColorShift;
  uniform float iIntroProgress;

  varying vec3 vWorldPosition;

  #define PI 3.14159265359

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    float time = iTime * iSpeed * 0.25;

    // ── Sky gradient: indigo zenith → rose band → molten gold horizon
    float h = rd.y; // -1 below, +1 above
    vec3 zenith  = vec3(0.06, 0.05, 0.20);
    vec3 rose    = vec3(0.55, 0.18, 0.30);
    vec3 gold    = vec3(1.00, 0.62, 0.22);
    vec3 ground  = vec3(0.18, 0.08, 0.16);

    vec3 sky = mix(rose, zenith, smoothstep(0.05, 0.7, h));
    sky = mix(gold, sky, smoothstep(-0.02, 0.25, h));
    sky = mix(ground, sky, smoothstep(-0.35, -0.02, h));

    // Slow hue drift so the dawn keeps evolving (+ user color shift)
    float drift = sin(time * 0.15 + iColorShift * 2.0) * 0.5 + 0.5;
    sky = mix(sky, sky.gbr, drift * 0.12);

    // ── Breathing sun on the horizon ahead
    vec3 sunDir = normalize(vec3(sin(time * 0.02) * 0.15, 0.10 + 0.03 * sin(time * 0.3), -1.0));
    float sunDot = max(dot(rd, sunDir), 0.0);
    float sunCore = pow(sunDot, 900.0) * 2.5;
    float sunGlow = pow(sunDot, 18.0) * 0.9 + pow(sunDot, 4.0) * 0.35;
    float sunBreath = 0.85 + 0.15 * sin(time * 0.5);
    vec3 sunColor = vec3(1.0, 0.75, 0.45);
    vec3 col = sky + sunColor * (sunCore + sunGlow) * sunBreath;

    // ── Soft slow clouds in the rose band
    vec2 cloudUv = vec2(atan(rd.x, -rd.z) * 2.0, rd.y * 5.0);
    float clouds = noise2(cloudUv * 1.5 + vec2(time * 0.4, 0.0));
    clouds += 0.5 * noise2(cloudUv * 3.0 - vec2(time * 0.25, time * 0.05));
    clouds *= smoothstep(0.6, 0.12, abs(rd.y - 0.12)); // hug the horizon band
    col += vec3(1.0, 0.5, 0.35) * clouds * 0.14;

    // ── Golden motes drifting upward (embers of the journey)
    vec2 moteUv = vec2(atan(rd.y, rd.x) * 4.0, acos(clamp(-rd.z, -1.0, 1.0)) * 4.0);
    vec2 cell = floor(moteUv * 6.0 + vec2(0.0, -time * 0.8));
    vec2 cellF = fract(moteUv * 6.0 + vec2(0.0, -time * 0.8)) - 0.5;
    float seed = hash21(cell);
    vec2 offset = vec2(seed - 0.5, fract(seed * 7.13) - 0.5) * 0.6;
    float mote = exp(-dot(cellF - offset, cellF - offset) * 90.0);
    float twinkle = 0.5 + 0.5 * sin(time * 3.0 + seed * 40.0);
    col += vec3(1.0, 0.8, 0.4) * mote * twinkle * step(0.55, seed) * 0.5;

    col *= iBrightness * iIntroProgress;

    // Reinhard tonemap, gentle warmth
    col = col / (1.0 + col);
    col.r = pow(col.r, 0.95);
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.1);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface SolarReturnShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  zoom?: number;
  pulse?: number;
  headRotationY?: number;
  introProgress?: number;
}

export function SolarReturnShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 1.0,
}: SolarReturnShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iSpeed: { value: speed },
    iBrightness: { value: brightness },
    iColorShift: { value: colorShift },
    iIntroProgress: { value: introProgress },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
      material.uniforms.iSpeed.value = speed;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iColorShift.value = colorShift;
      material.uniforms.iIntroProgress.value = introProgress;
    }
  });

  return (
    <mesh
      ref={meshRef}
      scale={[-1, 1, 1]}
      rotation={[0, -headRotationY, 0]}
    >
      <sphereGeometry args={[50, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
