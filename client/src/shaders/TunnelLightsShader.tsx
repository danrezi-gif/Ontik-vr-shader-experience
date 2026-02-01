import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vDepth;

  void main() {
    vUv = uv;
    vPosition = normalize(position);
    // Pass normalized depth (0 = near end, 1 = far end)
    vDepth = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform float iSpeed;
  uniform float iZoom;
  uniform float iBrightness;
  uniform float iColorShift;
  uniform float iPulse;
  uniform float iIntroProgress;
  uniform float iTunnelEnd;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vDepth;

  void main() {
    // Map cylinder UV to create tunnel effect
    vec2 uv = vec2(vUv.x * 2.0 - 1.0, vDepth * 2.0 - 1.0);
    uv.x *= iResolution.x / iResolution.y;

    float t = iTime * iSpeed;
    float z = 0.0;
    float d = 0.0;
    float i = 0.0;
    vec4 o = vec4(0.0);

    // Zoom affects the ray direction spread
    vec3 s = normalize(vec3(uv * (2.1 - iZoom * 0.5), -1.0));
    vec3 c = s / max(s.y, 0.001);
    vec3 p;
    vec3 v = vec3(0.0, 1.0, 0.0);

    // Pulse affects iteration intensity
    float iterMult = 1.0 + iPulse * 0.3;

    for(float iter = 0.0; iter < 30.0; iter++) {
      i = iter;
      p = s * z + v;
      p.z -= t;
      d = min(p.y + p.y, 0.0);
      p.y -= d;

      // Pulse affects the wave distortion
      float waveAmp = 0.03 + iPulse * 0.02;
      p += waveAmp * sin(length(c - 2.0) / 0.1) * d;

      float sinVal = length(sin(p + p * v.y - sin(p.zxy * 0.6 - t * 0.2)) - v);
      d = 0.01 + 0.6 * abs(sinVal - 0.1);
      z += d;

      o += (9.0 * iterMult - cos(p.y / 0.2) / (0.1 + d)) / d / z;
    }

    // Color with shift and brightness - blue palette
    vec3 colorBase = vec3(1.0, 3.0 + iColorShift, 9.0 + iColorShift * 3.0);
    o = tanh(vec4(colorBase, 0.0) * o * iBrightness / 6e3);

    vec3 glowColor = vec3(0.7, 0.85, 1.0); // Cool blue-white glow

    // === FAR END: Divine light source ===
    // Radial glow expanding from center at far end
    float farEndProximity = smoothstep(0.7, 1.0, vDepth);
    // Calculate radial distance from tunnel center (vUv.x = 0.5 is center)
    float radialDist = abs(vUv.x - 0.5) * 2.0; // 0 at center, 1 at edges
    float divineGlow = farEndProximity * (1.0 - radialDist * 0.5); // Brighter at center
    divineGlow *= 1.5 + iTunnelEnd * 0.5; // Intensifies as intro progresses
    o.rgb += glowColor * divineGlow * iBrightness;

    // === NEAR END: Fade to void ===
    // Darken as we approach the near end (behind user)
    float nearEndDarkness = smoothstep(0.3, 0.0, vDepth);
    o.rgb *= 1.0 - nearEndDarkness * 0.8; // Fade to ~20% brightness at near end

    // === UV SEAM GLOW ===
    // Cover the seam where vUv.x wraps (at 0 and 1)
    float seamWidth = 0.008 + 0.03 * iIntroProgress;
    float distToSeam = min(vUv.x, 1.0 - vUv.x);
    float seamGlow = smoothstep(seamWidth, 0.0, distToSeam) * 0.9;
    o.rgb += glowColor * seamGlow * iBrightness;

    gl_FragColor = vec4(o.rgb, 1.0);
  }
`;

interface TunnelLightsShaderProps {
  speed?: number;
  zoom?: number;
  brightness?: number;
  colorShift?: number;
  pulse?: number;
  headRotationY?: number;
  introProgress?: number;
}

export function TunnelLightsShader({
  speed = 1.0,
  zoom = 0.0,
  brightness = 1.0,
  colorShift = 0.0,
  pulse = 0.0,
  headRotationY = 0,
  introProgress = 0
}: TunnelLightsShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(1920, 1080) },
    iSpeed: { value: speed },
    iZoom: { value: zoom },
    iBrightness: { value: brightness },
    iColorShift: { value: colorShift },
    iPulse: { value: pulse },
    iIntroProgress: { value: introProgress },
    iTunnelEnd: { value: introProgress }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
      material.uniforms.iSpeed.value = speed;
      material.uniforms.iZoom.value = zoom;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iColorShift.value = colorShift;
      material.uniforms.iPulse.value = pulse;
      material.uniforms.iIntroProgress.value = introProgress;
      // Tunnel end approaches as intro progresses
      material.uniforms.iTunnelEnd.value = introProgress;
    }
  });

  // Cylinder: radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded
  // User is inside the cylinder looking toward the far end
  // Rotate so the cylinder extends forward (Z-axis) from user's POV
  return (
    <mesh
      ref={meshRef}
      rotation={[Math.PI / 2, -headRotationY, 0]}
      position={[0, 0, 0]}
    >
      <cylinderGeometry args={[50, 50, 1000, 64, 64, true]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
