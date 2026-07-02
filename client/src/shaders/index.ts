// Shader registry - all available VR shader experiences
export interface ShaderInfo {
  id: string;
  name: string;
  description: string;
  color: string; // Accent color for the card
}

export const SHADERS: ShaderInfo[] = [
  {
    id: 'prismatic-bloom',
    name: 'Prismatic Bloom',
    description: 'A living kaleidoscopic mandala breathes open — geometry blooms out of darkness',
    color: '#c084fc'
  },
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
    id: 'transcendent-domain',
    name: 'Transcendent Domain',
    description: 'Fall through an infinite crimson void, accelerating into the unknown',
    color: '#DC143C'
  },
  {
    id: 'oceanic-dissolution',
    name: 'Alien Womb',
    description: 'An organic intelligence reaches for you — and you become one',
    color: '#2DD4BF'
  },
  {
    id: 'solar-return',
    name: 'Solar Return',
    description: 'An endless dawn — integration, warmth, the slow return to the body',
    color: '#fbbf24'
  }
];
