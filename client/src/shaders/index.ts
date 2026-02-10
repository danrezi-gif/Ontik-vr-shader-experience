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
    id: 'tunnel-lights',
    name: 'Alpha and Omega',
    description: 'A sacred passage between being and non-being',
    color: '#4488ff'
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
    id: 'platonic-solids',
    name: 'Transcendent Objects',
    description: 'Void and Form are one',
    color: '#aa66ff'
  },
  {
    id: 'ascension-testing',
    name: 'Ascension Testing',
    description: 'Development sandbox - building Ascension step by step',
    color: '#66ffcc'
  },
  {
    id: 'transcendent-domain',
    name: 'Transcendent Domain',
    description: 'Fall through an infinite crimson void, accelerating into the unknown',
    color: '#DC143C'
  }
];
