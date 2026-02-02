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
    id: 'abstract-waves',
    name: 'The Mirror of Lights',
    description: 'Infinite reflections dancing on a luminous surface',
    color: '#ffa500'
  },
  {
    id: 'tunnel-lights',
    name: 'The Luminous Path',
    description: 'A sacred passage toward the divine light',
    color: '#4488ff'
  },
  {
    id: 'infinite-light',
    name: 'Infinite Light',
    description: 'One light becomes infinite - a Kusama-inspired meditation',
    color: '#ffcc66'
  },
  {
    id: 'sacred-vessels',
    name: 'The Vessels',
    description: 'Luminous streams of sacred water - a Bill Viola meditation',
    color: '#6699ff'
  },
  {
    id: 'sunset-clouds',
    name: 'Sunset Clouds',
    description: 'Turbulent atmospheric clouds at golden hour',
    color: '#ff7b54'
  },
  {
    id: 'platonic-solids',
    name: 'Sacred Geometry',
    description: 'The five platonic solids emerge from the void - mathematical perfection',
    color: '#aa66ff'
  }
];
