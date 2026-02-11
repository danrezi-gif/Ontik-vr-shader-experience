import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { XR, createXRStore, XROrigin } from "@react-three/xr";
import { ShaderGallery } from "./components/ShaderGallery";
import { AbstractWavesShader } from "./shaders/AbstractWavesShader";
import { TunnelLightsShader } from "./shaders/TunnelLightsShader";
import { InfiniteLightShader } from "./shaders/InfiniteLightShader";
import { SacredVesselsShader } from "./shaders/SacredVesselsShader";
import { TranscendentDomainShader } from "./shaders/TranscendentDomainShader";
import { OceanicDissolutionShader } from "./shaders/OceanicDissolutionShader";
import { SHADERS } from "./shaders";
import "@fontsource/inter";
import * as THREE from "three";

const store = createXRStore();

// Shader component mapping
interface ShaderRendererProps {
  shaderId: string;
  speed: number;
  pulse: number;
  brightness: number;
  colorShift: number;
  zoom: number;
  headRotationY: number;
  introProgress: number;
  audioTime: number;
  envelopmentRef?: React.MutableRefObject<number>;
}

function ShaderRenderer({ shaderId, speed, pulse, brightness, colorShift, zoom, headRotationY, introProgress, audioTime, envelopmentRef }: ShaderRendererProps) {
  switch (shaderId) {
    case 'abstract-waves':
      return <AbstractWavesShader speed={speed} brightness={brightness} colorShift={colorShift} zoom={zoom} pulse={pulse} headRotationY={headRotationY} introProgress={introProgress} />;
    case 'tunnel-lights':
      return <TunnelLightsShader speed={speed} brightness={brightness} colorShift={colorShift} zoom={zoom} pulse={pulse} headRotationY={headRotationY} introProgress={introProgress} />;
    case 'infinite-light':
      return <InfiniteLightShader speed={speed} brightness={brightness} colorShift={colorShift} zoom={zoom} pulse={pulse} headRotationY={headRotationY} introProgress={introProgress} />;
    case 'sacred-vessels':
      return <SacredVesselsShader speed={speed} brightness={brightness} colorShift={colorShift} headRotationY={headRotationY} introProgress={introProgress} audioTime={audioTime} />;
    case 'transcendent-domain':
      return <TranscendentDomainShader speed={speed} brightness={brightness} colorShift={colorShift} headRotationY={headRotationY} introProgress={introProgress} audioTime={audioTime} />;
    case 'oceanic-dissolution':
      return <OceanicDissolutionShader speed={speed} brightness={brightness} colorShift={colorShift} headRotationY={headRotationY} introProgress={introProgress} audioTime={audioTime} envelopmentRef={envelopmentRef} />;
    default:
      return <AbstractWavesShader speed={speed} brightness={brightness} colorShift={colorShift} zoom={zoom} pulse={pulse} headRotationY={headRotationY} introProgress={introProgress} />;
  }
}

interface ControlButtonsProps {
  onEnterVR: () => void;
  onBack: () => void;
  vrError: string | null;
  shaderName: string;
}

function ControlButtons({ onEnterVR, onBack, vrError, shaderName }: ControlButtonsProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        marginBottom: '8px',
        fontFamily: 'Inter, sans-serif'
      }}>
        {shaderName}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '14px 28px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
          }}
        >
          ← BACK
        </button>

        <button
          onClick={onEnterVR}
          style={{
            padding: '14px 28px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#00ff88',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0, 255, 136, 0.4)'
          }}
        >
          ENTER VR
        </button>
      </div>

      {vrError && (
        <div style={{
          backgroundColor: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '4px',
          fontSize: '14px',
          maxWidth: '350px',
          textAlign: 'center'
        }}>
          {vrError}
        </div>
      )}

      <div style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '12px',
        textAlign: 'center',
        maxWidth: '300px'
      }}>
        Tap ENTER VR for immersive experience
      </div>
    </div>
  );
}

interface VRControllerHandlerProps {
  onBack: () => void;
  onSpeedChange: (delta: number) => void;
  onBrightnessChange: (delta: number) => void;
  onColorShiftChange: (delta: number) => void;
  onZoomChange: (delta: number) => void;
  vrSessionActive: boolean;
}

