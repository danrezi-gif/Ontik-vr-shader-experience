import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// TRANSCENDENT DOMAIN - Infinite falling through a crimson void
// Infinite glowing red walls on left and right, blackness ahead, flowing downward

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float iSpeed;
  uniform float iBrightness;
  uniform float iColorShift;
  uniform float iIntroProgress;
  uniform float iAcceleration;
  uniform float iElapsedTime;

  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Hash function for randomness
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float hash3(vec3 p) {
    p = fract(p * vec3(443.897, 397.297, 491.187));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    vec3 col = vec3(0.0);

    // Calculate speed with acceleration over time
    float currentSpeed = iSpeed * (1.0 + iAcceleration * iElapsedTime * 0.1);
    currentSpeed = min(currentSpeed, 5.0);

    // Forward motion (falling down = walls moving up)
    float forwardMotion = iTime * currentSpeed * 3.0;

    // Wall parameters
    float wallDistance = 8.0;     // How far left/right the walls are
    float wallSpacing = 4.0;      // Vertical spacing between wall segments
    float wallHeight = 3.5;       // Height of each wall segment
    float maxDist = 120.0;        // How far to raymarch

    // Raymarch through the scene
    float t = 0.5;

    for(int i = 0; i < 64; i++) {
      vec3 p = rd * t;

      // Apply falling motion (walls move up as we fall)
      p.y += forwardMotion;

      // Check distance to left and right wall planes
      float leftWallDist = abs(p.x + wallDistance);
      float rightWallDist = abs(p.x - wallDistance);

      // Which wall are we closer to?
      float wallDist = min(leftWallDist, rightWallDist);
      float isLeftWall = step(leftWallDist, rightWallDist);

      // Calculate wall cell (vertical segments)
      float wallY = floor(p.y / wallSpacing);
      float localY = mod(p.y, wallSpacing) - wallSpacing * 0.5;

      // Wall segment bounds
      float inWallY = smoothstep(wallHeight * 0.5, wallHeight * 0.5 - 0.3, abs(localY));

      // Close enough to wall plane?
      float wallProximity = smoothstep(1.5, 0.0, wallDist);

      // Combined wall hit
      float wallHit = wallProximity * inWallY;

      if (wallHit > 0.01) {
        // Wall cell ID for variation
        vec2 cellId = vec2(isLeftWall, wallY);
        float h = hash(cellId);
        float h2 = hash(cellId + vec2(100.0, 0.0));

        // Crimson color palette
        vec3 deepCrimson = vec3(0.55, 0.0, 0.1);
        vec3 brightCrimson = vec3(0.86, 0.08, 0.24);
        vec3 hotCrimson = vec3(1.0, 0.2, 0.15);

        // Palette evolution over time
        float paletteEvolution = min(1.0, iElapsedTime * 0.015);

        // Base wall color varies by cell
        vec3 wallColor = mix(deepCrimson, brightCrimson, h * 0.5 + 0.3);
        wallColor = mix(wallColor, hotCrimson, paletteEvolution * 0.4);

        // Glow intensity - brighter at center of wall segment
        float glowPattern = 1.0 - abs(localY) / (wallHeight * 0.5);
        glowPattern = pow(glowPattern, 0.6);

        // Pulsing glow
        float pulsePhase = h2 * 6.28 + iTime * (1.0 + currentSpeed * 0.3);
        float pulse = 0.7 + 0.3 * sin(pulsePhase);

        // Edge glow (brighter at wall edges)
        float edgeGlow = smoothstep(0.3, 0.0, wallDist) * 2.0;

        // Combine glow
        float totalGlow = glowPattern * pulse + edgeGlow * 0.5;

        // Apply glow to color
        vec3 glowColor = mix(wallColor, hotCrimson, totalGlow * 0.5);
        glowColor *= (1.0 + totalGlow * 0.8);

        // Distance falloff
        float distFade = 1.0 / (1.0 + t * 0.015);

        // Accumulate color
        col += glowColor * wallHit * distFade * 0.4;
      }

      // Step forward
      t += max(wallDist * 0.3, 0.4);
      if (t > maxDist) break;
    }

    // Add subtle ambient glow in wall directions
    float sideGlow = smoothstep(0.3, 0.8, abs(rd.x));
    vec3 ambientCrimson = vec3(0.3, 0.02, 0.05);
    col += ambientCrimson * sideGlow * 0.3;

    // Apply intro progress and brightness
    col *= iBrightness * iIntroProgress;

    // Tone mapping
    col = col / (col + vec3(0.7));
    col = pow(col, vec3(0.9));

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface TranscendentDomainShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  headRotationY?: number;
  introProgress?: number;
  audioTime?: number;
}

export function TranscendentDomainShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0
}: TranscendentDomainShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number | null>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iSpeed: { value: speed },
    iBrightness: { value: brightness },
    iColorShift: { value: colorShift },
    iIntroProgress: { value: introProgress },
    iAcceleration: { value: 0.15 }, // Rate of acceleration
    iElapsedTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
      material.uniforms.iSpeed.value = speed;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iColorShift.value = colorShift;
      material.uniforms.iIntroProgress.value = introProgress;

      // Track elapsed time since intro started
      if (introProgress > 0 && startTimeRef.current === null) {
        startTimeRef.current = state.clock.elapsedTime;
      }
      if (startTimeRef.current !== null) {
        material.uniforms.iElapsedTime.value = state.clock.elapsedTime - startTimeRef.current;
      }
    }
  });

  // Sphere for raymarching - user is inside looking at infinite walls
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
