import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useState, useCallback, useRef, useEffect } from "react";
import { XR, createXRStore, XROrigin } from "@react-three/xr";
import { VRShaderScene } from "./components/VRShaderScene";
import { ShaderGallery } from "./components/ShaderGallery";
import { MorphingBlobsShader } from "./shaders/MorphingBlobsShader";
import { AbstractWavesShader } from "./shaders/AbstractWavesShader";
import { SunsetCloudsShader } from "./shaders/SunsetCloudsShader";
import { SpiralTunnelShader } from "./shaders/SpiralTunnelShader";
import { BokehLightsShader } from "./shaders/BokehLightsShader";
import { useAudioAnalyzer } from "./hooks/useAudioAnalyzer";
import { SHADERS } from "./shaders";
import "@fontsource/inter";
import * as THREE from "three";

const store = createXRStore();

// Shader component mapping
interface ShaderRendererProps {
  shaderId: string;
  audioData: any;
  speed: number;
  pulse: number;
  brightness: number;
  colorShift: number;
  zoom: number;
  headRotationY: number;
}

function ShaderRenderer({ shaderId, audioData, speed, pulse, brightness, colorShift, zoom, headRotationY }: ShaderRendererProps) {
  switch (shaderId) {
    case 'audio-reactive':
      return <VRShaderScene audioData={audioData} paletteIndex={0} />;
    case 'morphing-blobs':
      return <MorphingBlobsShader />;
    case 'abstract-waves':
      return <AbstractWavesShader speed={speed} brightness={brightness} colorShift={colorShift} zoom={zoom} pulse={pulse} headRotationY={headRotationY} />;
    case 'sunset-clouds':
      return <SunsetCloudsShader speed={speed} />;
    case 'spiral-tunnel':
      return <SpiralTunnelShader />;
    case 'bokeh-lights':
      return <BokehLightsShader />;
    default:
      return <VRShaderScene audioData={audioData} paletteIndex={0} />;
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
}

function VRControllerHandler({ onBack, onSpeedChange, onBrightnessChange, onColorShiftChange, onZoomChange }: VRControllerHandlerProps) {
  const lastButtonStates = useRef<{ [key: string]: boolean }>({});
  const audioResumed = useRef(false);

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

// Shader-specific audio tracks
const SHADER_AUDIO: { [key: string]: string } = {
  'abstract-waves': 'The Birth of the Holy.mp3',
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
  listener: null as THREE.AudioListener | null,
  currentTrack: null as string | null,
  initialized: false
};

function getAudioBufferForShader(shaderId: string): AudioBuffer | null {
  return audioBuffers[shaderId] || audioBuffers['default'] || null;
}

function initAudioListener(camera: THREE.Camera) {
  if (globalAudio.initialized) return;
  globalAudio.initialized = true;

  const listener = new THREE.AudioListener();
  camera.add(listener);
  globalAudio.listener = listener;

  const audio = new THREE.Audio(listener);
  audio.setLoop(true);
  audio.setVolume(0.3);
  globalAudio.audio = audio;
}

function playTrackForShader(shaderId: string) {
  if (!globalAudio.audio || !globalAudio.listener) return;

  const buffer = getAudioBufferForShader(shaderId);
  if (!buffer) {
    console.log('Audio buffer not ready for:', shaderId);
    return;
  }

  // If same track is already playing, don't restart
  if (globalAudio.currentTrack === shaderId && globalAudio.audio.isPlaying) {
    return;
  }

  // Stop current track if playing
  if (globalAudio.audio.isPlaying) {
    globalAudio.audio.stop();
  }

  // Set new buffer and play
  globalAudio.audio.setBuffer(buffer);
  globalAudio.currentTrack = shaderId;

  const ctx = globalAudio.listener.context;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      globalAudio.audio?.play();
      console.log('Playing track for:', shaderId);
    });
  } else {
    globalAudio.audio.play();
    console.log('Playing track for:', shaderId);
  }
}

interface BackgroundMusicProps {
  shouldPlay: boolean;
  shaderId: string;
}

function BackgroundMusic({ shouldPlay, shaderId }: BackgroundMusicProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (!shouldPlay) return;

    // Initialize audio listener if needed
    initAudioListener(camera);

    // Try to play the track
    const tryPlay = () => {
      const buffer = getAudioBufferForShader(shaderId);
      if (buffer) {
        playTrackForShader(shaderId);
        return true;
      }
      return false;
    };

    // If buffer not ready, poll until it is
    if (!tryPlay()) {
      const checkInterval = setInterval(() => {
        if (tryPlay()) {
          clearInterval(checkInterval);
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
}

function VRIntroAnimator({ started, onProgress, onComplete }: VRIntroAnimatorProps) {
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
    const duration = 8000; // 8 seconds
    const progress = Math.min(1, elapsed / duration);

    onProgress(progress);

    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
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
  const { audioData, toggleListening } = useAudioAnalyzer();

  // Calculate effective brightness (intro affects it for abstract-waves only)
  const isInIntro = vrIntroStarted && selectedShader === 'abstract-waves' && !introComplete;
  const introBrightness = 0.1 + 0.9 * introProgress; // 0.1 → 1.0
  const brightness = isInIntro ? introBrightness * baseBrightness : baseBrightness;

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

    // Start audio for audio-reactive shader
    if (shaderId === 'audio-reactive') {
      toggleListening();
    }
  }, [toggleListening]);

  const handleBack = useCallback(() => {
    // Exit VR if in VR mode
    const session = store.getState().session;
    if (session) {
      session.end();
    }
    setSelectedShader(null);
    setVrIntroStarted(false);
    setIntroProgress(0);
    setIntroComplete(false);
    setHeadRotationY(0);
    setVrError(null);
  }, []);

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
              audioData={audioData}
              speed={speed}
              pulse={pulse}
              brightness={brightness}
              colorShift={colorShift}
              zoom={zoom}
              headRotationY={headRotationY}
            />
            <VRControllerHandler
              onBack={handleBack}
              onSpeedChange={handleSpeedChange}
              onBrightnessChange={handleBrightnessChange}
              onColorShiftChange={handleColorShiftChange}
              onZoomChange={handleZoomChange}
            />
            <BackgroundMusic shouldPlay={musicStarted} shaderId={selectedShader} />
            {/* VR Intro animator - drives brightness fade using useFrame */}
            <VRIntroAnimator
              started={vrIntroStarted && selectedShader === 'abstract-waves'}
              onProgress={handleIntroProgress}
              onComplete={handleIntroComplete}
            />
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