function VRControllerHandler({ onBack, onSpeedChange, onBrightnessChange, onColorShiftChange, onZoomChange, vrSessionActive }: VRControllerHandlerProps) {
  const lastButtonStates = useRef<{ [key: string]: boolean }>({});
  const audioResumed = useRef(false);

  // Reset refs when VR session becomes active (new session started)
  useEffect(() => {
    if (vrSessionActive) {
      // Reset state for new VR session
      lastButtonStates.current = {};
      audioResumed.current = false;
      console.log('VR session started - reset controller state');
    }
  }, [vrSessionActive]);

  useFrame((state) => {
    const session = state.gl.xr.getSession();
    if (!session?.inputSources) return;

    // Resume audio context when in VR (Quest suspends it on VR entry)
    if (!audioResumed.current && globalAudio.listener) {
      const ctx = globalAudio.listener.context;
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (globalAudio.audio && !globalAudio.audio.isPlaying) {
            globalAudio.audio.play();
          }
          console.log('Audio resumed in VR');
        });
      }
      audioResumed.current = true;
    }

    session.inputSources.forEach((inputSource) => {
      if (!inputSource.gamepad) return;

      const gamepad = inputSource.gamepad;
      const handedness = inputSource.handedness;

      if (handedness === 'right') {
        // A button (button 4) = increase speed
        const aPressed = gamepad.buttons[4]?.pressed || false;
        if (aPressed && !lastButtonStates.current['a']) {
          onSpeedChange(0.1);
        }
        lastButtonStates.current['a'] = aPressed;

        // B button (button 5) = decrease speed
        const bPressed = gamepad.buttons[5]?.pressed || false;
        if (bPressed && !lastButtonStates.current['b']) {
          onSpeedChange(-0.1);
        }
        lastButtonStates.current['b'] = bPressed;

        // Right thumbstick Y-axis = zoom
        const thumbstickY = gamepad.axes[3] || 0;
        if (Math.abs(thumbstickY) > 0.5) {
          onZoomChange(-thumbstickY * 0.02);
        }
      }

      if (handedness === 'left') {
        // X button (button 4) = cycle color shift up
        const xPressed = gamepad.buttons[4]?.pressed || false;
        if (xPressed && !lastButtonStates.current['x']) {
          onColorShiftChange(0.5);
        }
        lastButtonStates.current['x'] = xPressed;

        // Y button (button 5) = go back
        const yPressed = gamepad.buttons[5]?.pressed || false;
        if (yPressed && !lastButtonStates.current['y']) {
          onBack();
        }
        lastButtonStates.current['y'] = yPressed;

        // Left thumbstick Y-axis = brightness
        const thumbstickY = gamepad.axes[3] || 0;
        if (Math.abs(thumbstickY) > 0.5) {
          onBrightnessChange(-thumbstickY * 0.02);
        }
      }
    });
  });

  return null;
}

