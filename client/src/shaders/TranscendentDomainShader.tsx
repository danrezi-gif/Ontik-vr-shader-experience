import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// TRANSCENDENT DOMAIN - Moving forward through an infinite crimson corridor
// Seamless glowing red walls on left and right with breathing organic motion

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

  // Breathing/Morphing wall displacement - subtle organic bulging
  float breathingDisplacement(vec2 wallPos, float time) {
    // Gentler frequencies to avoid artifacts
    float breath1 = sin(wallPos.x * 0.3 + time * 0.8) * sin(wallPos.y * 0.25 + time * 0.6);
    float breath2 = sin(wallPos.x * 0.15 + wallPos.y * 0.2 + time * 0.5);

    // Smoother combination - less extreme values
    float breathing = breath1 * 0.4 + breath2 * 0.3;

    // Gentler inhale/exhale
    float deepBreath = sin(time * 0.4) * 0.25;

    return breathing + deepBreath;
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    vec3 col = vec3(0.0);

    // Calculate speed with acceleration over time
    float currentSpeed = iSpeed * (1.0 + iAcceleration * iElapsedTime * 0.1);
    currentSpeed = min(currentSpeed, 5.0);

    // Forward motion along Z axis (moving forward through corridor)
    float forwardMotion = iTime * currentSpeed * 6.0;

    // Wall parameters
    float wallDistance = 8.0;     // How far left/right the walls are
    float maxDist = 600.0;        // How far to raymarch - extended for deep infinity


    // Raymarch through the scene - optimized for VR performance
    float t = 0.5;
    float totalWallContrib = 0.0;

    for(int i = 0; i < 70; i++) {
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
      // Subtle displacement - keeps walls stable
      float breathing = breathingDisplacement(wallPos, iTime);
      float wallDisplacement = breathing * 1.2;  // Gentler displacement

      // Apply breathing to wall distance with safe minimum
      float wallDist = max(0.5, baseWallDist - wallDisplacement);

      // Simple flowing pattern along the walls - stronger z-response for visible motion
      float flowPattern = sin(wallZ * 0.25 + iTime * 0.5) * 0.5 + 0.5;

      // Close enough to wall plane? (smooth falloff)
      float wallProximity = smoothstep(3.0, 0.5, wallDist);

      // Wall hit - seamless continuous wall
      float wallHit = wallProximity;

      if (wallHit > 0.01) {
        // === CLEAN GRADIENT COLOR SYSTEM ===
        // Simple flowing gradients - warm reds to magentas
        // Stronger z-influence makes forward motion more visible
        float colorPos = wallY * 0.12 + wallZ * 0.15 + iTime * 0.25;

        // Base gradient in warm spectrum
        float r = 0.6 + 0.4 * sin(colorPos);
        float g = 0.15 + 0.1 * sin(colorPos * 0.7 + 1.0);
        float b = 0.3 + 0.25 * sin(colorPos * 1.2 + 2.0);

        vec3 wallColor = vec3(r, g, b);

        // === BREATHING INTENSITY ===
        // Subtle glow variation from breathing
        float breathGlow = 1.0 + breathing * 0.15;
        wallColor *= breathGlow;

        // Glow intensity based on flow pattern
        float glowPattern = pow(flowPattern, 0.5) * 0.8 + 0.4;

        // Smooth, position-based pulsing (no abrupt changes)
        float pulsePhase = wallY * 0.3 + wallZ * 0.15 + iTime * 0.8;
        float pulse = 0.75 + 0.25 * sin(pulsePhase);

        // Soft edge glow
        float edgeGlow = smoothstep(1.5, 0.5, wallDist);

        // Combine glow smoothly
        float totalGlow = glowPattern * pulse + edgeGlow * 0.3;

        // Apply glow to color
        vec3 glowColor = wallColor * (1.2 + totalGlow * 0.6);

        // Distance falloff - gentler for deeper infinity
        float distFade = 1.0 / (1.0 + t * 0.005);

        // Accumulate color
        col += glowColor * wallHit * distFade * 0.4;
        totalWallContrib += wallHit * distFade;
      }

      // Step forward - larger steps for better performance
      t += max(wallDist * 0.4, 1.5);
      if (t > maxDist) break;
    }

    // Forward glow - subtle ambient light ahead (no harsh glare)
    float lookAtLight = max(0.0, rd.z);  // How much we're looking forward

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

    // Reinhard tonemapping - avoids dark banding
    col = col / (1.0 + col);

    // Slight warmth and saturation boost
    col.r = pow(col.r, 0.9);
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.15);

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
      <sphereGeometry args={[100, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
