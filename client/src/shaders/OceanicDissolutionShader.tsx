import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ALIEN WOMB - Plasma ball reimagining
// Palette: deep void / electric blue / cyan / magenta / white
// Initial state: attenuated womb lit only by plasma beams
// 20 plasma beams emerge via gaze/hand interaction + time
// After 20 beams: explosion of light → return to gallery

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
  uniform vec3  uGazeDir;
  uniform vec3  uLeftHandDir;
  uniform vec3  uRightHandDir;
  uniform float uLeftHandActive;
  uniform float uRightHandActive;
  uniform float uEnvelopment;

  // Beam system
  uniform float uActiveBeams;
  uniform vec3  uBeamDirs[20];
  uniform float uBeamBirthTimes[20];
  uniform float uExplosionProgress;

  varying vec3 vWorldPosition;

  // --- Noise primitives (Quest 3 optimised) ---

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
      f.z);
  }

  // Ridged noise — sharp vein/ridge patterns (cheaper than a 2nd Voronoi)
  float ridged(vec3 p) {
    return 1.0 - abs(noise3d(p) * 2.0 - 1.0);
  }

  // Ridged multifractal — 3 octaves
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

  // Single Voronoi — hero pattern
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
    float env  = uEnvelopment;

    // === DOMAIN WARPING (2 noise3d — performance balance) ===
    vec3 wrd = rd;
    float w1 = noise3d(rd * 2.5 + time * 0.04);
    float w2 = noise3d(rd * 2.5 + vec3(100.0) + time * 0.03);
    wrd += vec3(w1, w2, w1 * w2) * (0.2 + env * 0.1);

    // === ORGANIC VEIN PATTERNS (single Voronoi + ridgedFbm) ===
    float v1 = veins(wrd * (3.0 + env * 2.0) + time * 0.06, 0.12 - env * 0.04);
    float v2 = ridgedFbm(wrd * (6.0 + env * 3.0) - time * 0.04 + vec3(50.0));
    float v3 = 0.0;
    if (env > 0.3) {
      float fineFade = smoothstep(0.3, 0.6, env);
      v3 = ridgedFbm(wrd * (12.0 + env * 4.0) + time * 0.08 + vec3(100.0)) * fineFade;
    }
    float totalVeins = v1 * 0.55 + v2 * 0.3 + v3 * 0.2;

    // === PLASMA BALL PALETTE ===
    vec3 deepVoid    = vec3(0.0,  0.004, 0.018);
    vec3 darkBase    = vec3(0.0,  0.010, 0.050);
    vec3 plasmaBlue  = vec3(0.05, 0.30,  1.0);
    vec3 plasmaCyan  = vec3(0.0,  0.85,  1.0);
    vec3 plasmaMag   = vec3(0.80, 0.05,  1.0);
    vec3 plasmaWhite = vec3(0.75, 0.92,  1.0);

    // Base — near-black plasma void
    float viewGrad = rd.y * 0.5 + 0.5;
    vec3 col = mix(deepVoid, darkBase, viewGrad * 0.4 + noise3d(rd * 1.5) * 0.15);

    // Vein colouring — plasma blue/cyan/magenta mix
    float vm1 = noise3d(wrd * 4.0 + time * 0.02);
    float vm2 = noise3d(wrd * 3.0 + time * 0.01 + vec3(30.0));
    vec3 veinColor = mix(plasmaBlue, plasmaCyan, vm1 * 0.7);
    veinColor = mix(veinColor, plasmaMag, vm2 * 0.35);
    col += veinColor * totalVeins * (0.2 + env * 0.25);

    // === ORGANIC BREATHING ===
    float breath    = sin(time * 0.35) * 0.5 + 0.5;
    float heartbeat = pow(max(0.0, sin(time * 0.8)), 6.0) * 0.25;
    col *= 0.85 + breath * 0.25 + heartbeat;

    // === GAZE-REACTIVE VEINS (plasma cyan) ===
    {
      float gazeAlign  = max(0.0, dot(rd, uGazeDir));
      float broadField = smoothstep(0.3, 0.9, gazeAlign);
      float focusCore  = pow(gazeAlign, 6.0);

      vec3 gazeWarp = mix(rd, uGazeDir, broadField * 0.4);
      gazeWarp += noise3d(gazeWarp * 3.0 + time * 0.1) * 0.15;

      float gv = ridgedFbm(gazeWarp * (5.0 + env * 3.0) + time * 0.1);
      float gazeIntensity = 0.5 + env * 0.5;

      col += plasmaCyan * gv * broadField * gazeIntensity * 0.5;
      col += plasmaCyan * focusCore * (0.2 + env * 0.3);

      float ring = smoothstep(0.85, 0.88, gazeAlign) - smoothstep(0.88, 0.92, gazeAlign);
      col += plasmaCyan * ring * (0.3 + 0.25 * sin(time * 2.0));
    }

    // === HAND-REACTIVE VEINS (plasma magenta) ===
    if (uLeftHandActive > 0.5) {
      float lAlign = max(0.0, dot(rd, uLeftHandDir));
      float lBroad = smoothstep(0.2, 0.85, lAlign);
      float lCore  = pow(lAlign, 5.0);
      vec3  lWarp  = mix(rd, uLeftHandDir, lBroad * 0.35);
      lWarp += noise3d(lWarp * 3.0 + time * 0.12) * 0.12;
      float lv = ridgedFbm(lWarp * (5.0 + env * 2.0) + time * 0.08 + vec3(50.0));
      col += plasmaMag * lv * lBroad * (0.4 + env * 0.4) * 0.55;
      col += plasmaMag * lCore * (0.2 + env * 0.3);
      col += plasmaMag * pow(lAlign, 8.0) * 0.15 * (0.7 + 0.3 * sin(time * 1.5 + 1.0));
    }
    if (uRightHandActive > 0.5) {
      float rAlign = max(0.0, dot(rd, uRightHandDir));
      float rBroad = smoothstep(0.2, 0.85, rAlign);
      float rCore  = pow(rAlign, 5.0);
      vec3  rWarp  = mix(rd, uRightHandDir, rBroad * 0.35);
      rWarp += noise3d(rWarp * 3.0 + time * 0.12 + vec3(20.0)) * 0.12;
      float rv = ridgedFbm(rWarp * (5.0 + env * 2.0) + time * 0.08 + vec3(80.0));
      col += plasmaMag * rv * rBroad * (0.4 + env * 0.4) * 0.55;
      col += plasmaMag * rCore * (0.2 + env * 0.3);
      col += plasmaMag * pow(rAlign, 8.0) * 0.15 * (0.7 + 0.3 * sin(time * 1.5));
    }

    // === PROGRESSIVE ENVELOPMENT ===
    float periphery = 1.0 - abs(rd.y);
    float edgeClose = smoothstep(0.5 - env * 0.4, 0.9, periphery) * env;
    vec3  edgeColor = mix(plasmaCyan * 0.5, plasmaMag * 0.4, sin(time * 0.2) * 0.5 + 0.5);
    col += edgeColor * edgeClose * 0.3;
    col *= 1.0 + env * 0.25;

    // === FUSION PHASE (env > 0.75) ===
    float fusion = smoothstep(0.75, 1.0, env);
    if (fusion > 0.0) {
      float fusionPulse = pow(max(0.0, sin(time * 0.6)), 3.0);
      float fv       = veins(rd * 12.0 + time * 0.12, 0.04 + (1.0 - fusion) * 0.04);
      float innerGlow = noise3d(rd * 2.0 + time * 0.08) * 0.5 + 0.5;
      vec3  fColor   = mix(plasmaBlue, plasmaCyan, fusionPulse * 0.3);
      vec3  fResult  = fColor * (fv * 0.45 + innerGlow * 0.45 + 0.2);
      fResult *= 1.0 + fusionPulse * 0.5;
      col = mix(col, fResult, fusion * 0.85);
    }

    // === FLUID CURRENT ===
    float current = noise3d(rd * 2.0 + vec3(time * 0.04, time * -0.03, time * 0.05));
    col += darkBase * current * 0.1;

    // === WOMB ATTENUATION — dim initially, brightens as beams accumulate ===
    float wombBright = 0.1 + 0.9 * (uActiveBeams / 20.0);
    col *= wombBright;

    // === PLASMA BEAMS ===
    // Each beam: a narrow plasma bolt from a womb-surface point toward the viewer
    for (int i = 0; i < 20; i++) {
      if (float(i) >= uActiveBeams) break;

      vec3  bDir  = normalize(uBeamDirs[i]);
      float age   = iTime - uBeamBirthTimes[i];
      float fadeIn = smoothstep(0.0, 2.0, age);

      float al = max(0.0, dot(rd, bDir));

      // Sinusoidal wiggle — cheap plasma bolt texture (no noise lookup)
      float wigX = sin(rd.y * 40.0 + iTime * 7.0 + float(i) * 3.7) * 0.016;
      float wigY = sin(rd.x * 40.0 + iTime * 6.5 + float(i) * 4.2) * 0.016;
      float wAl  = max(0.0, dot(rd + vec3(wigX, wigY, 0.0), bDir));

      // Narrow core (lightning-bright)
      float core = pow(wAl, 80.0) * 5.0;
      // Mid glow (cyan halo)
      float mid  = pow(al, 16.0) * 0.8;
      // Wide scatter (faint blue atmosphere)
      float wide = pow(al,  5.0) * 0.12;

      // Pulsing electric flicker
      float flicker = 0.6 + 0.4 * sin(iTime * 5.0 + float(i) * 2.3 + age * 4.0);

      // Colour: white core → cyan mid → blue wide
      vec3 bCol = core * plasmaWhite + mid * plasmaCyan + wide * plasmaBlue;

      col += bCol * flicker * fadeIn;
    }

    // === PRESSURE PULSE ===
    float pressure = sin(time * 0.5) * 0.02 + sin(time * 0.19) * 0.015;
    col *= 1.0 + pressure;

    // === EXPLOSION EFFECT ===
    if (uExplosionProgress > 0.0) {
      float ep = uExplosionProgress;

      // Phase 0→0.4: shockwave ring expands outward
      float shockRing = exp(-pow((ep - 0.25) * 7.0, 2.0)) * 4.0;
      col += mix(plasmaCyan, plasmaWhite, ep) * shockRing;

      // Phase 0.25→0.8: plasma fills the space
      float fill = smoothstep(0.25, 0.75, ep);
      vec3 fillColor = mix(plasmaBlue * 2.0, plasmaWhite * 3.0, ep);
      col = mix(col, fillColor, fill * 0.9);

      // Phase 0.7→1.0: pure white out
      float whiteOut = smoothstep(0.65, 1.0, ep);
      col = mix(col, vec3(3.0), whiteOut);
    }

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
  onExperienceComplete?: () => void;
}

