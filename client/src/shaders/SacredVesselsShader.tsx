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

    // === SHINING STAR APEX - HIDE TOP POLE ===
    // Radiant star at the apex where streams converge
    float apexDist = 1.0 - rd.y; // Distance from top pole (rd.y = 1.0)

    // Core: intense bright point
    float starCore = exp(-apexDist * apexDist * 800.0) * 3.0;

    // Halo: soft gradient around core
    float starHalo = exp(-apexDist * apexDist * 40.0) * 1.2;

    // Rays emanating from apex
    float starRays = 0.0;
    for(float sr = 0.0; sr < 8.0; sr++) {
      float starRayAngle = sr * 0.785 + iTime * 0.05; // 8 rays, slowly rotating
      float starRayTheta = theta - starRayAngle;
      float starRayDist = abs(sin(starRayTheta * 4.0)); // More rays
      float starRay = exp(-starRayDist * starRayDist * 15.0);
      starRay *= exp(-apexDist * 8.0); // Fade with distance from apex
      starRays += starRay * 0.12;
    }

    // Pulsing breath for the star
    float starBreath = sin(iTime * 0.5) * 0.15 + 0.85;

    // Combine star elements
    float starIntensity = (starCore + starHalo + starRays) * starBreath;

    // Star color - bright white with slight warmth
    vec3 starColor = vec3(1.0, 0.98, 0.95);
    col += starColor * starIntensity;

    // === VERTICAL SEAM COVERAGE - LUMINOUS GLOW COLUMN ===
    // The seam is at theta = ±π, mapping to uv.x = ±1.0
    float seamDist = min(abs(uv.x - 1.0), abs(uv.x + 1.0));

    // Create a glowing column at the seam (like the other stream columns)
    float seamColumnWidth = 0.12;
    float seamMask = smoothstep(seamColumnWidth, 0.0, seamDist);

    // Add flowing particles to match other columns
    float seamParticles = 0.0;
    for(float j = 0.0; j < 3.0; j++) {
      float scale = 6.0 + j * 3.0;
      float speed = t * (1.2 + j * 0.4);
      vec2 seamParticleUV = vec2(seamDist * scale * 20.0, ascentY * scale * 2.0 - speed);
      float n = noise(seamParticleUV);
      seamParticles += smoothstep(0.5, 0.75, n) / (1.0 + j * 0.4);
    }

    // Central glow for seam
    float seamGlow = exp(-seamDist * seamDist * 400.0) * 2.5;
    float seamIntensity = seamMask * seamParticles * 0.5 + seamGlow;

    // Vertical gradient for seam
    float seamVerticalGrad = smoothstep(-1.0, 0.3, uv.y);
    seamIntensity *= seamVerticalGrad;

    // Same ethereal blue-white as other streams
    vec3 seamColor = vec3(0.6, 0.8, 1.0);
    vec3 seamCore = vec3(1.0, 1.0, 1.0);
    float seamCoreMix = exp(-seamDist * seamDist * 1000.0);
    vec3 finalSeamColor = mix(seamColor, seamCore, seamCoreMix);

    col += finalSeamColor * seamIntensity * 0.5;

    // === GOLDEN PHASES WITH PROGRESSIVE FOG ===
    float phase1Start = 143.0;
    float phase1End = 173.0;
    float phase2Start = 183.0;
    float phase2End = 210.0;
    float phase3Start = 220.0;
    float phase4Start = 260.0; // Final white-out immersion

    // Calculate overall phase progress for saturation/glow intensification
    float overallProgress = 0.0;
    if (iAudioTime > phase1Start) {
      overallProgress = smoothstep(phase1Start, phase4Start + 30.0, iAudioTime);
    }

    // Progressive fog expansion - starts 0, grows with phases
    float fogExpansion = 0.0;
    if (iAudioTime > phase1Start) {
      fogExpansion = smoothstep(0.0, 30.0, iAudioTime - phase1Start) * 0.3; // Phase 1: top only
    }
    if (iAudioTime > phase2Start) {
      fogExpansion += smoothstep(0.0, 20.0, iAudioTime - phase2Start) * 0.3; // Phase 2: mid
    }
    if (iAudioTime > phase3Start) {
      fogExpansion += smoothstep(0.0, 30.0, iAudioTime - phase3Start) * 0.4; // Phase 3: full envelope
    }

    // Phase 1: First golden emergence (143s - 173s) with descending fog
    if (iAudioTime > phase1Start && iAudioTime < phase1End) {
      float fadeIn = smoothstep(0.0, 8.0, iAudioTime - phase1Start);
      float fadeOut = 1.0 - smoothstep(phase1End - 8.0, phase1End, iAudioTime);
      float presenceIntensity = fadeIn * fadeOut;

      // Golden fog descending from above - 360 degree coverage
      float fogHeight = mix(0.9, 0.4, smoothstep(0.0, 25.0, iAudioTime - phase1Start));
      float goldenFog = smoothstep(fogHeight - 0.3, fogHeight + 0.2, uv.y) * presenceIntensity;

      // Add golden center glow
      float goldenCenter = exp(-length(vec2(uv.x * 0.5, uv.y - 0.5)) * 1.2);
      float wave = sin(length(vec2(uv.x, uv.y)) * 8.0 - iTime * 2.0) * 0.5 + 0.5;
      float breath = sin(iTime * 0.8) * 0.3 + 0.7;

      float goldenAmount = (goldenFog + goldenCenter * 0.6 + wave * 0.15) * presenceIntensity * breath;

      vec3 goldenColor = vec3(1.0, 0.85, 0.4);
      vec3 whiteCore = vec3(1.0, 0.98, 0.9);
      vec3 divineGold = mix(goldenColor, whiteCore, goldenCenter * presenceIntensity);

      col += divineGold * goldenAmount * 2.2;
      col = mix(col, col * vec3(1.2, 1.1, 0.8), presenceIntensity * 0.5);
    }

    // Phase 2: Second golden emergence with 360 degree rays + color hints (183s - 210s)
    if (iAudioTime > phase2Start && iAudioTime < phase2End) {
      float fadeIn = smoothstep(0.0, 6.0, iAudioTime - phase2Start);
      float fadeOut = 1.0 - smoothstep(phase2End - 6.0, phase2End, iAudioTime);
      float intensity2 = fadeIn * fadeOut;

      // Golden fog now at mid-height, surrounding user - MORE INTENSE
      float midFog = smoothstep(-0.3, 0.7, uv.y) * smoothstep(1.0, 0.2, uv.y);
      vec3 goldenMidFog = vec3(1.0, 0.88, 0.55) * midFog * intensity2 * 0.5;

      // Add subtle color hints in the golden fog
      float colorHint = sin(theta * 3.0 + iTime * 0.2) * 0.5 + 0.5;
      vec3 hintColor = mix(vec3(1.0, 0.7, 0.5), vec3(0.9, 0.8, 1.0), colorHint);
      goldenMidFog = mix(goldenMidFog, goldenMidFog * hintColor, 0.3);

      col += goldenMidFog;

      // 360 degree golden rays using theta
      float goldenRays = 0.0;
      for(float r = 0.0; r < 12.0; r++) {
        float rayAngle = r * 0.524 + iTime * 0.08;
        float rayTheta = theta - rayAngle;
        float rayDist = abs(sin(rayTheta));
        float ray = exp(-rayDist * rayDist * 70.0) * smoothstep(-0.1, 0.8, uv.y);
        goldenRays += ray * 0.18;
      }

      // Lens flare at top center - enhanced
      float flareDist = length(vec2(uv.x, uv.y - 0.85));
      float flareCore = exp(-flareDist * flareDist * 70.0);
      float flareRing = exp(-abs(flareDist - 0.1) * 25.0) * 0.6;
      float flareRing2 = exp(-abs(flareDist - 0.2) * 18.0) * 0.4;
      float lensFlare = flareCore + flareRing + flareRing2;

      vec3 intenseGold = vec3(1.0, 0.88, 0.45);
      vec3 pureWhite = vec3(1.0, 1.0, 0.95);

      col += intenseGold * goldenRays * intensity2;
      col += mix(intenseGold, pureWhite, 0.7) * lensFlare * intensity2 * 2.8;

      // Tint scene golden - stronger
      col = mix(col, col * vec3(1.35, 1.15, 0.8), intensity2 * 0.65);
    }

    // Phase 3: Cathedral stained glass - 360 DEGREES with INTENSE COLORED FOG (220s+)
    if (iAudioTime > phase3Start) {
      float fadeIn = smoothstep(0.0, 15.0, iAudioTime - phase3Start);
      float deepFadeIn = smoothstep(0.0, 30.0, iAudioTime - phase3Start); // Slower for fog intensity

      // === GOLDEN + COLORED FOG ENVELOPE ===
      // Base golden fog that fills the space
      float goldenFogMask = smoothstep(-0.6, 0.7, uv.y) * deepFadeIn;
      vec3 goldenFogBase = vec3(1.0, 0.88, 0.55) * goldenFogMask * 0.4;

      // Add swirling colored fog on top of golden
      vec3 coloredFog = vec3(0.0);
      for(float cf = 0.0; cf < 6.0; cf++) {
        float fogAngle = cf * 1.047 + iTime * 0.02;
        float fogTheta = theta - fogAngle;
        float fogWave = sin(fogTheta * 2.0 + uv.y * 3.0 + iTime * 0.3) * 0.5 + 0.5;

        vec3 fogColor;
        if (cf < 1.0) fogColor = vec3(0.95, 0.3, 0.4); // Ruby fog
        else if (cf < 2.0) fogColor = vec3(0.3, 0.5, 0.95); // Sapphire fog
        else if (cf < 3.0) fogColor = vec3(0.95, 0.85, 0.3); // Gold fog
        else if (cf < 4.0) fogColor = vec3(0.3, 0.9, 0.5); // Emerald fog
        else if (cf < 5.0) fogColor = vec3(0.8, 0.4, 0.9); // Amethyst fog
        else fogColor = vec3(0.95, 0.6, 0.3); // Amber fog

        coloredFog += fogColor * fogWave * 0.12 * deepFadeIn;
      }

      // Combine golden base with colored swirls
      col += goldenFogBase + coloredFog;

      // === 360 DEGREE COLORED RAYS - MORE INTENSE ===
      vec3 vitralCol = vec3(0.0);

      for(float v = 0.0; v < 12.0; v++) {
        float rayBaseAngle = v * 0.524;
        float rayAngle = rayBaseAngle + iTime * 0.03;

        float rayTheta = theta - rayAngle;
        float rayDist = abs(sin(rayTheta * 0.5));
        float ray = exp(-rayDist * rayDist * 25.0); // Wider rays

        ray *= smoothstep(-0.4, 0.85, uv.y);

        // Cathedral glass colors - MORE SATURATED
        vec3 rayColor;
        float colorIdx = mod(v, 6.0);
        if (colorIdx < 1.0) rayColor = vec3(1.0, 0.15, 0.25); // Intense Ruby
        else if (colorIdx < 2.0) rayColor = vec3(0.15, 0.35, 1.0); // Intense Sapphire
        else if (colorIdx < 3.0) rayColor = vec3(1.0, 0.9, 0.15); // Intense Gold
        else if (colorIdx < 4.0) rayColor = vec3(0.15, 0.95, 0.4); // Intense Emerald
        else if (colorIdx < 5.0) rayColor = vec3(0.85, 0.25, 0.95); // Intense Amethyst
        else rayColor = vec3(1.0, 0.5, 0.15); // Intense Amber

        float shimmer = sin(uv.y * 15.0 + iTime * 1.5 + v * 1.5) * 0.2 + 0.8;

        vitralCol += rayColor * ray * shimmer * 0.22; // Increased intensity
      }

      // Saturation boost increases with time
      float saturationBoost = 1.0 + fadeIn * 0.8;
      vitralCol *= saturationBoost;
      col = mix(col, col + vitralCol, fadeIn);

      // Golden-tinted ambient glow from all around
      vec3 ambientGlow = vec3(0.5, 0.4, 0.3) * 0.3;
      col += ambientGlow * fadeIn;

      // Extra bloom/glow effect as fog deepens
      col = mix(col, col * 1.2, deepFadeIn * 0.3);
    }

    // Phase 4: Final white-out immersion with GOLDEN + COLORED crescendo (260s+)
    if (iAudioTime > phase4Start) {
      float whiteOutProgress = smoothstep(0.0, 45.0, iAudioTime - phase4Start);
      float earlyPhase = 1.0 - smoothstep(0.0, 0.5, whiteOutProgress); // First half

      // === GOLDEN CRESCENDO before white-out ===
      // Intense golden fog envelope
      vec3 goldenCrescendo = vec3(1.0, 0.9, 0.5) * earlyPhase * 0.6;

      // Swirling cathedral colors at peak intensity
      vec3 finalColors = vec3(0.0);
      for(float f = 0.0; f < 12.0; f++) {
        float burstAngle = f * 0.524 + iTime * 0.08;
        float burstTheta = theta - burstAngle;
        float burstDist = abs(sin(burstTheta * 0.5));
        float burst = exp(-burstDist * burstDist * 15.0) * earlyPhase;

        // Intense cathedral colors
        vec3 burstColor;
        float colorIdx = mod(f, 6.0);
        if (colorIdx < 1.0) burstColor = vec3(1.0, 0.2, 0.3);
        else if (colorIdx < 2.0) burstColor = vec3(0.2, 0.4, 1.0);
        else if (colorIdx < 3.0) burstColor = vec3(1.0, 0.9, 0.2);
        else if (colorIdx < 4.0) burstColor = vec3(0.2, 1.0, 0.5);
        else if (colorIdx < 5.0) burstColor = vec3(0.9, 0.3, 1.0);
        else burstColor = vec3(1.0, 0.6, 0.2);

        finalColors += burstColor * burst * 0.25;
      }

      // Golden + colored fog from below rises to meet from above
      float risingGolden = smoothstep(-0.8, 0.5, uv.y) * earlyPhase;
      col += vec3(1.0, 0.85, 0.4) * risingGolden * 0.4;

      col += goldenCrescendo + finalColors;

      // Peak saturation before white
      float satPeak = sin(whiteOutProgress * 3.14159) * 0.5; // Peaks in middle
      col = mix(col, col * 1.5, satPeak);

      // Final divine white immersion - warm tinted
      vec3 divineWhite = vec3(1.0, 0.99, 0.95);
      col = mix(col, divineWhite, whiteOutProgress * whiteOutProgress);
    }

    // Progressive saturation and glow intensification throughout phases
    float glowBoost = 1.0 + overallProgress * 0.6;
    col *= glowBoost;

    // Breathing/pulsing
    float breath = sin(iTime * 0.3) * 0.5 + 0.5;
    col *= 0.9 + breath * 0.1;

    // === POLE EFFECTS - MINIMAL AT START, EXPANDS WITH PHASES ===

    // === INFERIOR POLE - GOLDEN EMERGENCE FROM BELOW ===
    float inferiorPole = smoothstep(-0.1, -0.7, rd.y);
    float deepBelow = smoothstep(0.0, -0.9, rd.y); // Very deep below

    // Calculate golden emergence based on phase progress
    float goldenBelowIntensity = 0.0;
    if (iAudioTime > phase1Start) {
      goldenBelowIntensity = smoothstep(0.0, 30.0, iAudioTime - phase1Start) * 0.3;
    }
    if (iAudioTime > phase2Start) {
      goldenBelowIntensity += smoothstep(0.0, 20.0, iAudioTime - phase2Start) * 0.4;
    }
    if (iAudioTime > phase3Start) {
      goldenBelowIntensity += smoothstep(0.0, 25.0, iAudioTime - phase3Start) * 0.5;
    }
    goldenBelowIntensity = min(goldenBelowIntensity, 1.2); // Cap it

    // Before phases: pure darkness
    vec3 depthColor = vec3(0.0);

    // During phases: golden light emerges from below
    if (goldenBelowIntensity > 0.0) {
      // Golden glow rising from the depths
      vec3 deepGold = vec3(1.0, 0.75, 0.3);
      vec3 warmGold = vec3(1.0, 0.85, 0.5);

      // Pulsing golden light from below
      float goldenPulse = sin(iTime * 0.6) * 0.2 + 0.8;

      // Radial golden glow centered below
      float belowGlow = exp(-deepBelow * 2.0) * goldenBelowIntensity * goldenPulse;

      // Add golden rays rising from below
      float risingRays = 0.0;
      for(float br = 0.0; br < 6.0; br++) {
        float rayAngle = br * 1.047 + iTime * 0.04;
        float rayTheta = theta - rayAngle;
        float rayDist = abs(sin(rayTheta * 3.0));
        float ray = exp(-rayDist * rayDist * 20.0);
        ray *= smoothstep(-0.9, -0.2, rd.y); // Fade as rises
        risingRays += ray * 0.1;
      }

      depthColor = mix(deepGold, warmGold, belowGlow) * (belowGlow + risingRays * goldenBelowIntensity);
    }

    // Apply inferior pole - darkness at start, golden during phases
    col = mix(col, depthColor, inferiorPole);

    // === SUPERIOR POLE - STAR APEX ALREADY HANDLES THIS ===
    // Just add subtle fog expansion for atmosphere (star handles the seam hiding)
    float basePoleSize = 0.92; // Star handles the very top
    float expandedPoleSize = mix(basePoleSize, 0.5, fogExpansion);

    float superiorPole = smoothstep(expandedPoleSize, 0.96, rd.y);

    // Fog color shifts from subtle to golden-white with phases
    vec3 poleFogColor = mix(vec3(0.1, 0.12, 0.15), vec3(1.0, 0.95, 0.85), fogExpansion);
    col = mix(col, poleFogColor, superiorPole * (0.2 + fogExpansion * 0.6));

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
