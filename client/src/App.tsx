import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useState, useCallback, useRef, useEffect } from "react";
import { XR, createXRStore } from "@react-three/xr";
import { VRShaderScene, COLOR_PALETTES } from "./components/VRShaderScene";
import { useAudioAnalyzer } from "./hooks/useAudioAnalyzer";
import "@fontsource/inter";
import * as THREE from "three";

const store = createXRStore();

interface ControlButtonsProps {
  onEnterVR: () => void;
  onEnableAudio: () => void;
  audioReady: boolean;
  vrError: string | null;
}

function ControlButtons({ onEnterVR, onEnableAudio, audioReady, vrError }: ControlButtonsProps) {
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
      {!audioReady ? (
        <button
          onClick={onEnableAudio}
          style={{
            padding: '14px 28px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#ff8800',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(255, 136, 0, 0.4)'
          }}
        >
          START AUDIO
        </button>
      ) : (
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
      )}
      
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
        {!audioReady ? (
          <>Tap to enable music & microphone</>
        ) : (
          <>Audio ready! Tap to enter VR<br/>
          In VR: Right Trigger/A/B = Toggle Mic | X/Y = Change Palette</>
        )}
      </div>
    </div>
  );
}

interface VRControllerHandlerProps {
  onToggleMic: () => void;
  onCyclePalette: () => void;
}

function VRControllerHandler({ onToggleMic, onCyclePalette }: VRControllerHandlerProps) {
  const lastButtonStates = useRef<{ [key: string]: boolean }>({});
  const hasLoggedButtons = useRef(false);
  
  useFrame((state) => {
    const session = state.gl.xr.getSession();
    if (!session?.inputSources) return;
    
    session.inputSources.forEach((inputSource) => {
      if (!inputSource.gamepad) return;
      
      const gamepad = inputSource.gamepad;
      const handedness = inputSource.handedness;
      
      if (!hasLoggedButtons.current && gamepad.buttons.length > 0) {
        console.log(`VR Controller ${handedness}: ${gamepad.buttons.length} buttons available`);
        hasLoggedButtons.current = true;
      }
      
      if (handedness === 'right') {
        const triggerPressed = gamepad.buttons[0]?.pressed || false;
        const aPressed = gamepad.buttons[4]?.pressed || false;
        const bPressed = gamepad.buttons[5]?.pressed || false;
        
        if (triggerPressed && !lastButtonStates.current['rtrigger']) {
          console.log('VR: Right trigger pressed - toggling mic');
          onToggleMic();
        }
        if (aPressed && !lastButtonStates.current['a']) {
          console.log('VR: A button pressed - toggling mic');
          onToggleMic();
        }
        if (bPressed && !lastButtonStates.current['b']) {
          console.log('VR: B button pressed - toggling mic');
          onToggleMic();
        }
        
        lastButtonStates.current['rtrigger'] = triggerPressed;
        lastButtonStates.current['a'] = aPressed;
        lastButtonStates.current['b'] = bPressed;
      }
      
      if (handedness === 'left') {
        const xPressed = gamepad.buttons[4]?.pressed || false;
        const yPressed = gamepad.buttons[5]?.pressed || false;
        
        if (xPressed && !lastButtonStates.current['x']) {
          console.log('VR: X button pressed - cycling palette');
          onCyclePalette();
        }
        if (yPressed && !lastButtonStates.current['y']) {
          console.log('VR: Y button pressed - cycling palette');
          onCyclePalette();
        }
        
        lastButtonStates.current['x'] = xPressed;
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
  const [vrError, setVrError] = useState<string | null>(null);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [musicStarted, setMusicStarted] = useState(false);
  const { isListening, audioData, toggleListening } = useAudioAnalyzer();

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

  const enableAudio = useCallback(async () => {
    setVrError(null);
    console.log('Enabling audio before VR...');
    
    // Start background music first (user gesture)
    setMusicStarted(true);
    
    // Request mic permission while browser has focus
    try {
      await toggleListening();
      console.log('Mic enabled successfully');
    } catch (e) {
      console.log('Mic permission denied or failed:', e);
      // Continue anyway - mic is optional
    }
    
    setAudioReady(true);
    console.log('Audio ready, you can now enter VR');
  }, [toggleListening]);

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

  const cyclePalette = useCallback(() => {
    setPaletteIndex(prev => (prev + 1) % COLOR_PALETTES.length);
    console.log('Palette cycled to:', COLOR_PALETTES[(paletteIndex + 1) % COLOR_PALETTES.length].name);
  }, [paletteIndex]);

  const handleToggleMic = useCallback(() => {
    console.log('handleToggleMic called');
    toggleListening();
  }, [toggleListening]);

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
            <VRShaderScene audioData={audioData} paletteIndex={paletteIndex} />
            <VRControllerHandler 
              onToggleMic={handleToggleMic} 
              onCyclePalette={cyclePalette} 
            />
            <BackgroundMusic shouldPlay={musicStarted} />
          </Suspense>
        </XR>
      </Canvas>
      <ControlButtons
        onEnterVR={enterVR}
        onEnableAudio={enableAudio}
        audioReady={audioReady}
        vrError={vrError}
      />
    </div>
  );
}

export default App;