// Glowing orbs at hand/controller positions
// When in Alien Womb shader: energy wisps with plasma noise + trailing orbs
function HandGlows({ shaderId, envelopmentRef }: { shaderId?: string; envelopmentRef?: React.MutableRefObject<number> }) {
  const isAlienWomb = shaderId === 'oceanic-dissolution';

  const leftHandRef = useRef<THREE.Mesh>(null);
  const rightHandRef = useRef<THREE.Mesh>(null);
  const leftGlowRef = useRef<THREE.PointLight>(null);
  const rightGlowRef = useRef<THREE.PointLight>(null);

  // Trail refs for energy wisps (Alien Womb only)
  const leftTrail1Ref = useRef<THREE.Mesh>(null);
  const leftTrail2Ref = useRef<THREE.Mesh>(null);
  const rightTrail1Ref = useRef<THREE.Mesh>(null);
  const rightTrail2Ref = useRef<THREE.Mesh>(null);
  const leftTrailPos1 = useRef(new THREE.Vector3());
  const leftTrailPos2 = useRef(new THREE.Vector3());
  const rightTrailPos1 = useRef(new THREE.Vector3());
  const rightTrailPos2 = useRef(new THREE.Vector3());
  // Cached Vector3 for trail lerp target — avoids per-frame GC on Quest
  const trailTargetCache = useRef(new THREE.Vector3());

  // Standard glowing orb shader (other shaders)
  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0.5, 0.7, 1.0) }
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          float pulse = 0.8 + 0.2 * sin(time * 2.0);
          gl_FragColor = vec4(color * intensity * pulse * 2.0, intensity * 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false
    });
  }, []);

  // Energy wisp plasma shader (Alien Womb)
  const wispMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(0.35, 0.80, 0.90) },
        color2: { value: new THREE.Color(0.85, 0.45, 0.55) },
        fusion: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float fusion;
        varying vec3 vNormal;
        varying vec3 vPosition;

        float hash(vec3 p) {
          p = fract(p * vec3(443.897, 397.297, 491.187));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(
            mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
        }

        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
          float n1 = noise(vPosition * 8.0 + time * 3.0);
          float n2 = noise(vPosition * 12.0 - time * 2.0 + vec3(50.0));
          float plasma = n1 * 0.6 + n2 * 0.4;
          vec3 color = mix(color1, color2, plasma);
          float intensity = fresnel * (0.5 + plasma * 0.8);
          float pulse = 0.7 + 0.3 * sin(time * 1.5);
          intensity *= pulse;
          // Fusion: brighter but more ethereal
          float fusionFade = 1.0 - fusion * 0.4;
          float fusionBright = 1.0 + fusion * 0.6;
          float alpha = intensity * 0.8 * fusionFade;
          gl_FragColor = vec4(color * intensity * fusionBright * 2.5, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false
    });
  }, []);

  // Trail material (simpler wispy glow)
  const trailMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0.35, 0.80, 0.90) },
        opacity: { value: 0.4 }
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        varying vec3 vNormal;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          float pulse = 0.6 + 0.4 * sin(time * 2.0);
          float alpha = fresnel * pulse * opacity;
          gl_FragColor = vec4(color * fresnel * 2.0, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }, []);

  useFrame((state) => {
    const session = state.gl.xr.getSession();
    if (!session) return;

    const frame = state.gl.xr.getFrame();
    if (!frame) return;

    const refSpace = state.gl.xr.getReferenceSpace();
    if (!refSpace) return;

    const t = state.clock.elapsedTime;
    const activeMaterial = isAlienWomb ? wispMaterial : glowMaterial;
    activeMaterial.uniforms.time.value = t;

    if (isAlienWomb) {
      trailMaterial.uniforms.time.value = t;
      const env = envelopmentRef?.current || 0;
      const fusion = Math.max(0, Math.min(1.0, (env - 0.75) / 0.25));
      wispMaterial.uniforms.fusion.value = fusion;
    }

    session.inputSources.forEach((inputSource) => {
      if (!inputSource.gripSpace) return;

      const pose = frame.getPose(inputSource.gripSpace, refSpace);
      if (!pose) return;

      const pos = pose.transform.position;
      const isLeft = inputSource.handedness === 'left';
      const meshRef = isLeft ? leftHandRef : rightHandRef;
      const lightRef = isLeft ? leftGlowRef : rightGlowRef;

      if (meshRef.current) {
        meshRef.current.position.set(pos.x, pos.y, pos.z);
        meshRef.current.visible = true;
        meshRef.current.material = activeMaterial;
      }
      if (lightRef.current) {
        lightRef.current.position.set(pos.x, pos.y, pos.z);
      }

      // Update trailing wisps for Alien Womb
      if (isAlienWomb) {
        trailTargetCache.current.set(pos.x, pos.y, pos.z);
        if (isLeft) {
          leftTrailPos1.current.lerp(trailTargetCache.current, 0.08);
          leftTrailPos2.current.lerp(leftTrailPos1.current, 0.06);
          if (leftTrail1Ref.current) {
            leftTrail1Ref.current.position.copy(leftTrailPos1.current);
            leftTrail1Ref.current.visible = true;
          }
          if (leftTrail2Ref.current) {
            leftTrail2Ref.current.position.copy(leftTrailPos2.current);
            leftTrail2Ref.current.visible = true;
          }
        } else {
          rightTrailPos1.current.lerp(trailTargetCache.current, 0.08);
          rightTrailPos2.current.lerp(rightTrailPos1.current, 0.06);
          if (rightTrail1Ref.current) {
            rightTrail1Ref.current.position.copy(rightTrailPos1.current);
            rightTrail1Ref.current.visible = true;
          }
          if (rightTrail2Ref.current) {
            rightTrail2Ref.current.position.copy(rightTrailPos2.current);
            rightTrail2Ref.current.visible = true;
          }
        }
      }
    });
  });

  const mainRadius = isAlienWomb ? 0.06 : 0.04;
  const lightColor = isAlienWomb ? '#55ccdd' : '#88aaff';
  const lightIntensity = isAlienWomb ? 0.8 : 0.5;
  const lightDistance = isAlienWomb ? 0.8 : 0.5;

  return (
    <>
      {/* Left hand glow */}
      <mesh ref={leftHandRef} visible={false}>
        <sphereGeometry args={[mainRadius, 16, 16]} />
      </mesh>
      <pointLight ref={leftGlowRef} color={lightColor} intensity={lightIntensity} distance={lightDistance} />

      {/* Right hand glow */}
      <mesh ref={rightHandRef} visible={false}>
        <sphereGeometry args={[mainRadius, 16, 16]} />
      </mesh>
      <pointLight ref={rightGlowRef} color={lightColor} intensity={lightIntensity} distance={lightDistance} />

      {/* Trailing energy wisps (Alien Womb only) */}
      {isAlienWomb && (
        <>
          <mesh ref={leftTrail1Ref} visible={false} material={trailMaterial}>
            <sphereGeometry args={[0.04, 8, 8]} />
          </mesh>
          <mesh ref={leftTrail2Ref} visible={false} material={trailMaterial}>
            <sphereGeometry args={[0.025, 8, 8]} />
          </mesh>
          <mesh ref={rightTrail1Ref} visible={false} material={trailMaterial}>
            <sphereGeometry args={[0.04, 8, 8]} />
          </mesh>
          <mesh ref={rightTrail2Ref} visible={false} material={trailMaterial}>
            <sphereGeometry args={[0.025, 8, 8]} />
          </mesh>
        </>
      )}
    </>
  );
}

