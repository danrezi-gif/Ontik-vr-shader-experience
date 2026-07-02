import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// PRISMATIC BLOOM — the journey's threshold
// A living kaleidoscopic mandala breathing around the viewer: concentric
// petals of light flowing inward toward a radiant core, hue slowly cycling
// through the spectrum. Onset of the psychedelic arc — geometry begins to
// bloom out of darkness.
//
// Performance: no raymarch loop — pure angular math on the view direction,
// so it runs comfortably on Quest.

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

  // Cosine palette — smooth spectral cycling
  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(2.0 * PI * (t + vec3(0.0, 0.33, 0.67)));
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    float time = iTime * iSpeed * 0.4;

    // Angular coordinates around the forward axis (-Z)
    // r: 0 at the core ahead, PI directly behind
    float r = acos(clamp(-rd.z, -1.0, 1.0));
    float theta = atan(rd.y, rd.x);

    // Slow rotation of the whole mandala
    theta += time * 0.1 + sin(time * 0.05) * 0.6;

    // Kaleidoscope fold — 12 mirrored segments
    float segments = 12.0;
    float segAngle = 2.0 * PI / segments;
    float th = abs(mod(theta, segAngle) - segAngle * 0.5);

    // Breathing: the mandala slowly inhales and exhales
    float breath = 1.0 + 0.18 * sin(time * 0.35);

    // Concentric petal rings flowing inward toward the core
    float rings   = sin(r * 14.0 * breath - time * 1.6);
    float petals  = sin(th * segments * 2.0 + r * 6.0 - time * 0.7);
    float weave   = sin((r * 9.0 + th * 5.0) * breath + time * 0.9);

    // Interference of the three wave systems
    float pattern = rings * 0.5 + petals * 0.35 + weave * 0.3;
    pattern = pattern * 0.5 + 0.5;

    // Sharpen into luminous filaments
    float filaments = pow(pattern, 3.0);
    float lace = smoothstep(0.42, 0.58, pattern) * 0.6;

    // Radiant core ahead, gentle echo mandala behind
    float core = exp(-r * r * 6.0) * (0.8 + 0.2 * sin(time * 2.0));
    float depthFade = mix(1.0, 0.35, smoothstep(1.2, PI, r));

    // Spectral color: hue advances with radius, time and user color shift
    float hue = r * 0.35 - time * 0.05 + iColorShift * 0.33;
    vec3 col = palette(hue) * (filaments + lace);
    col += palette(hue + 0.15) * core * 1.6;

    // Faint violet ambient so black areas keep depth
    col += vec3(0.05, 0.02, 0.09) * (1.0 - core);

    col *= depthFade;
    col *= iBrightness * iIntroProgress;

    // Reinhard tonemap + slight saturation lift
    col = col / (1.0 + col);
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.2);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface PrismaticBloomShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  zoom?: number;
  pulse?: number;
  headRotationY?: number;
  introProgress?: number;
}

export function PrismaticBloomShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 1.0,
}: PrismaticBloomShaderProps) {
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
