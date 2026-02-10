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
    float breath1 = sin(wallPos.x * 0.4 + time * 1.2) * sin(wallPos.y * 0.3 + time * 0.9);
    float breath2 = sin(wallPos.x * 0.2 - time * 0.7) * sin(wallPos.y * 0.25 + time * 1.0);
    float breath3 = sin(wallPos.x * 0.6 + wallPos.y * 0.4 + time * 1.3);

    // Combine for organic, living wall movement
    float breathing = breath1 * 0.5 + breath2 * 0.35 + breath3 * 0.25;

    // Deep "inhale/exhale" rhythm
    float deepBreath = sin(time * 0.5) * 0.4;

    return breathing + deepBreath;
  }

  // Moiré interference pattern - INTENSE overlapping waves creating optical shimmer
  float moirePattern(vec2 wallPos, float time) {
    // Multiple wave sets at slightly different angles/frequencies - FASTER
    float wave1 = sin(wallPos.x * 3.0 + wallPos.y * 0.8 + time * 1.2);
    float wave2 = sin(wallPos.x * 3.15 - wallPos.y * 0.75 + time * 1.0);
    float wave3 = sin(wallPos.x * 1.5 + wallPos.y * 3.0 - time * 0.9);
    float wave4 = sin(wallPos.x * 1.58 - wallPos.y * 2.9 + time * 0.85);

    // Interference from overlapping similar frequencies
    float interference1 = wave1 * wave2;  // Creates beating pattern
    float interference2 = wave3 * wave4;

    // Additional diagonal waves for richer moiré - MORE LAYERS
    float diag1 = sin((wallPos.x + wallPos.y) * 2.5 + time * 1.5);
    float diag2 = sin((wallPos.x + wallPos.y) * 2.6 - time * 1.4);
    float diagInterference = diag1 * diag2;

    // Radial ripples for extra drama
    float ripple = sin(length(wallPos) * 4.0 - time * 2.0);
    float ripple2 = sin(length(wallPos) * 4.2 + time * 1.8);
    float rippleInterference = ripple * ripple2;

    // Combine all interference patterns - STRONGER
    return (interference1 + interference2 + diagInterference + rippleInterference) * 0.4;
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
      float wallDisplacement = breathing * 2.5;  // Noticeable but smooth bulges

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

        // === DYNAMIC COLOR CYCLING ===
        // Multiple color palettes that shift rapidly
        float colorCycle = iTime * 0.8;  // Fast color cycling
        float colorPhase = fract(colorCycle);
        float colorSection = floor(mod(colorCycle, 6.0));  // 6 color modes

        // Define rich color palette
        vec3 deepRed = vec3(0.8, 0.0, 0.1);
        vec3 hotOrange = vec3(1.0, 0.4, 0.0);
        vec3 electricPurple = vec3(0.6, 0.0, 1.0);
        vec3 magenta = vec3(1.0, 0.0, 0.5);
        vec3 crimson = vec3(0.9, 0.1, 0.2);
        vec3 amber = vec3(1.0, 0.6, 0.1);

        // Smooth color transitions based on time
        vec3 color1, color2;
        if (colorSection < 1.0) { color1 = deepRed; color2 = hotOrange; }
        else if (colorSection < 2.0) { color1 = hotOrange; color2 = magenta; }
        else if (colorSection < 3.0) { color1 = magenta; color2 = electricPurple; }
        else if (colorSection < 4.0) { color1 = electricPurple; color2 = crimson; }
        else if (colorSection < 5.0) { color1 = crimson; color2 = amber; }
        else { color1 = amber; color2 = deepRed; }

        // Smooth interpolation between colors
        vec3 cycleColor = mix(color1, color2, smoothstep(0.0, 1.0, colorPhase));

        // Additional spatial color variation - changes across wall surface
        float spatialPhase = sin(wallPos.x * 0.5 + wallPos.y * 0.3 + iTime * 1.5) * 0.5 + 0.5;
        vec3 spatialColor = mix(cycleColor, mix(magenta, amber, spatialPhase), 0.4);

        // Base wall color with flow pattern
        vec3 wallColor = mix(spatialColor, cycleColor, combinedFlow * 0.5);

        // === MOIRÉ SHIMMER ON COLOR ===
        // Add shimmering color variation from interference pattern
        float moireShimmer = moire * 0.5 + 0.5;  // Normalize to 0-1
        vec3 shimmerAccent = mix(electricPurple, hotOrange, moireShimmer);
        wallColor = mix(wallColor, shimmerAccent, 0.35);

        // === BREATHING INTENSITY ===
        // Walls glow MUCH brighter when they bulge toward you
        float breathGlow = breathing * 0.5 + 1.0;
        wallColor *= breathGlow;

        // Glow intensity based on flow pattern - MORE INTENSE
        float glowPattern = pow(combinedFlow, 0.4) * 1.0 + 0.3;

        // Faster pulsing
        float pulsePhase = h2 * 6.28 + iTime * (1.5 + currentSpeed * 0.4);
        float pulse = 0.7 + 0.3 * sin(pulsePhase);

        // Edge glow (brighter near wall edge) - STRONGER
        float edgeGlow = smoothstep(0.8, 0.0, wallDist) * 2.0;

        // Combine glow
        float totalGlow = glowPattern * pulse + edgeGlow * 0.6;

        // Apply glow to color - MUCH stronger emission
        vec3 glowAccent = mix(hotOrange, magenta, sin(iTime * 2.0) * 0.5 + 0.5);
        vec3 glowColor = mix(wallColor, glowAccent, totalGlow * 0.5);
        glowColor *= (1.8 + totalGlow * 1.5);

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

    // Add atmospheric glow toward the walls - DYNAMIC COLOR
    float sideGlow = smoothstep(0.2, 0.9, abs(rd.x));
    float ambientCycle = iTime * 0.6;
    vec3 ambientColor = mix(
      vec3(0.4, 0.02, 0.2),  // Purple-red
      vec3(0.5, 0.2, 0.02),  // Orange
      sin(ambientCycle) * 0.5 + 0.5
    );
    col += ambientColor * sideGlow * 0.5;

    // Light scatter in the corridor - color shifts
    float scatter = pow(lookAtLight, 4.0) * 0.12;
    vec3 scatterColor = mix(vec3(1.0, 0.3, 0.2), vec3(0.8, 0.2, 1.0), sin(iTime * 0.8) * 0.5 + 0.5);
    col += scatterColor * scatter;

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