// Shader-specific audio tracks
const SHADER_AUDIO: { [key: string]: string } = {
  'abstract-waves': 'The Birth of the Holy.mp3',
  'tunnel-lights': 'Russian chant - Покаяния отверзи ми двери.mp3',
  'infinite-light': 'Ligeti-Lux-Aeterna.mp3',
  'sacred-vessels': 'John Tavener - Funeral Canticle (The Tree of Life) FULL VERSION.mp3',
  'transcendent-domain': 'Pink Floyd - Shine On You Crazy Diamond [Official Music Video].mp3',
  'default': 'background-music.mp3'
};

const audioBuffers: { [key: string]: AudioBuffer | null } = {};
const audioLoader = new THREE.AudioLoader();

// Preload all audio files
Object.entries(SHADER_AUDIO).forEach(([key, filename]) => {
  const path = `${import.meta.env.BASE_URL}audio/${filename}`;
  audioLoader.load(path, (buffer) => {
    audioBuffers[key] = buffer;
    console.log(`Audio preloaded: ${key} from ${path}`);
  }, undefined, (err) => {
    console.error(`Error preloading audio ${key}:`, err);
  });
});

const globalAudio = {
  audio: null as THREE.Audio | null,
  positionalAudio: null as THREE.PositionalAudio | null,
  listener: null as THREE.AudioListener | null,
  currentTrack: null as string | null,
  initialized: false,
  convolver: null as ConvolverNode | null,
  reverbGain: null as GainNode | null,
  playbackStartTime: null as number | null // Track when playback actually started
};

// Shaders that use positional audio from a specific location
const POSITIONAL_AUDIO_SHADERS = ['tunnel-lights', 'sacred-vessels', 'infinite-light', 'transcendent-domain'];

function getAudioBufferForShader(shaderId: string): AudioBuffer | null {
  // Only return the specific shader's buffer - don't fall back to default
  // This ensures we wait for the correct track instead of playing background music
  if (audioBuffers[shaderId]) {
    return audioBuffers[shaderId];
  }
  // Only use default if explicitly requested or shader has no assigned track
  if (shaderId === 'default' || !SHADER_AUDIO[shaderId]) {
    return audioBuffers['default'] || null;
  }
  return null;
}

