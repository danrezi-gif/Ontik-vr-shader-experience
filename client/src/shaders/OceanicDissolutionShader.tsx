import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ALIEN WOMB - HR Giger inspired organic flowing environment
// Restored original Voronoi visuals with dramatically enhanced gaze + hand effects
// Progressive envelopment → fusion

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
  precision mediump float;

  uniform float iTime;
  uniform float iSpeed;
  uniform float iBrightness;
  uniform float iColorShift;
  uniform float iIntroProgress;
  uniform float iElapsedTime;
  uniform vec3 uGazeDir;
  uniform vec3 uLeftHandDir;
  uniform vec3 uRightHandDir;
  uniform float uLeftHandActive;
  uniform float uRightHandActive;
  uniform float uEnvelopment;

  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // --- Noise primitives ---

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p.zxy, p.yxz + 19.19);
    return fract(vec3(p.x * p.y, p.y * p.z, p.z * p.x));
  }

  float hash31(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise3d(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(
      mix(
        mix(dot(hash33(i), f), dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
        mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x),
        f.y
      ),
      mix(
        mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
        mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x),
        f.y
      ),
      f.z
    );
    return n * 0.5 + 0.5;
  }

  float fbm(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) {
      val += amp * noise3d(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  // 3D Voronoi — returns (nearest, second-nearest) distances
  vec2 voronoi(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float d1 = 2.0;
    float d2 = 2.0;
    for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
    for (int z = -1; z <= 1; z++) {
      vec3 n = vec3(float(x), float(y), float(z));
      vec3 pt = hash33(i + n);
      pt = 0.5 + 0.5 * sin(iTime * 0.3 + 6.2831 * pt);
      vec3 diff = n + pt - f;
      float d = dot(diff, diff);
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) { d2 = d; }
    }
    return vec2(sqrt(d1), sqrt(d2));
  }

  float veins(vec3 p, float edgeWidth) {
    vec2 v = voronoi(p);
    return 1.0 - smoothstep(0.0, edgeWidth, v.y - v.x);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    float time = iTime * iSpeed;
    float env = uEnvelopment;
    float fusion = smoothstep(0.75, 1.0, env);

    // === DOMAIN WARPING (original quality: 3 fbm calls) ===
    vec3 wrd = rd;
    float w1 = fbm(rd * 2.5 + time * 0.04);
    float w2 = fbm(rd * 2.5 + vec3(100.0) + time * 0.03);
    float w3 = fbm(rd * 2.5 + vec3(200.0) - time * 0.05);
    wrd += vec3(w1, w2, w3) * (0.2 + env * 0.1);

    // === ORGANIC VEIN PATTERNS (original Voronoi quality, 2 layers) ===
    float s1 = 3.0 + env * 2.0;
    float v1 = veins(wrd * s1 + time * 0.06, 0.12 - env * 0.04);

    float s2 = 6.0 + env * 3.0;
    float v2 = veins(wrd * s2 - time * 0.04 + vec3(50.0), 0.10);

    float totalVeins = v1 * 0.55 + v2 * 0.35;

    // Fine capillaries appear with envelopment (noise-based, cheap)
    if (env > 0.3) {
      float fineFade = smoothstep(0.3, 0.6, env);
      float v3 = 1.0 - abs(noise3d(wrd * (12.0 + env * 4.0) + time * 0.08 + vec3(100.0)) * 2.0 - 1.0);
      totalVeins += v3 * fineFade * 0.2;
    }

    // === COLOR PALETTE: deep blue / cyan / light pink ===
    vec3 deepBlue  = vec3(0.015, 0.03, 0.10);
    vec3 midBlue   = vec3(0.04, 0.08, 0.22);
    vec3 cyan      = vec3(0.08, 0.55, 0.75);
    vec3 lightPink = vec3(0.85, 0.45, 0.55);
    vec3 paleCyan  = vec3(0.35, 0.80, 0.90);
    vec3 fusionCol = vec3(0.30, 0.70, 0.85);

    // Base environment color (fbm for rich texture)
    float viewGrad = rd.y * 0.5 + 0.5;
    vec3 col = mix(deepBlue, midBlue, viewGrad * 0.4 + fbm(rd * 1.5) * 0.25);

    // Vein coloring
    float veinMix = fbm(wrd * 4.0 + time * 0.02) * 0.7 + 0.15;
    vec3 veinColor = mix(cyan, lightPink, veinMix);
    col += veinColor * totalVeins * (0.35 + env * 0.35);

    // === ORGANIC BREATHING ===
    float breath = sin(time * 0.35) * 0.5 + 0.5;
    float heartbeat = pow(max(0.0, sin(time * 0.8)), 6.0) * 0.25;
    col *= 0.85 + breath * 0.25 + heartbeat;

    // === GAZE-REACTIVE TENDRILS (dramatically enhanced) ===
    // The womb notices where you look and grows thick veins toward your gaze
    {
      float gazeAlign = max(0.0, dot(rd, uGazeDir));

      // Broad attraction field — visible across a wide cone (~60°)
      float broadField = smoothstep(0.3, 0.9, gazeAlign);

      // Focused core — bright convergence at gaze center
      float focusedCore = pow(gazeAlign, 6.0);

      // Warp the space toward gaze — pull veins in that direction
      vec3 gazeWarp = mix(rd, uGazeDir, broadField * 0.4);
      gazeWarp += vec3(
        fbm(gazeWarp * 3.0 + time * 0.1),
        fbm(gazeWarp * 3.0 + vec3(30.0) + time * 0.08),
        fbm(gazeWarp * 3.0 + vec3(60.0) - time * 0.09)
      ) * 0.2;

      // Voronoi veins that converge on the gaze point
      float gazeVeins = veins(gazeWarp * (5.0 + env * 3.0) + time * 0.1, 0.08);

      // Layer: broad organic veins flowing toward gaze
      float gazeIntensity = 0.5 + env * 0.5;
      col += paleCyan * gazeVeins * broadField * gazeIntensity * 0.7;

      // Layer: bright convergence glow at gaze center
      col += paleCyan * focusedCore * (0.3 + env * 0.4);

      // Layer: pulsing ring around gaze point
      float ring = smoothstep(0.85, 0.88, gazeAlign) - smoothstep(0.88, 0.92, gazeAlign);
      col += cyan * ring * (0.4 + 0.3 * sin(time * 2.0));
    }

    // === HAND-REACTIVE TENDRILS (dramatically enhanced) ===
    // Thick organic veins reach for each hand — much wider and brighter

    // Left hand
    if (uLeftHandActive > 0.5) {
      float lAlign = max(0.0, dot(rd, uLeftHandDir));
      float lBroad = smoothstep(0.2, 0.85, lAlign);
      float lCore = pow(lAlign, 5.0);

      vec3 lWarp = mix(rd, uLeftHandDir, lBroad * 0.35);
      lWarp += fbm(lWarp * 3.0 + time * 0.12) * 0.15;
      float lv = veins(lWarp * (5.0 + env * 2.0) + time * 0.08 + vec3(50.0), 0.09);

      float lIntensity = 0.5 + env * 0.5;
      col += lightPink * lv * lBroad * lIntensity * 0.65;
      col += lightPink * lCore * (0.3 + env * 0.4);

      // Pulsing glow at hand
      col += lightPink * pow(lAlign, 8.0) * 0.2 * (0.7 + 0.3 * sin(time * 1.5 + 1.0));
    }

    // Right hand
    if (uRightHandActive > 0.5) {
      float rAlign = max(0.0, dot(rd, uRightHandDir));
      float rBroad = smoothstep(0.2, 0.85, rAlign);
      float rCore = pow(rAlign, 5.0);

      vec3 rWarp = mix(rd, uRightHandDir, rBroad * 0.35);
      rWarp += fbm(rWarp * 3.0 + time * 0.12 + vec3(20.0)) * 0.15;
      float rv = veins(rWarp * (5.0 + env * 2.0) + time * 0.08 + vec3(80.0), 0.09);

      float rIntensity = 0.5 + env * 0.5;
      col += lightPink * rv * rBroad * rIntensity * 0.65;
      col += lightPink * rCore * (0.3 + env * 0.4);

      col += lightPink * pow(rAlign, 8.0) * 0.2 * (0.7 + 0.3 * sin(time * 1.5));
    }

    // === PROGRESSIVE ENVELOPMENT ===
    float periphery = 1.0 - abs(rd.y);
    float edgeClose = smoothstep(0.5 - env * 0.4, 0.9, periphery) * env;
    vec3 edgeColor = mix(cyan * 0.6, lightPink * 0.4, sin(time * 0.2) * 0.5 + 0.5);
    col += edgeColor * edgeClose * 0.35;

    col *= 1.0 + env * 0.3;

    // === FUSION PHASE (env > 0.75) ===
    if (fusion > 0.0) {
      float fusionPulse = pow(max(0.0, sin(time * 0.6)), 3.0);
      float fv = veins(rd * 12.0 + time * 0.12, 0.04 + (1.0 - fusion) * 0.04);
      float innerGlow = fbm(rd * 2.0 + time * 0.08) * 0.5 + 0.5;
      vec3 fColor = mix(fusionCol, lightPink, fusionPulse * 0.25);
      vec3 fResult = fColor * (fv * 0.45 + innerGlow * 0.45 + 0.2);
      fResult *= 1.0 + fusionPulse * 0.5;
      col = mix(col, fResult, fusion * 0.85);
    }

    // === FLUID CURRENT ===
    float current = fbm(rd * 2.0 + vec3(time * 0.04, time * -0.03, time * 0.05));
    col += midBlue * current * 0.12;

    // === PRESSURE PULSE ===
    float pressure = sin(time * 0.5) * 0.02 + sin(time * 0.19) * 0.015;
    col *= 1.0 + pressure;

    // === FINAL OUTPUT ===
    col *= iBrightness * iIntroProgress;
    col = mix(col, col.gbr, iColorShift * 0.3);
    col = pow(col, vec3(0.95));
    col = col / (1.0 + col);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface OceanicDissolutionShaderProps {
  speed?: number;
  brightness?: number;
  colorShift?: number;
  headRotationY?: number;
  introProgress?: number;
  audioTime?: number;
  envelopmentRef?: React.MutableRefObject<number>;
}

export function OceanicDissolutionShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0,
  envelopmentRef
}: OceanicDissolutionShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevQuatRef = useRef(new THREE.Quaternion());
  const smoothedMovementRef = useRef(0);
  const internalEnvelopmentRef = useRef(0);

  // Cached Vector3s — avoid per-frame GC pressure on Quest
  const gazeDirCache = useRef(new THREE.Vector3(0, 0, -1));
  const handDirCache = useRef(new THREE.Vector3());

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iSpeed: { value: speed },
    iBrightness: { value: brightness },
    iColorShift: { value: colorShift },
    iIntroProgress: { value: introProgress },
    iElapsedTime: { value: 0 },
    uGazeDir: { value: new THREE.Vector3(0, 0, -1) },
    uLeftHandDir: { value: new THREE.Vector3(-0.5, 0, -1).normalize() },
    uRightHandDir: { value: new THREE.Vector3(0.5, 0, -1).normalize() },
    uLeftHandActive: { value: 0 },
    uRightHandActive: { value: 0 },
    uEnvelopment: { value: 0 }
  }), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.ShaderMaterial;

    // Basic uniforms
    material.uniforms.iTime.value = state.clock.elapsedTime;
    material.uniforms.iSpeed.value = speed;
    material.uniforms.iBrightness.value = brightness;
    material.uniforms.iColorShift.value = colorShift;
    material.uniforms.iIntroProgress.value = introProgress;

    // Elapsed time tracking
    if (introProgress > 0 && startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }
    if (startTimeRef.current !== null) {
      material.uniforms.iElapsedTime.value = state.clock.elapsedTime - startTimeRef.current;
    }

    // === GAZE TRACKING (cached Vector3) ===
    state.camera.getWorldDirection(gazeDirCache.current);
    material.uniforms.uGazeDir.value.copy(gazeDirCache.current);

    // === HAND TRACKING (from XR session) ===
    let leftActive = 0;
    let rightActive = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xr = state.gl.xr as any;
    const session = xr.getSession?.();
    if (session) {
      const frame = xr.getFrame?.();
      const refSpace = xr.getReferenceSpace?.();
      if (frame && refSpace) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.inputSources.forEach((inputSource: any) => {
          if (!inputSource.gripSpace) return;
          try {
            const pose = frame.getPose(inputSource.gripSpace, refSpace);
            if (!pose) return;
            const p = pose.transform.position;
            handDirCache.current.set(p.x, p.y, p.z).normalize();
            if (inputSource.handedness === 'left') {
              material.uniforms.uLeftHandDir.value.copy(handDirCache.current);
              leftActive = 1;
            } else if (inputSource.handedness === 'right') {
              material.uniforms.uRightHandDir.value.copy(handDirCache.current);
              rightActive = 1;
            }
          } catch (_e) { /* ignore pose errors */ }
        });
      }

      // === ENVELOPMENT TRACKING (reactive push-pull + progression) ===
      const currentQuat = state.camera.quaternion;
      const angularDiff = prevQuatRef.current.angleTo(currentQuat);
      prevQuatRef.current.copy(currentQuat);

      const safeDelta = Math.max(delta, 0.001);
      const angularVelocity = angularDiff / safeDelta;

      // Smooth the movement signal
      smoothedMovementRef.current += (angularVelocity - smoothedMovementRef.current) * 0.05;
      const movement = smoothedMovementRef.current;

      // Progressive envelopment with reactive push-pull
      const baseRate = 0.003;
      const stillnessBonus = Math.max(0, 1.0 - movement * 3.0) * 0.004;
      const movementRetreat = Math.min(movement * 1.5, 0.005);

      const rate = baseRate + stillnessBonus - movementRetreat;
      internalEnvelopmentRef.current = Math.min(1.0, Math.max(0.0,
        internalEnvelopmentRef.current + rate * safeDelta
      ));

      material.uniforms.uEnvelopment.value = internalEnvelopmentRef.current;
      if (envelopmentRef) {
        envelopmentRef.current = internalEnvelopmentRef.current;
      }
    } else {
      // Desktop preview
      const elapsed = material.uniforms.iElapsedTime.value;
      const desktopEnv = Math.min(1.0, elapsed / 120.0);
      material.uniforms.uEnvelopment.value = desktopEnv;
      if (envelopmentRef) {
        envelopmentRef.current = desktopEnv;
      }
    }

    material.uniforms.uLeftHandActive.value = leftActive;
    material.uniforms.uRightHandActive.value = rightActive;
  });

  return (
    <mesh
      ref={meshRef}
      scale={[-1, 1, 1]}
      rotation={[0, -headRotationY, 0]}
    >
      <sphereGeometry args={[50, 48, 48]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
