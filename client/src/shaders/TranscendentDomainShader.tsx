import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// TRANSCENDENT DOMAIN - Moving forward through an infinite crimson corridor
// Seamless glowing red walls on left and right, glaring light ahead

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

  // Breathing/Morphing wall displacement - organic bulging
  float breathingDisplacement(vec2 wallPos, float time) {
    // Multiple organic frequencies create breathing effect
    float breath1 = sin(wallPos.x * 0.3 + time * 0.7) * sin(wallPos.y * 0.2 + time * 0.5);
    float breath2 = sin(wallPos.x * 0.15 - time * 0.4) * sin(wallPos.y * 0.25 + time * 0.6);
    float breath3 = sin(wallPos.x * 0.5 + wallPos.y * 0.3 + time * 0.8);

    // Combine for organic, living wall movement
    float breathing = breath1 * 0.5 + breath2 * 0.3 + breath3 * 0.2;

    // Add slow, deep "inhale/exhale" rhythm
    float deepBreath = sin(time * 0.3) * 0.3;

    return breathing + deepBreath;
  }

  // Moiré interference pattern - overlapping waves creating optical shimmer
  float moirePattern(vec2 wallPos, float time) {
    // Multiple wave sets at slightly different angles/frequencies
    float wave1 = sin(wallPos.x * 2.0 + wallPos.y * 0.5 + time * 0.4);
    float wave2 = sin(wallPos.x * 2.1 - wallPos.y * 0.48 + time * 0.35);
    float wave3 = sin(wallPos.x * 1.0 + wallPos.y * 2.0 - time * 0.3);
    float wave4 = sin(wallPos.x * 1.05 - wallPos.y * 1.95 + time * 0.25);

    // Interference from overlapping similar frequencies
    float interference1 = wave1 * wave2;  // Creates beating pattern
    float interference2 = wave3 * wave4;

    // Additional diagonal waves for richer moiré
    float diag1 = sin((wallPos.x + wallPos.y) * 1.5 + time * 0.5);
    float diag2 = sin((wallPos.x + wallPos.y) * 1.55 - time * 0.45);
    float diagInterference = diag1 * diag2;

    // Combine all interference patterns
    return (interference1 + interference2 + diagInterference) * 0.33;
  }

  // ACES tonemapping for smooth HDR glow
  vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    vec3 col = vec3(0.0);

    // Calculate speed with acceleration over time
    float currentSpeed = iSpeed * (1.0 + iAcceleration * iElapsedTime * 0.1);
    currentSpeed = min(currentSpeed, 5.0);

    // Forward motion along Z axis (moving forward through corridor)
    float forwardMotion = iTime * currentSpeed * 3.0;

    // Wall parameters
    float wallDistance = 8.0;     // How far left/right the walls are
    float maxDist = 200.0;        // How far to raymarch

    // Point light at the end of the corridor
    vec3 lightColor = vec3(1.0, 0.95, 0.9);  // Warm white glare

    // Raymarch through the scene
    float t = 0.5;
    float totalWallContrib = 0.0;

    for(int i = 0; i < 80; i++) {
      vec3 p = rd * t;

      // Apply forward motion (walls move backward as we move forward)
      p.z -= forwardMotion;

      // Check distance to left and right wall planes
      float leftWallDist = abs(p.x + wallDistance);
      float rightWallDist = abs(p.x - wallDistance);

      // Which wall are we closer to?
      float baseWallDist = min(leftWallDist, rightWallDist);
      float isLeftWall = step(leftWallDist, rightWallDist);

      // Seamless walls - continuous surface with flowing texture
      float wallZ = p.z;
      float wallY = p.y;
      vec2 wallPos = vec2(wallZ * 0.1, wallY * 0.1);  // Wall UV coordinates

      // === BREATHING/MORPHING WALLS ===
      // Organic displacement makes walls bulge and breathe
      float breathing = breathingDisplacement(wallPos, iTime);
      float wallDisplacement = breathing * 1.5;  // Amplitude of the bulge

      // Apply breathing to wall distance (walls push in/out)
      float wallDist = baseWallDist - wallDisplacement;

      // === MOIRÉ INTERFERENCE PATTERN ===
      float moire = moirePattern(wallPos, iTime);

      // Create seamless flowing pattern along the walls
      float flowPattern = sin(wallZ * 0.15 + iTime * 0.5) * 0.5 + 0.5;
      float flowPattern2 = sin(wallZ * 0.08 - iTime * 0.3) * 0.5 + 0.5;
      float combinedFlow = mix(flowPattern, flowPattern2, 0.5);

      // Combine flow with moiré for shimmering effect
      combinedFlow = combinedFlow + moire * 0.4;

      // Close enough to wall plane? (seamless - always hit if near wall)
      float wallProximity = smoothstep(2.0, 0.0, wallDist);

      // Wall hit - seamless continuous wall
      float wallHit = wallProximity;

      if (wallHit > 0.01) {
        // Use position for subtle variation
        vec2 cellId = vec2(isLeftWall, floor(wallZ * 0.1));
        float h = hash(cellId);
        float h2 = hash(cellId + vec2(100.0, 0.0));

        // Strong crimson/red color palette
        vec3 deepRed = vec3(0.7, 0.0, 0.05);
        vec3 brightRed = vec3(1.0, 0.1, 0.08);
        vec3 hotRed = vec3(1.0, 0.3, 0.1);

        // Palette evolution over time
        float paletteEvolution = min(1.0, iElapsedTime * 0.015);

        // Base wall color with smooth variation
        vec3 wallColor = mix(deepRed, brightRed, combinedFlow * 0.6 + 0.2);
        wallColor = mix(wallColor, hotRed, paletteEvolution * 0.5);

        // === MOIRÉ SHIMMER ON COLOR ===
        // Add shimmering color variation from interference pattern
        float moireShimmer = moire * 0.5 + 0.5;  // Normalize to 0-1
        vec3 shimmerColor = mix(deepRed, vec3(1.0, 0.4, 0.2), moireShimmer * 0.3);
        wallColor = mix(wallColor, shimmerColor, 0.4);

        // === BREATHING INTENSITY ===
        // Walls glow brighter when they bulge toward you
        float breathGlow = breathing * 0.3 + 1.0;
        wallColor *= breathGlow;

        // Glow intensity based on flow pattern
        float glowPattern = pow(combinedFlow, 0.5) * 0.8 + 0.2;

        // Subtle pulsing
        float pulsePhase = h2 * 6.28 + iTime * (0.8 + currentSpeed * 0.2);
        float pulse = 0.85 + 0.15 * sin(pulsePhase);

        // Edge glow (brighter near wall edge)
        float edgeGlow = smoothstep(0.5, 0.0, wallDist) * 1.5;

        // Combine glow
        float totalGlow = glowPattern * pulse + edgeGlow * 0.4;

        // Apply glow to color - stronger emission
        vec3 glowColor = mix(wallColor, hotRed, totalGlow * 0.4);
        glowColor *= (1.5 + totalGlow * 1.2);

        // Distance falloff
        float distFade = 1.0 / (1.0 + t * 0.012);

        // Accumulate color
        col += glowColor * wallHit * distFade * 0.35;
        totalWallContrib += wallHit * distFade;
      }

      // Step forward
      t += max(wallDist * 0.25, 0.5);
      if (t > maxDist) break;
    }

    // Add the glaring point light at the end
    // Calculate angle to light direction (forward = +Z in view space)
    float lookAtLight = max(0.0, rd.z);  // How much we're looking forward

    // Core glare - tight, intense center
    float coreGlare = pow(lookAtLight, 64.0) * 1.5;

    // Medium bloom
    float mediumBloom = pow(lookAtLight, 16.0) * 0.8;

    // Wide atmospheric bloom
    float wideBloom = pow(lookAtLight, 4.0) * 0.2;

    // Combine light contributions
    float totalLight = coreGlare + mediumBloom + wideBloom;

    // Light color - warm white with slight red tint from walls
    vec3 glareColor = lightColor * totalLight;
    glareColor += vec3(1.0, 0.2, 0.1) * mediumBloom * 0.3;  // Red reflection from walls

    col += glareColor;

    // Add atmospheric glow toward the walls
    float sideGlow = smoothstep(0.2, 0.9, abs(rd.x));
    vec3 ambientRed = vec3(0.4, 0.02, 0.03);
    col += ambientRed * sideGlow * 0.4;

    // Subtle light scatter in the corridor
    float scatter = pow(lookAtLight, 4.0) * 0.08;
    col += vec3(1.0, 0.3, 0.2) * scatter;

    // Apply intro progress and brightness
    col *= iBrightness * iIntroProgress;

    // ACES tonemapping for smooth HDR glow
    col = ACESFilm(col);

    // Slight contrast boost
    col = pow(col, vec3(0.95));

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
