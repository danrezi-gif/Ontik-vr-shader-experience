import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ALIEN WOMB - HR Giger inspired organic flowing environment
// Quest 3 optimized: reduced from ~605 to ~200 hash ops/fragment
// Key optimizations:
//   - 1 Voronoi (primary membrane) instead of 7
//   - Ridged noise for secondary veins, tendrils, fusion (no Voronoi)
//   - FBM reduced from 4 to 3 octaves
//   - Domain warping: 2 noise3d instead of 3 fbm
//   - Voronoi uses squared distances (skips 27 sqrt/call)
//   - mediump precision for Adreno 740
//   - Cached Vector3 allocations (no per-frame GC)
//   - Sphere 48x48 (vs 64x64)

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

  // --- Noise primitives (Quest 3 optimized) ---

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(443.897, 397.297, 491.187));
    p += dot(p.zxy, p.yxz + 19.19);
    return fract(vec3(p.x * p.y, p.y * p.z, p.z * p.x));
  }

  float hash31(vec3 p) {
    p = fract(p * vec3(443.897, 397.297, 491.187));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise3d(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  // 3-octave FBM (reduced from 4 for Quest)
  float fbm(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      val += amp * noise3d(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  // Ridged noise — creates sharp vein/ridge patterns from smooth noise
  // Much cheaper than Voronoi while giving similar organic vein appearance
  float ridged(vec3 p) {
    return 1.0 - abs(noise3d(p) * 2.0 - 1.0);
  }

  // Ridged multifractal — weighted octaves for sharper convergent ridges
  float ridgedFbm(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    float prev = 1.0;
    for (int i = 0; i < 3; i++) {
      float r = ridged(p);
      val += amp * r * prev;
      prev = r;
      p *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  // Single 3D Voronoi — only used for primary membrane (the hero pattern)
  // Optimized: uses squared distances, sqrt only final 2 values
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
      float d = dot(diff, diff); // squared distance — skip sqrt
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) { d2 = d; }
    }
    return vec2(sqrt(d1), sqrt(d2)); // sqrt only final pair
  }

  // Vein pattern from Voronoi cell edges
  float voronoiVeins(vec3 p, float edgeWidth) {
    vec2 v = voronoi(p);
    return 1.0 - smoothstep(0.0, edgeWidth, v.y - v.x);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);
    float time = iTime * iSpeed;
    float env = uEnvelopment;
    float fusion = smoothstep(0.75, 1.0, env);

    // === DOMAIN WARPING (2 noise3d instead of 3 fbm — 6x cheaper) ===
    vec3 wrd = rd;
    float w1 = noise3d(rd * 2.5 + time * 0.04);
    float w2 = noise3d(rd * 2.5 + vec3(100.0) + time * 0.03);
    wrd += vec3(w1, w2, w1 * w2) * (0.2 + env * 0.1);

    // === PRIMARY MEMBRANE: single Voronoi call (hero visual) ===
    float s1 = 3.0 + env * 2.0;
    float v1 = voronoiVeins(wrd * s1 + time * 0.06, 0.12 - env * 0.04);

    // === MEDIUM DETAIL: ridged noise (replaces 2nd Voronoi) ===
    float v2 = ridgedFbm(wrd * (6.0 + env * 3.0) - time * 0.04 + vec3(50.0));

    // === FINE CAPILLARIES: ridged noise (replaces 3rd Voronoi) ===
    float v3 = 0.0;
    if (env > 0.3) {
      float fineFade = smoothstep(0.3, 0.6, env);
      v3 = ridgedFbm(wrd * (12.0 + env * 4.0) + time * 0.08 + vec3(100.0)) * fineFade;
    }

    float totalVeins = v1 * 0.5 + v2 * 0.3 + v3 * 0.3;

    // === COLOR PALETTE: deep blue / cyan / light pink ===
    vec3 deepBlue  = vec3(0.015, 0.03, 0.10);
    vec3 midBlue   = vec3(0.04, 0.08, 0.22);
    vec3 cyan      = vec3(0.08, 0.55, 0.75);
    vec3 lightPink = vec3(0.85, 0.45, 0.55);
    vec3 paleCyan  = vec3(0.35, 0.80, 0.90);
    vec3 fusionCol = vec3(0.30, 0.70, 0.85);

    // Base color — single noise3d instead of fbm
    float viewGrad = rd.y * 0.5 + 0.5;
    vec3 col = mix(deepBlue, midBlue, viewGrad * 0.4 + noise3d(rd * 1.5) * 0.25);

    // Vein coloring — single noise3d instead of fbm
    float veinMix = noise3d(wrd * 4.0 + time * 0.02) * 0.7 + 0.15;
    vec3 veinColor = mix(cyan, lightPink, veinMix);
    col += veinColor * totalVeins * (0.35 + env * 0.35);

    // === ORGANIC BREATHING ===
    float breath = sin(time * 0.35) * 0.5 + 0.5;
    float heartbeat = pow(max(0.0, sin(time * 0.8)), 6.0) * 0.25;
    col *= 0.85 + breath * 0.25 + heartbeat;

    // === GAZE-REACTIVE TENDRILS (ridged noise, no Voronoi) ===
    float gazeAlign = max(0.0, dot(rd, uGazeDir));
    float gazeInfluence = pow(gazeAlign, 3.0) * (0.3 + env * 0.5);

    if (gazeInfluence > 0.02) {
      // Simplified warp: 1 noise3d instead of 3 fbm
      vec3 gazeWarp = rd + (uGazeDir - rd) * gazeInfluence * 0.3;
      gazeWarp += noise3d(gazeWarp * 3.0 + time * 0.08) * 0.15;
      float gv = ridgedFbm(gazeWarp * (8.0 + env * 4.0) + time * 0.12);
      col += paleCyan * gv * gazeInfluence * 0.65;
      col += paleCyan * pow(gazeAlign, 8.0) * 0.15 * (0.5 + env);
    }

    // === HAND-REACTIVE TENDRILS (ridged noise, no Voronoi) ===

    // Left hand
    if (uLeftHandActive > 0.5) {
      float lAlign = max(0.0, dot(rd, uLeftHandDir));
      float lInfluence = pow(lAlign, 3.0) * (0.4 + env * 0.4);
      if (lInfluence > 0.02) {
        vec3 lWarp = rd + (uLeftHandDir - rd) * lInfluence * 0.3;
        lWarp += noise3d(lWarp * 3.0 + time * 0.1) * 0.1;
        float lv = ridgedFbm(lWarp * (7.0 + env * 3.0) + time * 0.1 + vec3(50.0));
        col += lightPink * lv * lInfluence * 0.55;
        col += lightPink * pow(lAlign, 10.0) * 0.12;
      }
    }

    // Right hand
    if (uRightHandActive > 0.5) {
      float rAlign = max(0.0, dot(rd, uRightHandDir));
      float rInfluence = pow(rAlign, 3.0) * (0.4 + env * 0.4);
      if (rInfluence > 0.02) {
        vec3 rWarp = rd + (uRightHandDir - rd) * rInfluence * 0.3;
        rWarp += noise3d(rWarp * 3.0 + time * 0.1 + vec3(20.0)) * 0.1;
        float rv = ridgedFbm(rWarp * (7.0 + env * 3.0) + time * 0.1 + vec3(80.0));
        col += lightPink * rv * rInfluence * 0.55;
        col += lightPink * pow(rAlign, 10.0) * 0.12;
      }
    }

    // === PROGRESSIVE ENVELOPMENT ===
    float periphery = 1.0 - abs(rd.y);
    float edgeClose = smoothstep(0.5 - env * 0.4, 0.9, periphery) * env;
    vec3 edgeColor = mix(cyan * 0.6, lightPink * 0.4, sin(time * 0.2) * 0.5 + 0.5);
    col += edgeColor * edgeClose * 0.35;

    // Overall intensity increases with closeness
    col *= 1.0 + env * 0.3;

    // === FUSION PHASE (ridged noise + noise3d, no Voronoi) ===
    if (fusion > 0.0) {
      float fusionPulse = pow(max(0.0, sin(time * 0.6)), 3.0);
      float fv = ridgedFbm(rd * 15.0 + time * 0.15);
      float innerGlow = noise3d(rd * 2.0 + time * 0.08) * 0.5 + 0.5;
      vec3 fColor = mix(fusionCol, lightPink, fusionPulse * 0.25);
      vec3 fResult = fColor * (fv * 0.45 + innerGlow * 0.45 + 0.2);
      fResult *= 1.0 + fusionPulse * 0.5;
      col = mix(col, fResult, fusion * 0.85);
    }

    // === FLUID CURRENT (single noise3d instead of fbm) ===
    float current = noise3d(rd * 2.0 + vec3(time * 0.04, time * -0.03, time * 0.05));
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
            // Reuse cached Vector3 — no allocation per frame
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

      // Smooth the movement signal to avoid jitter
      smoothedMovementRef.current += (angularVelocity - smoothedMovementRef.current) * 0.05;
      const movement = smoothedMovementRef.current;

      // Progressive envelopment with reactive push-pull:
      // - Base rate always moves forward
      // - Still → closes in faster (stillness bonus)
      // - Moving → retreats (movement penalty)
      // - Net positive so it always eventually reaches 1.0
      const baseRate = 0.003;    // ~5.5 min to full if neutral
      const stillnessBonus = Math.max(0, 1.0 - movement * 3.0) * 0.004;
      const movementRetreat = Math.min(movement * 1.5, 0.005);

      const rate = baseRate + stillnessBonus - movementRetreat;
      internalEnvelopmentRef.current = Math.min(1.0, Math.max(0.0,
        internalEnvelopmentRef.current + rate * safeDelta
      ));

      material.uniforms.uEnvelopment.value = internalEnvelopmentRef.current;

      // Share with external ref for hand rendering (energy wisps)
      if (envelopmentRef) {
        envelopmentRef.current = internalEnvelopmentRef.current;
      }
    } else {
      // Desktop preview: use elapsed time for gentle envelopment demo
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