const MAX_BEAMS = 20;

// Interval (seconds) before next auto beam fires, indexed by current beam count
const AUTO_BEAM_INTERVALS = [
  6, 10, 10, 9, 8,   // beams 0-4  (~43s)
  8,  7,  7, 6, 6,   // beams 5-9  (~34s)
  5,  5,  5, 4, 4,   // beams 10-14 (~23s)
  4, 3.5, 3, 2.5, 2  // beams 15-19 (~15s)
]; // total pure-auto: ~115s ≈ 1:55; interaction makes it faster

export function OceanicDissolutionShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0,
  envelopmentRef,
  onExperienceComplete
}: OceanicDissolutionShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevQuatRef = useRef(new THREE.Quaternion());
  const smoothedMovementRef = useRef(0);
  const internalEnvelopmentRef = useRef(0);

  // Beam state
  const beamCountRef = useRef(0);
  const beamDirsRef  = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_BEAMS }, () => new THREE.Vector3())
  );
  const beamBirthTimesRef = useRef<number[]>(new Array(MAX_BEAMS).fill(0));

  // Gaze-hold beam trigger
  const gazeHoldDirRef   = useRef(new THREE.Vector3(0, 0, -1));
  const gazeHoldStartRef = useRef(0); // clock time when we started holding

  // Auto-beam timer
  const beamTimerRef = useRef(AUTO_BEAM_INTERVALS[0]);

  // Explosion
  const explosionStartRef = useRef<number | null>(null);
  const completionCalledRef = useRef(false);

  // Cached Vector3s — avoid per-frame GC on Quest
  const gazeDirCache = useRef(new THREE.Vector3(0, 0, -1));
  const handDirCache = useRef(new THREE.Vector3());

  const uniforms = useMemo(() => ({
    iTime:           { value: 0 },
    iSpeed:          { value: speed },
    iBrightness:     { value: brightness },
    iColorShift:     { value: colorShift },
    iIntroProgress:  { value: introProgress },
    iElapsedTime:    { value: 0 },
    uGazeDir:        { value: new THREE.Vector3(0, 0, -1) },
    uLeftHandDir:    { value: new THREE.Vector3(-0.5, 0, -1).normalize() },
    uRightHandDir:   { value: new THREE.Vector3( 0.5, 0, -1).normalize() },
    uLeftHandActive: { value: 0 },
    uRightHandActive:{ value: 0 },
    uEnvelopment:    { value: 0 },
    // Beam system
    uActiveBeams:    { value: 0 },
    uBeamDirs:       { value: Array.from({ length: MAX_BEAMS }, () => new THREE.Vector3()) },
    uBeamBirthTimes: { value: Array.from({ length: MAX_BEAMS }, () => 0) },
    uExplosionProgress: { value: 0 }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.ShaderMaterial;

    // Basic uniforms
    mat.uniforms.iTime.value        = state.clock.elapsedTime;
    mat.uniforms.iSpeed.value       = speed;
    mat.uniforms.iBrightness.value  = brightness;
    mat.uniforms.iColorShift.value  = colorShift;
    mat.uniforms.iIntroProgress.value = introProgress;

    // Elapsed time from intro start
    if (introProgress > 0 && startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }
    const elapsed = startTimeRef.current !== null
      ? state.clock.elapsedTime - startTimeRef.current
      : 0;
    mat.uniforms.iElapsedTime.value = elapsed;

    // === GAZE ===
    state.camera.getWorldDirection(gazeDirCache.current);
    mat.uniforms.uGazeDir.value.copy(gazeDirCache.current);

    // Safe delta — used for both envelopment and beam timer
    const safeDelta = Math.max(delta, 0.001);

    // === HANDS ===
    let leftActive  = 0;
    let rightActive = 0;
    const xr      = state.gl.xr as { getSession?: () => unknown; getFrame?: () => unknown; getReferenceSpace?: () => unknown };
    const session = xr.getSession?.() as { inputSources: { handedness: string; gripSpace?: unknown }[] } | undefined;

    if (session) {
      const frame    = (xr.getFrame?.() as { getPose?: (a: unknown, b: unknown) => { transform: { position: { x: number; y: number; z: number } } } | null });
      const refSpace = xr.getReferenceSpace?.();
      if (frame && refSpace) {
        session.inputSources.forEach((src) => {
          if (!src.gripSpace) return;
          try {
            const pose = frame.getPose?.(src.gripSpace, refSpace);
            if (!pose) return;
            const p = pose.transform.position;
            handDirCache.current.set(p.x, p.y, p.z).normalize();
            if (src.handedness === 'left') {
              mat.uniforms.uLeftHandDir.value.copy(handDirCache.current);
              leftActive = 1;
            } else if (src.handedness === 'right') {
              mat.uniforms.uRightHandDir.value.copy(handDirCache.current);
              rightActive = 1;
            }
          } catch { /* ignore pose errors */ }
        });
      }

      // === ENVELOPMENT ===
      const currentQuat = state.camera.quaternion;
      const angularDiff = prevQuatRef.current.angleTo(currentQuat);
      prevQuatRef.current.copy(currentQuat);
      const angVel = angularDiff / safeDelta;
      smoothedMovementRef.current += (angVel - smoothedMovementRef.current) * 0.05;
      const mv = smoothedMovementRef.current;
      const rate = 0.003
        + Math.max(0, 1.0 - mv * 3.0) * 0.004
        - Math.min(mv * 1.5, 0.005);
      internalEnvelopmentRef.current = Math.min(1.0, Math.max(0.0,
        internalEnvelopmentRef.current + rate * safeDelta
      ));
      mat.uniforms.uEnvelopment.value = internalEnvelopmentRef.current;
      if (envelopmentRef) envelopmentRef.current = internalEnvelopmentRef.current;
    } else {
      // Desktop preview
      const desktopEnv = Math.min(1.0, elapsed / 120.0);
      mat.uniforms.uEnvelopment.value = desktopEnv;
      if (envelopmentRef) envelopmentRef.current = desktopEnv;
    }

    mat.uniforms.uLeftHandActive.value  = leftActive;
    mat.uniforms.uRightHandActive.value = rightActive;

    // === BEAM ACCUMULATION ===
    // Only accumulate after intro progress is underway
    if (introProgress > 0.3 && explosionStartRef.current === null) {
      const clockNow  = state.clock.elapsedTime;
      const gazeDir   = mat.uniforms.uGazeDir.value as THREE.Vector3;
      const count     = beamCountRef.current;

      // Helper: add a beam in a direction (with gentle spread)
      const doAddBeam = (dir: THREE.Vector3) => {
        const c = beamCountRef.current;
        if (c >= MAX_BEAMS) return;
        const spread = 0.18;
        const bx = dir.x + (Math.random() - 0.5) * spread;
        const by = dir.y + (Math.random() - 0.5) * spread * 0.5;
        const bz = dir.z + (Math.random() - 0.5) * spread;
        const len = Math.sqrt(bx * bx + by * by + bz * bz);
        beamDirsRef.current[c].set(bx / len, by / len, bz / len);
        beamBirthTimesRef.current[c] = clockNow;
        mat.uniforms.uBeamDirs.value[c].set(bx / len, by / len, bz / len);
        mat.uniforms.uBeamBirthTimes.value[c] = clockNow;
        beamCountRef.current++;
        mat.uniforms.uActiveBeams.value = beamCountRef.current;
      };

      if (count < MAX_BEAMS) {
        // Determine timer speed:
        //   1× if user is moving head
        //   2× if gaze held steady
        //   3× if gaze held AND a hand is pointed toward womb
        const holdDot    = gazeDir.dot(gazeHoldDirRef.current);
        const gazeHeld   = holdDot > 0.97;
        const handPointed = (leftActive > 0 || rightActive > 0);

        let timerSpeed = 1.0;
        if (gazeHeld) {
          timerSpeed = 2.0;
          if (handPointed) timerSpeed = 3.0;
        }

        if (!gazeHeld) {
          // User moved — update hold reference direction
          gazeHoldDirRef.current.copy(gazeDir);
          gazeHoldStartRef.current = clockNow;
        }

        // Count down beam timer
        beamTimerRef.current -= safeDelta * timerSpeed;

        if (beamTimerRef.current <= 0) {
          doAddBeam(gazeDir);
          const nextCount = beamCountRef.current;
          const nextInterval = nextCount < AUTO_BEAM_INTERVALS.length
            ? AUTO_BEAM_INTERVALS[nextCount]
            : 2.0;
          beamTimerRef.current = nextInterval;
        }
      }

      // Check if all beams placed — start explosion
      if (beamCountRef.current >= MAX_BEAMS && explosionStartRef.current === null) {
        explosionStartRef.current = clockNow;
      }
    }

    // === EXPLOSION SEQUENCE ===
    if (explosionStartRef.current !== null) {
      const expElapsed   = state.clock.elapsedTime - explosionStartRef.current;
      const expDuration  = 4.0;
      const expProgress  = Math.min(1.0, expElapsed / expDuration);
      mat.uniforms.uExplosionProgress.value = expProgress;

      if (expElapsed > expDuration + 0.8 && !completionCalledRef.current) {
        completionCalledRef.current = true;
        onExperienceComplete?.();
      }
    }
  });

  // Suppress audioTime warning — it's an unused prop kept for API consistency
  void audioTime;

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
