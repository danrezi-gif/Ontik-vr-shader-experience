import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// CRIMSON DESCENT - Infinite falling through a crimson void
// Walls on left and right, blackness ahead, flowing downward, accelerating

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vAngle;

  void main() {
    vUv = uv;
    vPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    // Calculate angle around cylinder (0 = front, PI = back, PI/2 = sides)
    vAngle = atan(position.x, position.z);

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

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vAngle;

  // Noise functions for organic flow
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for(int i = 0; i < 5; i++) {
      value += amplitude * noise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    // Calculate how much we're looking at the sides vs front/back
    // vAngle: 0 = front, +/-PI = back, +/-PI/2 = sides
    float sideAmount = abs(sin(vAngle)); // 1 at sides, 0 at front/back
    float frontBack = abs(cos(vAngle)); // 1 at front/back, 0 at sides

    // Fade to black toward front and back
    float wallVisibility = smoothstep(0.3, 0.7, sideAmount);

    // Calculate speed with acceleration over time
    float currentSpeed = iSpeed * (1.0 + iAcceleration * iElapsedTime * 0.1);
    currentSpeed = min(currentSpeed, 5.0); // Cap at 5x

    // Flowing downward motion
    float flowTime = iTime * currentSpeed;
    vec2 flowUv = vec2(vUv.x, vUv.y * 10.0 - flowTime);

    // Create flowing patterns on walls
    float flow1 = fbm(flowUv * 2.0);
    float flow2 = fbm(flowUv * 4.0 + vec2(100.0, 0.0));
    float flow3 = fbm(flowUv * 1.0 + vec2(0.0, 50.0));

    // Vertical streaks (like rain or falling streams)
    float streakX = fract(vUv.x * 20.0);
    float streak = smoothstep(0.4, 0.5, streakX) * smoothstep(0.6, 0.5, streakX);
    float streakFlow = fbm(vec2(vUv.x * 20.0, flowUv.y * 0.5));
    streak *= streakFlow;

    // Combine flows
    float pattern = flow1 * 0.5 + flow2 * 0.3 + streak * 0.4;

    // Color gradient: crimson red to light tones
    // Base: deep crimson (#DC143C) = vec3(0.86, 0.08, 0.24)
    // Light: warm white/pink = vec3(1.0, 0.9, 0.85)
    vec3 deepCrimson = vec3(0.55, 0.0, 0.1);
    vec3 brightCrimson = vec3(0.86, 0.08, 0.24);
    vec3 lightTone = vec3(1.0, 0.85, 0.8);

    // Evolve palette based on speed/time
    float paletteEvolution = min(1.0, iElapsedTime * 0.02); // Slowly shifts lighter

    vec3 baseColor = mix(deepCrimson, brightCrimson, paletteEvolution);
    vec3 highlightColor = mix(brightCrimson, lightTone, paletteEvolution);

    // Apply pattern to color
    vec3 wallColor = mix(baseColor, highlightColor, pattern);

    // Add glow intensity based on pattern peaks
    float glow = pow(pattern, 2.0) * 0.5;
    wallColor += highlightColor * glow;

    // === CENTER PULSATING GLOW ===
    // Only appears as speed increases
    float speedFactor = smoothstep(0.0, 3.0, currentSpeed);

    // Pulsation
    float pulseFreq = 1.0 + currentSpeed * 0.5;
    float pulse = 0.5 + 0.5 * sin(iTime * pulseFreq * 3.14159);
    pulse = 0.6 + 0.4 * pulse; // Keep it mostly visible when active

    // Glow is visible when looking toward front (blackness direction)
    // but only after speed builds up
    float glowIntensity = frontBack * speedFactor * pulse;

    // Central glow color - warm light emerging from void
    vec3 glowColor = mix(vec3(0.8, 0.2, 0.1), vec3(1.0, 0.6, 0.4), pulse);

    // Radial falloff for center glow (stronger at very center)
    float centerY = abs(vUv.y - 0.5) * 2.0;
    float radialFalloff = 1.0 - smoothstep(0.0, 0.6, centerY);
    glowIntensity *= radialFalloff;

    // Combine wall color with void (front/back)
    vec3 finalColor = wallColor * wallVisibility;

    // Add center glow to the dark areas
    finalColor += glowColor * glowIntensity * (1.0 - wallVisibility) * 0.8;

    // Apply intro progress and brightness
    finalColor *= iBrightness * iIntroProgress;

    // Ensure black void when looking straight ahead (before speed builds)
    float voidMask = (1.0 - wallVisibility) * (1.0 - glowIntensity);
    finalColor = mix(finalColor, vec3(0.0), voidMask * (1.0 - speedFactor * 0.5));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

interface CrimsonDescentShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  headRotationY?: number;
  introProgress?: number;
  audioTime?: number;
}

export function CrimsonDescentShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0
}: CrimsonDescentShaderProps) {
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

  // Cylinder extending forward and backward from user
  // User is inside the cylinder, looking at the walls on the sides
  return (
    <group rotation={[0, -headRotationY, 0]}>
      {/* Main cylinder - walls on sides */}
      <mesh
        ref={meshRef}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <cylinderGeometry args={[30, 30, 1000, 64, 64, true]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Black caps at top and bottom for infinite depth illusion */}
      <mesh position={[0, 0, -500]} rotation={[0, 0, 0]}>
        <circleGeometry args={[30, 64]} />
        <meshBasicMaterial color="black" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 500]} rotation={[0, 0, 0]}>
        <circleGeometry args={[30, 64]} />
        <meshBasicMaterial color="black" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
