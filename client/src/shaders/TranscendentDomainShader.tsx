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

  // Tanh approximation for GLSL ES compatibility
  // https://mini.gmshaders.com/p/func-tanh
  vec3 tanhApprox(vec3 x) {
    vec3 x2 = x * x;
    return clamp(x * (27.0 + x2) / (27.0 + 9.0 * x2), -1.0, 1.0);
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

      // Seamless walls - continuous surface with flowing texture
      float wallZ = p.z;
      float wallY = p.y;
      vec2 wallPos = vec2(wallZ * 0.1, wallY * 0.1);  // Wall UV coordinates

      // === BREATHING/MORPHING WALLS ===
      // Organic displacement makes walls bulge and breathe
      float breathing = breathingDisplacement(wallPos, iTime);
      float wallDisplacement = clamp(breathing * 2.0, -1.5, 2.5);

      // Apply breathing to wall distance (walls push in/out)
      float wallDist = max(0.1, baseWallDist - wallDisplacement);

      // Simple flowing pattern along the walls
      float flowPattern = sin(wallZ * 0.15 + iTime * 0.5) * 0.5 + 0.5;

      // Close enough to wall plane? (seamless - always hit if near wall)
      float wallProximity = smoothstep(2.0, 0.0, wallDist);

      // Wall hit - seamless continuous wall
      float wallHit = wallProximity;

      if (wallHit > 0.01) {
        // === SMOOTH GRADIENT COLOR SYSTEM ===
        // Position-based color that creates natural, flowing gradients
        // Using sin with phase offsets ensures smooth color mixing (never solid colors)
        float colorPos = wallY * 0.15 + wallZ * 0.08 + iTime * 0.3;

        // Phase-shifted sin waves for RGB - this guarantees smooth gradients
        // The offsets (0, 1.0, 2.0) spread the colors across the spectrum
        vec3 gradientColor = sin(colorPos + vec3(0.0, 1.0, 2.0)) * 0.5 + 0.5;

        // Shift toward warm palette (reds, oranges, magentas, purples)
        // Remap to desired color range while keeping smooth gradients
        vec3 warmShift = vec3(
          gradientColor.r * 0.6 + 0.4,                           // Red: 0.4-1.0
          gradientColor.g * gradientColor.r * 0.5,               // Green: modulated by red for oranges
          gradientColor.b * 0.7 + gradientColor.r * 0.3          // Blue: for magentas/purples
        );

        // Add secondary wave for more complex gradient patterns
        float colorPos2 = wallY * 0.22 - wallZ * 0.12 + iTime * 0.2;
        vec3 secondaryGradient = sin(colorPos2 + vec3(0.5, 1.5, 2.5)) * 0.5 + 0.5;

        // Blend the two gradient systems for rich, organic color flow
        vec3 wallColor = mix(warmShift, secondaryGradient * vec3(1.0, 0.3, 0.6), 0.35);

        // Ensure we stay in warm spectrum - boost reds, limit greens
        wallColor.r = max(wallColor.r, 0.3);
        wallColor.g = min(wallColor.g, wallColor.r * 0.7);

        // === BREATHING INTENSITY ===
        // Walls glow brighter when they bulge toward you (never darken)
        float breathGlow = max(1.0, breathing * 0.4 + 1.2);
        wallColor *= breathGlow;

        // Glow intensity based on flow pattern
        float glowPattern = pow(flowPattern, 0.5) * 0.8 + 0.4;

        // Smooth, position-based pulsing (no abrupt changes)
        float pulsePhase = wallY * 0.3 + wallZ * 0.15 + iTime * 0.8;
        float pulse = 0.75 + 0.25 * sin(pulsePhase);

        // Edge glow (brighter near wall edge)
        float edgeGlow = smoothstep(1.0, 0.0, wallDist) * 1.5;

        // Combine glow smoothly
        float totalGlow = glowPattern * pulse + edgeGlow * 0.5;

        // Apply glow to color
        vec3 glowColor = wallColor * (1.5 + totalGlow * 1.0);

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

    // Add atmospheric glow toward the walls - smooth gradient colors
    float sideGlow = smoothstep(0.2, 0.9, abs(rd.x));
    // Smooth ambient gradient based on view direction and time
    float ambientPhase = rd.y * 2.0 + iTime * 0.25;
    vec3 ambientGradient = sin(ambientPhase + vec3(0.0, 1.2, 2.4)) * 0.5 + 0.5;
    vec3 ambientColor = ambientGradient * vec3(0.5, 0.15, 0.4); // Warm tint
    col += ambientColor * sideGlow * 0.5;

    // Light scatter in the corridor - smooth gradient shifts
    float scatter = pow(lookAtLight, 4.0) * 0.12;
    float scatterPhase = iTime * 0.2 + rd.x * 1.5;
    vec3 scatterGradient = sin(scatterPhase + vec3(0.0, 0.8, 1.6)) * 0.5 + 0.5;
    vec3 scatterColor = scatterGradient * vec3(1.0, 0.4, 0.7);
    col += scatterColor * scatter;

    // Apply intro progress and brightness
    col *= iBrightness * iIntroProgress;

    // Tanh tonemapping for smooth HDR (from reference shader)
    col = tanhApprox(col * col * 0.5);

    // Slight warmth boost
    col.r = pow(col.r, 0.92);

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
