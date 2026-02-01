import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useState, useCallback, useRef, useEffect } from "react";
import { XR, createXRStore } from "@react-three/xr";
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
function ShaderRenderer({ shaderId, audioData }: { shaderId: string; audioData: any }) {
  switch (shaderId) {
    case 'audio-reactive':
      return <VRShaderScene audioData={audioData} paletteIndex={0} />;
    case 'morphing-blobs':
      return <MorphingBlobsShader />;
    case 'abstract-waves':
      return <AbstractWavesShader />;
    case 'sunset-clouds':
      return <SunsetCloudsShader />;
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
}

function VRControllerHandler({ onBack }: VRControllerHandlerProps) {
  const lastButtonStates = useRef<{ [key: string]: boolean }>({});

  useFrame((state) => {
    const session = state.gl.xr.getSession();
    if (!session?.inputSources) return;

    session.inputSources.forEach((inputSource) => {
      if (!inputSource.gamepad) return;

      const gamepad = inputSource.gamepad;
      const handedness = inputSource.handedness;

      // B button or Y button to go back
      if (handedness === 'right') {
        const bPressed = gamepad.buttons[5]?.pressed || false;
        if (bPressed && !lastButtonStates.current['b']) {
          onBack();
        }
        lastButtonStates.current['b'] = bPressed;
      }

      if (handedness === 'left') {
        const yPressed = gamepad.buttons[5]?.pressed || false;
        if (yPressed && !lastButtonStates.current['y']) {
          onBack();
        }
        lastButtonStates.current['y'] = yPressed;
      }
    });
  });

  return null;
}

const globalAudio = {
  buffer: null as AudioBuffer | null,
  loaded: false,
  audio: null as THREE.Audio | null,
  listener: null as THREE.AudioListener | null,
  started: false
};

const audioLoader = new THREE.AudioLoader();
audioLoader.load('/audio/background-music.mp3', (buffer) => {
  globalAudio.buffer = buffer;
  globalAudio.loaded = true;
  console.log('Background music preloaded');
}, undefined, (err) => {
  console.error('Error preloading background music:', err);
});

function startBackgroundMusicNow(camera: THREE.Camera) {
  if (globalAudio.started || !globalAudio.buffer) return;
  globalAudio.started = true;

  const listener = new THREE.AudioListener();
  camera.add(listener);
  globalAudio.listener = listener;

  const audio = new THREE.Audio(listener);
  globalAudio.audio = audio;

  audio.setBuffer(globalAudio.buffer);
  audio.setLoop(true);
  audio.setVolume(0.3);

  if (listener.context.state === 'suspended') {
    listener.context.resume().then(() => {
      audio.play();
      console.log('Background music started after resume');
    });
  } else {
    audio.play();
    console.log('Background music started immediately');
  }
}

interface BackgroundMusicProps {
  shouldPlay: boolean;
}

function BackgroundMusic({ shouldPlay }: BackgroundMusicProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (!shouldPlay || globalAudio.started) return;

    if (globalAudio.loaded) {
      startBackgroundMusicNow(camera);
    } else {
      const checkInterval = setInterval(() => {
        if (globalAudio.loaded && !globalAudio.started) {
          startBackgroundMusicNow(camera);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    return () => {
      if (globalAudio.audio?.isPlaying) {
        globalAudio.audio.stop();
      }
      if (globalAudio.listener) {
        camera.remove(globalAudio.listener);
      }
    };
  }, [camera, shouldPlay]);

  return null;
}

function App() {
  const [selectedShader, setSelectedShader] = useState<string | null>(null);
  const [vrError, setVrError] = useState<string | null>(null);
  const [musicStarted, setMusicStarted] = useState(false);
  const { audioData, toggleListening } = useAudioAnalyzer();

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
    setVrError(null);
  }, []);

  const enterVR = useCallback(async () => {
    setVrError(null);
    const supported = await checkVRSupport();
    if (supported) {
      try {
        await store.enterVR();
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
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <XR store={store}>
          <Suspense fallback={null}>
            <ShaderRenderer shaderId={selectedShader} audioData={audioData} />
            <VRControllerHandler onBack={handleBack} />
            <BackgroundMusic shouldPlay={musicStarted} />
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
