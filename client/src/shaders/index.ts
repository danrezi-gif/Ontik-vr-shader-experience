// Shader registry - all available VR shader experiences
export interface ShaderInfo {
  id: string;
  name: string;
  description: string;
  color: string; // Accent color for the card
}

export const SHADERS: ShaderInfo[] = [
  {
    id: 'abstract-waves',
    name: 'The Cosmic Attractor',
    description: 'Luminous orbs journey towards the kernel of spacetime',
    color: '#ffa500'
  },
  {
    id: 'infinite-light',
    name: 'Infinite Gateway',
    description: 'Where does reality end?',
    color: '#ffcc66'
  },
  {
    id: 'sacred-vessels',
    name: 'The Ascension',
    description: 'Luminous streams of sacred water - a Bill Viola meditation',
    color: '#6699ff'
  },
  {
    id: 'tunnel-lights',
    name: 'Alpha and Omega',
    description: 'A sacred passage between being and non-being',
    color: '#4488ff'
  },
  {
    id: 'torus-matrix',
    name: 'The Matrix',
    description: 'Digital rain flows through the infinite',
    color: '#00ff44'
  }
];