// Create impulse response for reverb (cathedral-like)
function createReverbImpulse(context: AudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      // Exponential decay with some randomness for natural reverb
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function initAudioListener(camera: THREE.Camera) {
  if (globalAudio.initialized) return;
  globalAudio.initialized = true;

  const listener = new THREE.AudioListener();
  camera.add(listener);
  globalAudio.listener = listener;

  // Create regular audio for non-positional shaders
  const audio = new THREE.Audio(listener);
  audio.setLoop(true);
  audio.setVolume(0.3);
  globalAudio.audio = audio;

  // Create positional audio for spatial shaders
  const positionalAudio = new THREE.PositionalAudio(listener);
  positionalAudio.setLoop(true);
  positionalAudio.setVolume(1.5); // Louder for immersive effect
  positionalAudio.setRefDistance(200); // Full volume up to 200 units
  positionalAudio.setMaxDistance(2000); // Max distance for attenuation
  positionalAudio.setRolloffFactor(0.05); // Very gentle falloff - stays loud
  positionalAudio.setDistanceModel('exponential');
  globalAudio.positionalAudio = positionalAudio;

  // Create reverb effect - enhanced for immersive experience
  const ctx = listener.context;
  const convolver = ctx.createConvolver();
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0.6; // Increased reverb wet mix for more immersion

  // Create cathedral-like reverb (4 second decay for deeper immersion)
  convolver.buffer = createReverbImpulse(ctx, 4.0, 2.0);

  globalAudio.convolver = convolver;
  globalAudio.reverbGain = reverbGain;
}

function playTrackForShader(shaderId: string) {
  if (!globalAudio.listener) return;

  const buffer = getAudioBufferForShader(shaderId);
  if (!buffer) {
    console.log('Audio buffer not ready for:', shaderId);
    return;
  }

  const isPositional = POSITIONAL_AUDIO_SHADERS.includes(shaderId);
  const activeAudio = isPositional ? globalAudio.positionalAudio : globalAudio.audio;
  const inactiveAudio = isPositional ? globalAudio.audio : globalAudio.positionalAudio;

  if (!activeAudio) return;

  // If same track is already playing on correct audio type, don't restart
  // But ONLY if it's actually playing (check both flag and context state)
  if (globalAudio.currentTrack === shaderId && activeAudio.isPlaying) {
    const ctx = globalAudio.listener.context;
    if (ctx.state === 'running') {
      return; // Actually playing, don't restart
    }
    // Context suspended or audio not truly playing - continue to restart
  }

  // Stop both audio types and disconnect to ensure clean state
  if (globalAudio.audio) {
    if (globalAudio.audio.isPlaying) {
      globalAudio.audio.stop();
    }
    try {
      globalAudio.audio.disconnect();
    } catch (e) {
      // May already be disconnected
    }
  }
  if (globalAudio.positionalAudio) {
    if (globalAudio.positionalAudio.isPlaying) {
      globalAudio.positionalAudio.stop();
    }
    try {
      globalAudio.positionalAudio.disconnect();
    } catch (e) {
      // May already be disconnected
    }
  }

  // Set new buffer
  activeAudio.setBuffer(buffer);
  globalAudio.currentTrack = shaderId;

  // Reset gain to full volume (may have been faded during previous experience ending)
  const baseVolume = isPositional ? 1.5 : 0.3;
  activeAudio.setVolume(baseVolume);

  // Connect reverb for positional audio with shader-specific intensity
  if (isPositional && globalAudio.convolver && globalAudio.reverbGain) {
    const ctx = globalAudio.listener.context;

    // Shader-specific reverb intensity - sacred-vessels gets most immersive
    let reverbIntensity = 0.6;
    if (shaderId === 'sacred-vessels') {
      reverbIntensity = 0.85; // Maximum reverb for cathedral-like immersion
    } else if (shaderId === 'tunnel-lights') {
      reverbIntensity = 0.75; // High reverb for tunnel acoustics
    } else if (shaderId === 'infinite-light') {
      reverbIntensity = 0.7; // Strong reverb for expansive space
    }
    globalAudio.reverbGain.gain.value = reverbIntensity;

    try {
      // Get the audio source and connect through reverb
      const source = (activeAudio as any).source;
      if (source) {
        // Dry signal goes direct, wet goes through reverb
        source.connect(globalAudio.convolver);
        globalAudio.convolver.connect(globalAudio.reverbGain);
        globalAudio.reverbGain.connect(ctx.destination);
      }
    } catch (e) {
      // Reverb connection may fail on first play, that's ok
    }
  }

  const ctx = globalAudio.listener.context;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      activeAudio.play();
      globalAudio.playbackStartTime = ctx.currentTime;
      console.log('Playing track for:', shaderId, isPositional ? '(positional + reverb)' : '(standard)', 'at context time:', ctx.currentTime);
    });
  } else {
    activeAudio.play();
    globalAudio.playbackStartTime = ctx.currentTime;
    console.log('Playing track for:', shaderId, isPositional ? '(positional + reverb)' : '(standard)', 'at context time:', ctx.currentTime);
  }
}

interface BackgroundMusicProps {
  shouldPlay: boolean;
  shaderId: string;
  headRotationY?: number;
}

