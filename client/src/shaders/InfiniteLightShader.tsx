import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float iBrightness;
  uniform float iIntroProgress;
  uniform float iColorShift;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  // Soft sphere SDF
  float sphereSDF(vec3 p, float r) {
    return length(p) - r;
  }

  // Infinite grid repetition
  vec3 infiniteRepeat(vec3 p, vec3 spacing) {
    return mod(p + spacing * 0.5, spacing) - spacing * 0.5;
  }

  void main() {
    // Ray from camera through this fragment
    vec3 ro = vec3(0.0); // ray origin at center
    vec3 rd = normalize(vWorldPosition); // ray direction toward sphere surface

    // Background - deep void
    vec3 col = vec3(0.0);

    // Calculate how many reflections based on intro progress
    // Start with 1, grow to many
    float maxReflections = 1.0 + iIntroProgress * 60.0;

    // Grid spacing - starts large (single light), shrinks (infinite lights)
    float baseSpacing = 20.0;
    float spacingMult = mix(100.0, 1.0, smoothstep(0.0, 0.8, iIntroProgress));
    vec3 spacing = vec3(baseSpacing * spacingMult);

    // Light properties
    float lightRadius = 0.3 + 0.1 * sin(iTime * 0.5); // gentle breathing
    vec3 warmLight = vec3(1.0, 0.85, 0.6); // warm golden
    vec3 coolLight = vec3(0.7, 0.85, 1.0); // cool accent

    // Color shift between warm and cool
    vec3 lightColor = mix(warmLight, coolLight, 0.5 + 0.5 * sin(iColorShift));

    // Raymarching
    float t = 0.0;
    float totalLight = 0.0;

    for(int i = 0; i < 80; i++) {
      vec3 p = ro + rd * t;

      // Apply infinite repetition
      vec3 q = infiniteRepeat(p, spacing);

      // Distance to nearest light sphere
      float d = sphereSDF(q, lightRadius);

      // Accumulate glow (softer than hard intersection)
      float glow = lightRadius / (d + 0.1);
      glow *= glow; // sharper falloff

      // Fade distant lights
      float distanceFade = 1.0 / (1.0 + t * 0.02);

      // Only show lights up to our current reflection count
      float gridIndex = floor(length(p) / spacing.x);
      float showLight = step(gridIndex, maxReflections / 10.0);

      totalLight += glow * distanceFade * showLight * 0.015;

      // March forward
      t += max(d * 0.5, 0.1);

      // Stop if too far
      if(t > 100.0) break;
    }

    // Apply light color
    col += lightColor * totalLight * iBrightness;

    // Add subtle ambient so it's not pure black
    float ambient = 0.02 * iIntroProgress;
    col += vec3(ambient * 0.5, ambient * 0.4, ambient * 0.6);

    // Central light source (always visible, grows brighter)
    vec3 centerDir = normalize(vec3(0.0, 0.0, -1.0)); // forward
    float centerDot = max(dot(rd, centerDir), 0.0);
    float centralGlow = pow(centerDot, 20.0) * (0.5 + iIntroProgress * 0.5);
    col += lightColor * centralGlow * iBrightness;

    // Vignette - darker at edges
    float vignette = 1.0 - length(vUv - 0.5) * 0.5;
    col *= vignette;

    // Tone mapping
    col = col / (col + vec3(1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface InfiniteLightShaderProps {
  speed?: number;
  zoom?: number;
  brightness?: number;
  colorShift?: number;
  pulse?: number;
  headRotationY?: number;
  introProgress?: number;
}

export function InfiniteLightShader({
  speed = 1.0,
  zoom = 0.0,
  brightness = 1.0,
  colorShift = 0.0,
  pulse = 0.0,
  headRotationY = 0,
  introProgress = 0
}: InfiniteLightShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iBrightness: { value: brightness },
    iIntroProgress: { value: introProgress },
    iColorShift: { value: colorShift }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime * speed;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iIntroProgress.value = introProgress;
      material.uniforms.iColorShift.value = colorShift;
    }
  });

  // Tilt sphere slightly forward and align to head rotation
  const tiltAngle = 15 * (Math.PI / 180);

  return (
    <mesh
      ref={meshRef}
      scale={[-1, 1, 1]}
      rotation={[tiltAngle, -headRotationY, 0]}
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
