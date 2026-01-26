import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AudioData } from '../hooks/useAudioAnalyzer';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float bass;
  uniform float mid;
  uniform float treble;
  uniform float volume;
  uniform vec3 colorA;
  uniform vec3 colorB;
  varying vec2 vUv;

  void main() {
    // Map UV (0-1) to centered coordinates for sphere
    vec2 uv = vec2((vUv.x - 0.5) * 4.0, (vUv.y - 0.5) * 2.0);
    
    // Audio-reactive time and pattern modulation (reduced sensitivity)
    float audioBoost = 1.0 + bass * 0.4;
    float patternBoost = 1.0 + mid * 0.3;
    float colorBoost = 1.0 + treble * 0.2;
    
    // PATTERNS - modulated by audio
    float time = iTime * 0.5 * audioBoost;
    float pattern1 = sin(uv.x * 2.0 * patternBoost + time);
    float pattern2 = sin(uv.y * 0.5 * patternBoost + time);
    
    // Tunnel depth effect - bass makes it pulse (reduced)
    float tunnelFreq = 25.0 + bass * 4.0;
    float pattern3 = sin(length(uv) * tunnelFreq + time);
    float combined = pattern1 + pattern2 * pattern3;
    
    // COLOR MIX - audio affects blend speed (reduced)
    float blendSpeed = 5.0 + volume * 2.0;
    float blend = sin(1.3 * combined * colorBoost + blendSpeed * iTime * 0.1);
    blend = blend * 0.5 + 0.5; // Normalize to 0-1
    
    // Apply color palette with subtle audio brightness boost
    vec3 finalColor = mix(colorA, colorB, blend);
    finalColor *= 1.0 + volume * 0.15; // Subtle brightness with volume
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Color palettes: [colorA, colorB]
export const COLOR_PALETTES = [
  { name: 'Ocean', colorA: [0.0, 0.4, 0.5], colorB: [1.0, 1.5, 1.0] },
  { name: 'Fire', colorA: [0.8, 0.2, 0.0], colorB: [1.0, 1.0, 0.2] },
  { name: 'Neon', colorA: [1.0, 0.0, 0.5], colorB: [0.0, 1.0, 1.0] },
  { name: 'Purple Haze', colorA: [0.3, 0.0, 0.5], colorB: [1.0, 0.5, 1.0] },
  { name: 'Deep Blue', colorA: [0.02, 0.05, 0.15], colorB: [0.9, 0.95, 1.0] },
  { name: 'Mono', colorA: [0.1, 0.1, 0.1], colorB: [0.95, 0.95, 0.95] },
];

interface ShaderSphereProps {
  audioData: AudioData;
  paletteIndex: number;
}

export function ShaderSphere({ audioData, paletteIndex }: ShaderSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => {
    const initialPalette = COLOR_PALETTES[0];
    return {
      iTime: { value: 0 },
      bass: { value: 0 },
      mid: { value: 0 },
      treble: { value: 0 },
      volume: { value: 0 },
      colorA: { value: new THREE.Vector3(initialPalette.colorA[0], initialPalette.colorA[1], initialPalette.colorA[2]) },
      colorB: { value: new THREE.Vector3(initialPalette.colorB[0], initialPalette.colorB[1], initialPalette.colorB[2]) }
    };
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
      
      // Smooth audio values for less jittery response
      const smoothing = 0.3;
      material.uniforms.bass.value += (audioData.bass - material.uniforms.bass.value) * smoothing;
      material.uniforms.mid.value += (audioData.mid - material.uniforms.mid.value) * smoothing;
      material.uniforms.treble.value += (audioData.treble - material.uniforms.treble.value) * smoothing;
      material.uniforms.volume.value += (audioData.volume - material.uniforms.volume.value) * smoothing;
      
      // Update colors when palette changes (safe modulo for negative values)
      const safeIndex = ((paletteIndex % COLOR_PALETTES.length) + COLOR_PALETTES.length) % COLOR_PALETTES.length;
      const newPalette = COLOR_PALETTES[safeIndex];
      material.uniforms.colorA.value.set(newPalette.colorA[0], newPalette.colorA[1], newPalette.colorA[2]);
      material.uniforms.colorB.value.set(newPalette.colorB[0], newPalette.colorB[1], newPalette.colorB[2]);
    }
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

interface VRShaderSceneProps {
  audioData: AudioData;
  paletteIndex: number;
}

export function VRShaderScene({ audioData, paletteIndex }: VRShaderSceneProps) {
  return (
    <>
      <ShaderSphere audioData={audioData} paletteIndex={paletteIndex} />
    </>
  );
}
