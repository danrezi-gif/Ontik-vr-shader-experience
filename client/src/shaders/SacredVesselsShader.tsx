import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform float iBrightness;
  uniform float iIntroProgress;
  uniform float iColorShift;
  uniform float iAudioTime;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Smooth noise function
  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0;
    return mix(
      mix(hash(n), hash(n + 1.0), f.x),
      mix(hash(n + 57.0), hash(n + 58.0), f.x),
      f.y
    );
  }

  // Fractal noise for organic flow
  float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p *= 2.02;
    f += 0.2500 * noise(p); p *= 2.03;
    f += 0.1250 * noise(p); p *= 2.01;
    f += 0.0625 * noise(p);
    return f / 0.9375;
  }

  // Sparkle function
  float sparkle(vec2 p, float t) {
    float s = hash2(floor(p * 50.0));
    float phase = s * 6.28 + t * (2.0 + s * 3.0);
    float brightness = pow(sin(phase) * 0.5 + 0.5, 8.0);
    return brightness * step(0.97, s);
  }

  void main() {
    vec3 rd = normalize(vWorldPosition);

    // Convert to spherical coordinates for full 360 view
    float theta = atan(rd.z, rd.x);
    float phi = asin(rd.y);

    // UV mapping on sphere
    vec2 uv = vec2(theta / 3.14159, phi / 1.5708);

    vec3 col = vec3(0.0);

    // Time for animation
    float t = iTime * 0.15;

    // === ASCENDING MOVEMENT ===
    float ascentSpeed = iTime * 0.08;
    float ascentY = uv.y + ascentSpeed;

    // === ORGANIC WATERY LIGHT STREAMS ===
    float numColumns = 5.0;

    for(float i = 0.0; i < 5.0; i++) {
      float columnAngle = (i / numColumns) * 6.28318 + 0.5;
      float columnX = columnAngle / 3.14159;

      // Distance from column center - with organic wobble
      float wobble = sin(ascentY * 3.0 + i * 2.0 + iTime * 0.5) * 0.02;
      float dx = abs(uv.x - columnX + 1.0 + wobble);
      dx = min(dx, abs(uv.x - columnX + wobble));
      dx = min(dx, abs(uv.x - columnX - 1.0 + wobble));

      // Column width varies with flow
      float columnWidth = 0.08 + 0.03 * sin(i * 2.5 + iTime * 0.3);

      float columnMask = smoothstep(columnWidth, 0.0, dx);

      // === MORE ORGANIC, WATERY PARTICLES ===
      float particles = 0.0;

      for(float j = 0.0; j < 4.0; j++) {
        float scale = 6.0 + j * 3.0;
        float speed = t * (1.2 + j * 0.4);

        // Flowing, organic UV with turbulence
        vec2 flowOffset = vec2(
          fbm(vec2(uv.y * 2.0 + iTime * 0.2, i)) * 0.3,
          0.0
        );

        vec2 particleUV = vec2(
          uv.x * scale + i * 3.7 + flowOffset.x,
          ascentY * scale * 2.0 - speed
        );

        // Multiple noise layers for water-like flow
        float n1 = noise(particleUV);
        float n2 = noise(particleUV * 1.5 + vec2(iTime * 0.1, 0.0));
        float n = mix(n1, n2, 0.5);

        // Softer, more fluid particles
        float particle = smoothstep(0.5, 0.75, n);

        // Vertical streaking - water drips
        float streak = noise(vec2(uv.x * 40.0 + i * 7.0, ascentY * 4.0 - speed * 2.5));
        streak = smoothstep(0.4, 0.9, streak);

        // Water ripple effect
        float ripple = sin(ascentY * 30.0 - iTime * 3.0 + i) * 0.5 + 0.5;
        ripple = pow(ripple, 3.0);

        particles += (particle * 0.5 + streak * 0.3 + ripple * 0.2) / (1.0 + j * 0.4);
      }

      // Sparkles - scattered bright points
      float sparkles = sparkle(vec2(uv.x + i, ascentY), iTime);
      particles += sparkles * 2.0;

      // Central glow
      float centerGlow = exp(-dx * dx * 600.0) * 2.0;

      float intensity = columnMask * particles + centerGlow;

      // Vertical gradient
      float verticalGrad = smoothstep(-1.0, 0.3, uv.y);
      intensity *= verticalGrad;

      // Ethereal blue-white color with subtle variation
      vec3 streamColor = vec3(0.55 + 0.1 * sin(i), 0.75, 1.0);
      vec3 coreColor = vec3(1.0, 1.0, 1.0);
      float coreMix = exp(-dx * dx * 1500.0);

      vec3 finalColor = mix(streamColor, coreColor, coreMix);
      col += finalColor * intensity * 0.45;
    }

    // Luminous presence above
    float figureY = 0.4 + ascentSpeed * 0.3;
    float figureY_clamped = mod(figureY + 1.0, 2.0) - 1.0;

    float centerDist = length(vec2(uv.x, (uv.y - figureY_clamped) * 0.5));
    float presence = exp(-centerDist * centerDist * 6.0) * 0.7;

    float headY = uv.y - figureY_clamped - 0.25;
    float headDist = length(vec2(uv.x * 1.5, headY));
    float head = exp(-headDist * headDist * 40.0) * 0.9;

    float armSpread = abs(uv.x) * 2.0;
    float armY = uv.y - figureY_clamped + 0.1 - armSpread * 0.3;
    float arms = exp(-armY * armY * 15.0) * smoothstep(0.5, 0.1, abs(uv.y - figureY_clamped + 0.1));
    arms *= smoothstep(0.0, 0.3, abs(uv.x)) * smoothstep(0.5, 0.2, abs(uv.x));

    float figureGlow = presence + head + arms * 0.5;
    vec3 figureColor = vec3(0.95, 0.98, 1.0);
    col += figureColor * figureGlow;

    // Light rays from above
    float rays = 0.0;
    for(float k = 0.0; k < 5.0; k++) {
      float rayAngle = (k / 5.0) * 6.28318 + ascentSpeed * 0.2;
      float rayX = sin(rayAngle) * 0.15;
      float rayDist = abs(uv.x - rayX);
      float ray = exp(-rayDist * rayDist * 200.0);
      ray *= smoothstep(-0.5, 0.8, uv.y);
      ray *= (0.5 + 0.5 * sin(ascentY * 20.0 + k * 2.0));
      rays += ray * 0.15;
    }
    col += vec3(0.8, 0.9, 1.0) * rays;

    // === VERTICAL SEAM COVERAGE - STRONGER ===
    float seamDist = min(abs(uv.x - 1.0), abs(uv.x + 1.0));
    float seamFog = smoothstep(0.25, 0.0, seamDist); // Wider coverage
    vec3 seamFogColor = vec3(0.01, 0.02, 0.04);
    col = mix(col, seamFogColor, seamFog * 0.95); // Stronger blend

    // === GOLDEN PHASES ===
    float phase1Start = 143.0;
    float phase1End = 173.0;
    float phase2Start = 183.0;
    float phase2End = 210.0;
    float phase3Start = 220.0; // Cathedral effect

    float timeSinceTrigger = iAudioTime - phase1Start;

    // Phase 1: First golden emergence (143s - 173s)
    if (iAudioTime > phase1Start && iAudioTime < phase1End) {
      float fadeIn = smoothstep(0.0, 8.0, iAudioTime - phase1Start);
      float fadeOut = 1.0 - smoothstep(phase1End - 8.0, phase1End, iAudioTime);
      float presenceIntensity = fadeIn * fadeOut;

      float goldenY = smoothstep(-0.5, 0.8, uv.y);
      float goldenCenter = exp(-length(vec2(uv.x * 0.5, uv.y - 0.3)) * 1.5);
      float wave = sin(length(vec2(uv.x, uv.y)) * 8.0 - iTime * 2.0) * 0.5 + 0.5;
      float breath = sin(iTime * 0.8) * 0.3 + 0.7;

      float goldenAmount = (goldenY * 0.5 + goldenCenter * 0.8 + wave * 0.2) * presenceIntensity * breath;

      vec3 goldenColor = vec3(1.0, 0.85, 0.4);
      vec3 whiteCore = vec3(1.0, 0.98, 0.9);
      vec3 divineGold = mix(goldenColor, whiteCore, goldenCenter * presenceIntensity);

      col += divineGold * goldenAmount * 2.0;
      col = mix(col, col * vec3(1.2, 1.1, 0.8), presenceIntensity * 0.5);
    }

    // Phase 2: Second golden emergence with rays and lens flare (183s - 210s)
    if (iAudioTime > phase2Start && iAudioTime < phase2End) {
      float fadeIn = smoothstep(0.0, 6.0, iAudioTime - phase2Start);
      float fadeOut = 1.0 - smoothstep(phase2End - 6.0, phase2End, iAudioTime);
      float intensity2 = fadeIn * fadeOut;

      // Strong golden light from above
      float topGlow = smoothstep(0.3, 1.0, uv.y) * intensity2;

      // Golden rays from top
      float goldenRays = 0.0;
      for(float r = 0.0; r < 8.0; r++) {
        float rayAngle = r * 0.785 + iTime * 0.1; // 8 rays, slowly rotating
        float rayX = sin(rayAngle) * (0.1 + 0.2 * (1.0 - uv.y));
        float rayDist = abs(uv.x - rayX);
        float ray = exp(-rayDist * rayDist * 150.0) * smoothstep(0.2, 0.9, uv.y);
        goldenRays += ray;
      }

      // Lens flare at top center
      float flareDist = length(vec2(uv.x, uv.y - 0.85));
      float flareCore = exp(-flareDist * flareDist * 80.0);
      float flareRing = exp(-abs(flareDist - 0.1) * 30.0) * 0.5;
      float flareRing2 = exp(-abs(flareDist - 0.2) * 20.0) * 0.3;
      float lensFlare = flareCore + flareRing + flareRing2;

      // Striking golden color
      vec3 intenseGold = vec3(1.0, 0.9, 0.5);
      vec3 pureWhite = vec3(1.0, 1.0, 0.95);

      col += intenseGold * topGlow * 1.5;
      col += intenseGold * goldenRays * intensity2 * 0.8;
      col += mix(intenseGold, pureWhite, 0.7) * lensFlare * intensity2 * 2.5;

      // Tint scene golden
      col = mix(col, col * vec3(1.3, 1.15, 0.85), intensity2 * 0.6);
    }

    // Phase 3: Cathedral stained glass effect (220s+)
    if (iAudioTime > phase3Start) {
      float fadeIn = smoothstep(0.0, 10.0, iAudioTime - phase3Start);

      // Colored light rays bouncing - stained glass effect
      vec3 vitralCol = vec3(0.0);

      for(float v = 0.0; v < 6.0; v++) {
        float angle = v * 1.047 + iTime * 0.05; // 6 colored rays
        float rayX = sin(angle + uv.y * 0.5) * 0.3;
        float rayDist = abs(uv.x - rayX);
        float ray = exp(-rayDist * rayDist * 50.0);

        // Different colors for each ray - cathedral glass colors
        vec3 rayColor;
        if (v < 1.0) rayColor = vec3(0.9, 0.2, 0.3); // Ruby
        else if (v < 2.0) rayColor = vec3(0.2, 0.4, 0.9); // Sapphire
        else if (v < 3.0) rayColor = vec3(0.9, 0.8, 0.2); // Gold
        else if (v < 4.0) rayColor = vec3(0.2, 0.8, 0.4); // Emerald
        else if (v < 5.0) rayColor = vec3(0.7, 0.3, 0.8); // Amethyst
        else rayColor = vec3(0.9, 0.5, 0.2); // Amber

        // Add shimmer
        float shimmer = sin(uv.y * 20.0 + iTime * 2.0 + v * 2.0) * 0.3 + 0.7;

        vitralCol += rayColor * ray * shimmer;
      }

      // Blend cathedral effect
      col = mix(col, col + vitralCol * 0.6, fadeIn);

      // Add colored ambient from walls
      vec3 wallGlow = vec3(0.3, 0.2, 0.4) * (1.0 - abs(uv.x)) * 0.3;
      col += wallGlow * fadeIn;
    }

    // Breathing/pulsing
    float breath = sin(iTime * 0.3) * 0.5 + 0.5;
    col *= 0.9 + breath * 0.1;

    // === POLE EFFECTS - FOG FROM OUTSET ===
    // Inferior pole - always present
    float inferiorPole = smoothstep(-0.1, -0.7, rd.y);
    col = mix(col, vec3(0.0), inferiorPole);
    col += vec3(0.01, 0.015, 0.03) * inferiorPole;

    // Superior pole - WHITE FOG FROM OUTSET (not dependent on intro)
    float superiorPole = smoothstep(0.6, 0.95, rd.y); // Starts earlier
    vec3 divineFog = vec3(0.9, 0.92, 0.98); // Bright white fog
    col = mix(col, divineFog, superiorPole * 0.8); // Strong blend to hide seam
    float poleCore = smoothstep(0.88, 1.0, rd.y);
    col = mix(col, vec3(1.0), poleCore * 0.9); // Pure white at very top

    // Apply brightness and intro
    col *= iBrightness * iIntroProgress;

    // Color shift
    col.b += iColorShift * 0.1;

    // Tone mapping
    col = col / (col + vec3(0.5));
    col = pow(col, vec3(0.85));

    col *= 1.3;

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface SacredVesselsShaderProps {
  speed?: number;
  zoom?: number;
  brightness?: number;
  colorShift?: number;
  pulse?: number;
  headRotationY?: number;
  introProgress?: number;
  audioTime?: number;
}

export function SacredVesselsShader({
  speed = 1.0,
  brightness = 1.0,
  colorShift = 0.0,
  headRotationY = 0,
  introProgress = 0,
  audioTime = 0
}: SacredVesselsShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iBrightness: { value: brightness },
    iIntroProgress: { value: introProgress },
    iColorShift: { value: colorShift },
    iAudioTime: { value: audioTime }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime * speed;
      material.uniforms.iBrightness.value = brightness;
      material.uniforms.iIntroProgress.value = introProgress;
      material.uniforms.iColorShift.value = colorShift;
      material.uniforms.iAudioTime.value = audioTime;
    }
  });

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