function BackgroundMusic({ shouldPlay, shaderId, headRotationY = 0 }: BackgroundMusicProps) {
  const { camera, scene } = useThree();
  const audioMeshRef = useRef<THREE.Mesh>(null);

  // Position the positional audio source at the far end of the tunnel
  useEffect(() => {
    if (globalAudio.positionalAudio && audioMeshRef.current) {
      // Attach positional audio to the mesh
      audioMeshRef.current.add(globalAudio.positionalAudio);
    }
  }, []);

  useEffect(() => {
    if (!shouldPlay) return;

    // Initialize audio listener if needed
    initAudioListener(camera);

    // Try to play the track
    const tryPlay = (useFallback = false) => {
      const buffer = getAudioBufferForShader(shaderId);
      if (buffer) {
        playTrackForShader(shaderId);
        return true;
      }
      // If fallback requested and specific buffer failed, use default
      if (useFallback && audioBuffers['default']) {
        console.warn(`Audio for ${shaderId} not available, falling back to default`);
        playTrackForShader('default');
        return true;
      }
      return false;
    };

    // If buffer not ready, poll until it is (with timeout for fallback)
    if (!tryPlay()) {
      const startTime = Date.now();
      const maxWaitMs = 10000; // Wait up to 10 seconds before falling back
      const checkInterval = setInterval(() => {
        if (tryPlay()) {
          clearInterval(checkInterval);
        } else if (Date.now() - startTime > maxWaitMs) {
          // Timeout reached, try fallback
          clearInterval(checkInterval);
          tryPlay(true);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, [camera, shouldPlay, shaderId]);

  // Switch tracks when shader changes
  useEffect(() => {
    if (shouldPlay && globalAudio.initialized) {
      playTrackForShader(shaderId);
    }
  }, [shaderId, shouldPlay]);

  // For positional audio shaders, render an invisible mesh at the audio source location
  const isPositional = POSITIONAL_AUDIO_SHADERS.includes(shaderId);

  if (isPositional) {
    // Shader-specific audio positioning
    let audioPosition: [number, number, number];

    if (shaderId === 'tunnel-lights') {
      // Far end of tunnel
      const distance = 800;
      const x = Math.sin(-headRotationY) * distance;
      const z = -Math.cos(-headRotationY) * distance;
      audioPosition = [x, 0, z];
    } else if (shaderId === 'sacred-vessels') {
      // From above - divine light descending
      audioPosition = [0, 50, 0];
    } else if (shaderId === 'infinite-light') {
      // Close and centered for immersive surrounding effect
      audioPosition = [0, 0, -10];
    } else if (shaderId === 'transcendent-domain') {
      // Surrounding immersive - slightly ahead and centered
      audioPosition = [0, 0, -20];
    } else {
      audioPosition = [0, 0, -100];
    }

    return (
      <mesh ref={audioMeshRef} position={audioPosition} visible={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    );
  }

  return null;
}

// BPM-based pulse calculator
const BPM = 85; // Adjust to match your music's BPM

function useBPMPulse(bpm: number, enabled: boolean) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const msPerBeat = 60000 / bpm;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const beatProgress = (elapsed % msPerBeat) / msPerBeat;
      // Sharp attack, exponential decay
      const pulseValue = Math.pow(1 - beatProgress, 3);
      setPulse(pulseValue);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [bpm, enabled]);

  return pulse;
}

// Captures initial head rotation when VR starts
interface HeadRotationCaptureProps {
  shouldCapture: boolean;
  onCapture: (rotation: number) => void;
}

function HeadRotationCapture({ shouldCapture, onCapture }: HeadRotationCaptureProps) {
  const { camera } = useThree();
  const capturedRef = useRef(false);

  useFrame(() => {
    if (!shouldCapture) {
      capturedRef.current = false;
      return;
    }

    if (!capturedRef.current) {
      // Get camera Y rotation (horizontal look direction)
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      onCapture(euler.y);
      capturedRef.current = true;
    }
  });

  return null;
}

// VR Intro animator - runs inside Canvas using useFrame for reliable VR animation
interface VRIntroAnimatorProps {
  started: boolean;
  onProgress: (progress: number) => void;
  onComplete: () => void;
  shaderId?: string;
}

function VRIntroAnimator({ started, onProgress, onComplete, shaderId }: VRIntroAnimatorProps) {
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useFrame(() => {
    if (!started) {
      startTimeRef.current = null;
      completedRef.current = false;
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    if (completedRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;

    // Shader-specific intro durations
    let duration = 8000;
    if (shaderId === 'infinite-light') {
      duration = 35000;
    } else if (shaderId === 'transcendent-domain') {
      duration = 12000; // 12 second contemplative fade-in
    }
    const linearProgress = Math.min(1, elapsed / duration);

    // Apply easing curve based on shader
    let progress: number;
    if (shaderId === 'infinite-light') {
      // Ease-in-cubic: very slow start, accelerates dramatically (t^3)
      progress = linearProgress * linearProgress * linearProgress;
    } else if (shaderId === 'transcendent-domain') {
      // Ease-in-quad: gentle slow start for cosmic emergence
      progress = linearProgress * linearProgress;
    } else {
      progress = linearProgress;
    }

    onProgress(progress);

    if (linearProgress >= 1 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  });

  return null;
}

// Audio time tracker - reads playback position from globalAudio
interface AudioTimeTrackerProps {
  onTimeUpdate: (time: number) => void;
}

function AudioTimeTracker({ onTimeUpdate }: AudioTimeTrackerProps) {
  useFrame(() => {
    // Get current playback time from positional or regular audio
    const audio = globalAudio.positionalAudio?.isPlaying
      ? globalAudio.positionalAudio
      : globalAudio.audio;

    if (audio && audio.isPlaying && audio.buffer && globalAudio.playbackStartTime !== null) {
      // Calculate current time based on context time and when playback started
      const context = audio.context;
      const currentTime = context.currentTime - globalAudio.playbackStartTime;
      onTimeUpdate(Math.max(0, currentTime));
    }
  });

  return null;
}

function App() {
  const [selectedShader, setSelectedShader] = useState<string | null>(null);
  const [vrError, setVrError] = useState<string | null>(null);
  const [musicStarted, setMusicStarted] = useState(false);
  const [vrIntroStarted, setVrIntroStarted] = useState(false);
  const [introProgress, setIntroProgress] = useState(0);
  const [introComplete, setIntroComplete] = useState(false);
  const [headRotationY, setHeadRotationY] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [baseBrightness, setBaseBrightness] = useState(1.5);
  const [colorShift, setColorShift] = useState(0.0);
  const [zoom, setZoom] = useState(0.0);
  const [audioTime, setAudioTime] = useState(0);
  const [vrSessionActive, setVrSessionActive] = useState(false);

  // Shared envelopment state for Alien Womb (written by shader, read by hands)
  const envelopmentRef = useRef(0);

  // Subscribe to XR store session changes to detect external session end
  useEffect(() => {
    const unsubscribe = store.subscribe((state, prevState) => {
      const hadSession = prevState.session !== null;
      const hasSession = state.session !== null;

      // Session started
      if (!hadSession && hasSession) {
        console.log('XR session started');
        setVrSessionActive(true);
      }

      // Session ended (externally via menu button, headset removal, etc.)
      if (hadSession && !hasSession) {
        console.log('XR session ended externally');
        setVrSessionActive(false);
        // Reset VR-related state but keep selectedShader so user stays on experience page
        setVrIntroStarted(false);
        setIntroProgress(0);
        setIntroComplete(false);
        setHeadRotationY(0);
        setVrError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Calculate effective brightness (intro affects it for abstract-waves and tunnel-lights)
  const hasIntro = selectedShader === 'abstract-waves' || selectedShader === 'tunnel-lights' || selectedShader === 'infinite-light' || selectedShader === 'sacred-vessels' || selectedShader === 'transcendent-domain' || selectedShader === 'oceanic-dissolution';
  const isInIntro = vrIntroStarted && hasIntro && !introComplete;
  const introBrightness = 0.1 + 0.9 * introProgress; // 0.1 → 1.0
  const brightness = isInIntro ? introBrightness * baseBrightness : baseBrightness;

  // Desktop preview: show shader at full intensity before VR intro starts
  // Once VR intro begins, use the animated introProgress value
  const effectiveIntroProgress = vrIntroStarted ? introProgress : 1.0;

  // BPM pulse disabled for now
  const pulse = 0;

  // Callbacks for intro animator
  const handleIntroProgress = useCallback((progress: number) => {
    setIntroProgress(progress);
  }, []);

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
  }, []);

  const handleHeadRotationCapture = useCallback((rotation: number) => {
    setHeadRotationY(rotation);
  }, []);

  const handleAudioTimeUpdate = useCallback((time: number) => {
    setAudioTime(time);
  }, []);

  const handleSpeedChange = useCallback((delta: number) => {
    setSpeed(prev => Math.max(0.1, Math.min(3.0, prev + delta)));
  }, []);

  const handleBrightnessChange = useCallback((delta: number) => {
    setBaseBrightness(prev => Math.max(0.2, Math.min(2.0, prev + delta)));
  }, []);

  const handleColorShiftChange = useCallback((delta: number) => {
    setColorShift(prev => (prev + delta) % 3.0);
  }, []);

  const handleZoomChange = useCallback((delta: number) => {
    setZoom(prev => Math.max(-1.0, Math.min(1.0, prev + delta)));
  }, []);

  const checkVRSupport = useCallback(async () => {
    if (navigator.xr) {
      try {
        return await navigator.xr.isSessionSupported('immersive-vr');
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const handleSelectShader = useCallback((shaderId: string) => {
    setSelectedShader(shaderId);
    setMusicStarted(true);
  }, []);

  const handleBack = useCallback(() => {
    // Exit VR if in VR mode
    const session = store.getState().session;
    if (session) {
      session.end();
    }

    // Stop all audio when leaving VR - PROPERLY reset state
    if (globalAudio.audio) {
      if (globalAudio.audio.isPlaying) {
        globalAudio.audio.stop();
      }
      // Reset gain to full volume (may have been faded)
      globalAudio.audio.setVolume(0.3);
      // Disconnect to ensure clean state
      try {
        globalAudio.audio.disconnect();
      } catch (e) {
        // May already be disconnected
      }
    }
    if (globalAudio.positionalAudio) {
      if (globalAudio.positionalAudio.isPlaying) {
        globalAudio.positionalAudio.stop();
      }
      // Reset gain to full volume (may have been faded)
      globalAudio.positionalAudio.setVolume(1.5);
      // Disconnect to ensure clean state
      try {
        globalAudio.positionalAudio.disconnect();
      } catch (e) {
        // May already be disconnected
      }
    }
    // Clear current track and reset playback time to allow re-entry
    globalAudio.currentTrack = null;
    globalAudio.playbackStartTime = null;
    setMusicStarted(false);

    setSelectedShader(null);
    setVrIntroStarted(false);
    setIntroProgress(0);
    setIntroComplete(false);
    setHeadRotationY(0);
    setVrError(null);
    setVrSessionActive(false);
  }, []);

  // Auto-return to menu after infinite-light experience ends
  // Duration: intro (35s) + journey delay (5s) + 4 phases (4×96=384s) = 424s total
  // White ending starts 12s before phase 3 ends, hold for 10s, then fade and return
  const experienceEndTimeRef = useRef<number | null>(null);
  const musicFadeStartedRef = useRef<boolean>(false);
  useEffect(() => {
    if (selectedShader !== 'infinite-light' || !introComplete) return;

    // Phase 3 ends at: 5 + (96 × 4) = 389 seconds from intro complete
    // White ending starts 12s before phase 3 ends: 389 - 12 = 377 seconds
    // Hold white for 10 seconds: 377 + 12 + 10 = 399 seconds
    const WHITE_ENDING_START = 5 + (96 * 4) - 12; // 377 seconds - when white expansion begins
    const MUSIC_FADE_START = WHITE_ENDING_START + 5; // Start fading music 5s into white
    const EXPERIENCE_END = WHITE_ENDING_START + 22; // 10s of white hold after initial expansion

    const checkExperienceEnd = () => {
      if (!experienceEndTimeRef.current) {
        experienceEndTimeRef.current = Date.now();
      }

      const elapsed = (Date.now() - experienceEndTimeRef.current) / 1000;

      // Start fading music during white phase
      if (elapsed >= MUSIC_FADE_START && !musicFadeStartedRef.current) {
        musicFadeStartedRef.current = true;
        const audio = globalAudio.positionalAudio || globalAudio.audio;
        if (audio && audio.isPlaying) {
          const ctx = audio.context;
          const gainNode = audio.gain;
          gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 12); // Slow 12s fade
          console.log('Starting music fade out for Infinite Gateway ending');
        }
      }

      // Return to main after white hold
      if (elapsed >= EXPERIENCE_END) {
        console.log('Infinite Gateway experience complete, returning to main');
        handleBack();
        return;
      }
    };

    const interval = setInterval(checkExperienceEnd, 500);
    return () => {
      clearInterval(interval);
      experienceEndTimeRef.current = null;
      musicFadeStartedRef.current = false;
    };
  }, [selectedShader, introComplete, handleBack]);

  const enterVR = useCallback(async () => {
    setVrError(null);
    const supported = await checkVRSupport();
    if (supported) {
      try {
        await store.enterVR();
        // Start VR intro sequence after entering VR
        setVrIntroStarted(true);
      } catch (e) {
        setVrError('Failed to enter VR. Make sure your headset is connected.');
        console.error('VR entry error:', e);
      }
    } else {
      setVrError('WebXR not supported. Open this page in your Quest browser.');
    }
  }, [checkVRSupport]);

  const currentShader = SHADERS.find(s => s.id === selectedShader);

  // Show gallery if no shader selected
  if (!selectedShader) {
    return <ShaderGallery onSelectShader={handleSelectShader} />;
  }

  // Show VR experience for selected shader
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 0], fov: 75 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <XR store={store}>
          <XROrigin position={[0, 0, 0]} />
          <Suspense fallback={null}>
            {/* Capture head rotation when VR starts */}
            <HeadRotationCapture
              shouldCapture={vrIntroStarted}
              onCapture={handleHeadRotationCapture}
            />
            <ShaderRenderer
              shaderId={selectedShader}
              speed={speed}
              pulse={pulse}
              brightness={brightness}
              colorShift={colorShift}
              zoom={zoom}
              headRotationY={headRotationY}
              introProgress={effectiveIntroProgress}
              audioTime={audioTime}
              envelopmentRef={envelopmentRef}
            />
            <VRControllerHandler
              onBack={handleBack}
              onSpeedChange={handleSpeedChange}
              onBrightnessChange={handleBrightnessChange}
              onColorShiftChange={handleColorShiftChange}
              onZoomChange={handleZoomChange}
              vrSessionActive={vrSessionActive}
            />
            <HandGlows shaderId={selectedShader} envelopmentRef={envelopmentRef} />
            <BackgroundMusic shouldPlay={musicStarted} shaderId={selectedShader} headRotationY={headRotationY} />
            {/* VR Intro animator - drives brightness fade using useFrame */}
            <VRIntroAnimator
              started={vrIntroStarted && hasIntro}
              onProgress={handleIntroProgress}
              onComplete={handleIntroComplete}
              shaderId={selectedShader || undefined}
            />
            {/* Track audio playback time for shader sync */}
            <AudioTimeTracker onTimeUpdate={handleAudioTimeUpdate} />
          </Suspense>
        </XR>
      </Canvas>
      <ControlButtons
        onEnterVR={enterVR}
        onBack={handleBack}
        vrError={vrError}
        shaderName={currentShader?.name || 'Shader'}
      />
    </div>
  );
}

export default App;
