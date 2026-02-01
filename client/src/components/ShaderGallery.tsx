import { SHADERS, ShaderInfo } from '../shaders';

interface ShaderGalleryProps {
  onSelectShader: (shaderId: string) => void;
}

function ShaderCard({ shader, onSelect }: { shader: ShaderInfo; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        background: `linear-gradient(135deg, ${shader.color}22, ${shader.color}44)`,
        border: `2px solid ${shader.color}`,
        borderRadius: '16px',
        padding: '24px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.3s ease',
        width: '100%',
        maxWidth: '320px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = `0 8px 32px ${shader.color}66`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <h3 style={{
        color: shader.color,
        fontSize: '1.4rem',
        fontWeight: 'bold',
        marginBottom: '8px',
        fontFamily: 'Inter, sans-serif'
      }}>
        {shader.name}
      </h3>
      <p style={{
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '0.9rem',
        lineHeight: '1.4',
        fontFamily: 'Inter, sans-serif'
      }}>
        {shader.description}
      </p>
      <div style={{
        marginTop: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: shader.color,
        fontSize: '0.85rem',
        fontWeight: '600'
      }}>
        <span>Enter VR</span>
        <span style={{ fontSize: '1.2rem' }}>→</span>
      </div>
    </button>
  );
}

export function ShaderGallery({ onSelectShader }: ShaderGalleryProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
      overflow: 'auto',
      zIndex: 100
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '48px'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px',
            fontFamily: 'Inter, sans-serif'
          }}>
            VR Shader Gallery
          </h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '1.1rem',
            fontFamily: 'Inter, sans-serif'
          }}>
            Select a shader experience to enter VR
          </p>
        </div>

        {/* Shader Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          justifyItems: 'center'
        }}>
          {SHADERS.map((shader) => (
            <ShaderCard
              key={shader.id}
              shader={shader}
              onSelect={() => onSelectShader(shader.id)}
            />
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          textAlign: 'center',
          marginTop: '48px',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '0.85rem',
          fontFamily: 'Inter, sans-serif'
        }}>
          <p>Best experienced in VR headset (Meta Quest Browser)</p>
          <p style={{ marginTop: '8px' }}>Works on desktop and mobile for preview</p>
        </div>
      </div>
    </div>
  );
}
