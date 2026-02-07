import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// TRANSCENDENT DOMAIN - Immense pulsating wall pairs
// Giant vertical light walls emerging from darkness, moving towards player

interface WallPair {
  z: number;
  speed: number;
  hue: number;
  pulseOffset: number;
  width: number;
  separation: number;
}

interface TranscendentDomainShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  headRotationY?: number;
  introProgress?: number;
  audioTime?: number;
}

// Single wall component with glow
function GlowingWall({
  position,
  color,
  intensity,
  scale
}: {
  position: [number, number, number];
  color: THREE.Color;
  intensity: number;
  scale: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={intensity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function TranscendentDomainShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0
}: TranscendentDomainShaderProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Create wall pairs - staggered at different depths
  const wallPairs = useRef<WallPair[]>([
    { z: -200, speed: 15, hue: 0.55, pulseOffset: 0, width: 80, separation: 60 },
    { z: -350, speed: 18, hue: 0.6, pulseOffset: 1.5, width: 100, separation: 70 },
    { z: -500, speed: 20, hue: 0.52, pulseOffset: 3.0, width: 120, separation: 80 },
    { z: -650, speed: 16, hue: 0.58, pulseOffset: 4.5, width: 90, separation: 65 },
    { z: -800, speed: 22, hue: 0.54, pulseOffset: 6.0, width: 110, separation: 75 },
  ]);

  // Wall mesh refs
  const wallMeshesRef = useRef<(THREE.Mesh | null)[]>([]);

  // Colors for each wall pair
  const wallColors = useMemo(() => {
    return wallPairs.current.map(pair => {
      const color = new THREE.Color();
      color.setHSL(pair.hue, 0.7, 0.6);
      return color;
    });
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime * speed;

    // Update each wall pair
    wallPairs.current.forEach((pair, index) => {
      // Move towards player
      pair.z += pair.speed * 0.016 * speed; // ~60fps delta

      // Reset when passed player
      if (pair.z > 50) {
        pair.z = -800 - Math.random() * 200;
        pair.hue = 0.5 + Math.random() * 0.15; // Blue-cyan range
        pair.speed = 15 + Math.random() * 10;
        pair.width = 80 + Math.random() * 50;
        pair.separation = 55 + Math.random() * 30;
        wallColors[index].setHSL(pair.hue, 0.7, 0.6);
      }

      // Calculate intensity based on distance (fade in from far, fade out when close)
      const distanceFade = Math.min(1, Math.max(0, (-pair.z - 50) / 200)); // Fade in
      const closeFade = Math.min(1, Math.max(0, (-pair.z + 50) / 100)); // Fade out when close

      // Pulsing effect
      const pulse = 0.6 + 0.4 * Math.sin(time * 2.0 + pair.pulseOffset);

      const intensity = distanceFade * closeFade * pulse * brightness * introProgress;

      // Update wall meshes
      const leftWallIndex = index * 2;
      const rightWallIndex = index * 2 + 1;

      if (wallMeshesRef.current[leftWallIndex]) {
        const leftWall = wallMeshesRef.current[leftWallIndex]!;
        leftWall.position.set(-pair.separation, 0, pair.z);
        leftWall.scale.set(pair.width * 0.3, 200, 1);
        (leftWall.material as THREE.MeshBasicMaterial).opacity = intensity;
        (leftWall.material as THREE.MeshBasicMaterial).color = wallColors[index];
      }

      if (wallMeshesRef.current[rightWallIndex]) {
        const rightWall = wallMeshesRef.current[rightWallIndex]!;
        rightWall.position.set(pair.separation, 0, pair.z);
        rightWall.scale.set(pair.width * 0.3, 200, 1);
        (rightWall.material as THREE.MeshBasicMaterial).opacity = intensity;
        (rightWall.material as THREE.MeshBasicMaterial).color = wallColors[index];
      }
    });
  });

  return (
    <group ref={groupRef} rotation={[0, -headRotationY, 0]}>
      {/* Black background sphere */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial color="black" side={THREE.BackSide} />
      </mesh>

      {/* Wall pairs */}
      {wallPairs.current.map((pair, index) => (
        <group key={index}>
          {/* Left wall */}
          <mesh
            ref={(el) => { wallMeshesRef.current[index * 2] = el; }}
            position={[-pair.separation, 0, pair.z]}
            scale={[pair.width * 0.3, 200, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={wallColors[index]}
              transparent
              opacity={0}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Right wall */}
          <mesh
            ref={(el) => { wallMeshesRef.current[index * 2 + 1] = el; }}
            position={[pair.separation, 0, pair.z]}
            scale={[pair.width * 0.3, 200, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={wallColors[index]}
              transparent
              opacity={0}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Glow layers for left wall */}
          <mesh
            position={[-pair.separation, 0, pair.z + 0.5]}
            scale={[pair.width * 0.5, 220, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={wallColors[index]}
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Glow layers for right wall */}
          <mesh
            position={[pair.separation, 0, pair.z + 0.5]}
            scale={[pair.width * 0.5, 220, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={wallColors[index]}
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
