// Shader registry - all available VR shader experiences
export interface ShaderInfo {
  id: string;
  name: string;
  description: string;
  color: string; // Accent color for the card
}

export const SHADERS: ShaderInfo[] = [
  {
    id: 'audio-reactive',
    name: 'Audio Reactive',
    description: 'Psychedelic patterns that respond to music and microphone input',
    color: '#00ff88'
  },
  {
    id: 'morphing-blobs',
    name: 'Morphing Blobs',
    description: 'Organic raymarched spheres with fluid deformation',
    color: '#ff6b6b'
  },
  {
    id: 'abstract-waves',
    name: 'The Mirror of Lights',
    description: 'Infinite reflections dancing on a luminous surface',
    color: '#ffa500'
  },
  {
    id: 'sunset-clouds',
    name: 'Sunset Clouds',
    description: 'Turbulent atmospheric clouds at golden hour',
    color: '#ff7b54'
  },
  {
    id: 'spiral-tunnel',
    name: 'Spiral Tunnel',
    description: 'Organic cave with cellular surface patterns',
    color: '#9b59b6'
  },
  {
    id: 'bokeh-lights',
    name: 'Bokeh Lights',
    description: 'Dreamy floating magenta and cyan light orbs',
    color: '#e056fd'
  }
];
