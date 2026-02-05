import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useXRSessionVisibilityState } from '@react-three/xr';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Torus matrix shader - adapted from user's reference
// Creates a matrix-style streaming effect on a torus that user is inside
const fragmentShader = `
  precision highp float;

  #define PI 3.14159265359

  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float iTime;
  uniform vec2 iResolution;
  uniform float iIntroProgress;
  uniform float iBrightness;
  uniform float iSpeed;
  uniform sampler2D iChannel0; // Digit texture
  uniform sampler2D iChannel1; // Noise texture

  // Torus parameters
  const float Radius1 = 8.0;  // Major radius
  const float Radius2 = 3.0;  // Minor radius (tube)
  const float Speed1 = 0.3;   // Rotation speed
  const float Speed2 = 15.0;  // Theta scroll speed

  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }

  float map(in vec3 pos) {
    vec3 q = pos;
    float d = -sdTorus(q.xzy, vec2(Radius1, Radius2));
    return d;
  }

  vec3 calcNormal(in vec3 pos) {
    const float ep = 0.0001;
    vec2 e = vec2(1.0, -1.0) * 0.5773;
    return normalize(
      e.xyy * map(pos + e.xyy * ep) +
      e.yyx * map(pos + e.yyx * ep) +
      e.yxy * map(pos + e.yxy * ep) +
      e.xxx * map(pos + e.xxx * ep)
    );
  }

  vec3 applyFog(in vec3 rgb, in float distance, in float strength) {
    float fogAmount = 1.0 - exp(-distance * strength);
    vec3 fogColor = vec3(0.0);
    return mix(rgb, fogColor, fogAmount);
  }

  // Generate matrix-style characters procedurally
  float getDigit(vec2 uv, float digit) {
    // Create a simple procedural digit pattern
    float d = mod(digit, 10.0);
    vec2 p = fract(uv) * 2.0 - 1.0;

    // Different patterns for different digits
    float pattern = 0.0;

    // Horizontal bars
    if (d < 2.0) {
      pattern = step(abs(p.y - 0.5), 0.15) + step(abs(p.y + 0.5), 0.15);
    } else if (d < 4.0) {
      pattern = step(abs(p.y), 0.15);
    } else if (d < 6.0) {
      pattern = step(abs(p.x), 0.15);
    } else if (d < 8.0) {
      pattern = step(length(p), 0.4);
    } else {
      pattern = step(abs(p.x - p.y), 0.2);
    }

    return clamp(pattern, 0.0, 1.0);
  }

  void mainVR(out vec4 fragColor, in vec2 fragCoord, in vec3 ro, in vec3 rd) {
    ro += vec3(0.0, Radius1, 0.0);
    rd = rd.zxy;

    float time = iTime * Speed1 * iSpeed;

    mat3 m = mat3(
      1.0, 0.0, 0.0,
      0.0, cos(time), sin(time),
      0.0, -sin(time), cos(time)
    );

    rd = m * rd;

    float t = 0.5;
    for (int i = 0; i < 64; i++) {
      vec3 p = ro + t * rd;
      float h = map(p);
      if (abs(h) < 0.001) break;
      t += h;
    }

    vec3 p = ro + t * rd;
    float theta = (atan(p.x, p.y) / PI + 1.0) * 150.0 - iTime * Speed2 * iSpeed;
    float phi = (atan(length(p.xy) - Radius1, p.z) / PI + 1.0) * 30.0;

    float itheta = floor(theta);
    float iphi = floor(phi);
    float ftheta = theta - itheta;
    float fphi = phi - iphi;

    ftheta = clamp(ftheta * 0.6 + 0.2, 0.0, 1.0);
    fphi = clamp(fphi * 0.8 + 0.1, 0.0, 1.0);

    // Use noise texture for randomization
    vec4 rand = texture2D(iChannel1, vec2(iphi, itheta) * 0.386557);
    float digit = floor(rand.r * 10.0);

    // Time-based digit variation
    float freq = sin(iTime * 0.5 + rand.g * 6.28) * 0.5 + 0.5;
    digit = mod(digit + (freq > 0.5 ? 1.0 : 0.0), 10.0);

    // Procedural digit pattern
    vec3 color = vec3(getDigit(vec2(ftheta, fphi), digit));

    // Green matrix color
    color *= vec3(0.2, 1.0, 0.3);

    vec3 norm = calcNormal(p);
    color = applyFog(color, t, 0.2 * ((norm.z * norm.z) / 3.0 + 0.1 + clamp(norm.y * 0.4, 0.0, 1.0)));

    fragColor = vec4(color, 1.0);
  }

  void main() {
    vec3 tot = vec3(0.0);

    vec2 p = vPosition.xy * 2.0;

    vec3 ro = vec3(0.0);
    vec3 rd = normalize(vec3(p, -1.0));

    vec4 color;
    mainVR(color, gl_FragCoord.xy, ro, rd);
    tot += color.xyz;

    // Apply brightness and intro fade
    float fade = smoothstep(0.0, 0.2, iIntroProgress);
    tot *= iBrightness * fade;

    gl_FragColor = vec4(tot, 1.0);
  }
`;

interface TorusMatrixShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  headRotationY?: number;
  introProgress?: number;
}

export function TorusMatrixShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 1
}: TorusMatrixShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const startTimeRef = useRef<number>(Date.now());

  const visibilityState = useXRSessionVisibilityState();

  // Create noise texture for randomization
  const noiseTexture = useMemo(() => {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size * 4; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }, []);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(1920, 1080) },
    iIntroProgress: { value: introProgress },
    iBrightness: { value: brightness },
    iSpeed: { value: speed },
    iChannel0: { value: null },
    iChannel1: { value: noiseTexture }
  }), [noiseTexture]);

  useFrame(() => {
    if (materialRef.current) {
      if (visibilityState !== 'visible-blurred') {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        materialRef.current.uniforms.iTime.value = elapsed;
      }
      materialRef.current.uniforms.iIntroProgress.value = introProgress;
      materialRef.current.uniforms.iBrightness.value = brightness;
      materialRef.current.uniforms.iSpeed.value = speed;
    }
  });

  // Large sphere surrounding the user - they're inside the torus effect
  return (
    <mesh ref={meshRef} rotation={[0, -headRotationY, 0]} scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
