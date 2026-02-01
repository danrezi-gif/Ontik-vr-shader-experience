import { SHADERS, ShaderInfo } from '../shaders';

interface ShaderGalleryProps {
  onSelectShader: (shaderId: string) => void;
}

function ShaderCard({ shader, onSelect, index }: { shader: ShaderInfo; onSelect: () => void; index: number }) {
  return (
    <button
      onClick={onSelect}
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '32px 28px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%',
        maxWidth: '340px',
        position: 'relative',
        overflow: 'hidden',
        animationDelay: `${index * 0.1}s`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.borderColor = `${shader.color}44`;
        e.currentTarget.style.boxShadow = `0 20px 40px rgba(0, 0, 0, 0.4), 0 0 60px ${shader.color}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Accent line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '28px',
        right: '28px',
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${shader.color}66, transparent)`,
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: shader.color,
          boxShadow: `0 0 12px ${shader.color}`,
        }} />
        <span style={{
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '0.7rem',
          fontWeight: '500',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
        }}>
          Experience
        </span>
      </div>

      <h3 style={{
        color: '#ffffff',
        fontSize: '1.5rem',
        fontWeight: '300',
        marginBottom: '12px',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        letterSpacing: '-0.02em',
      }}>
        {shader.name}
      </h3>

      <p style={{
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '0.875rem',
        lineHeight: '1.6',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        fontWeight: '400',
        marginBottom: '24px',
      }}>
        {shader.description}
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          color: shader.color,
          fontSize: '0.8rem',
          fontWeight: '500',
          letterSpacing: '0.05em',
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
        }}>
          Launch
        </span>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: `1px solid ${shader.color}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: shader.color,
          fontSize: '0.9rem',
          transition: 'all 0.3s ease',
        }}>
          →
        </div>
      </div>
    </button>
  );
}

export function ShaderGallery({ onSelectShader }: ShaderGalleryProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#050508',
      overflowY: 'scroll',
      overflowX: 'hidden',
      zIndex: 100,
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Subtle gradient overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(60, 60, 80, 0.15) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '80px 24px 60px',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '72px',
        }}>
          <p style={{
            color: 'rgba(255, 255, 255, 0.35)',
            fontSize: '0.75rem',
            fontWeight: '500',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '20px',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
          }}>
            Immersive Visuals
          </p>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            fontWeight: '200',
            color: '#ffffff',
            marginBottom: '20px',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            letterSpacing: '-0.03em',
            lineHeight: '1.1',
          }}>
            Digital Sanctuary
          </h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '1rem',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontWeight: '400',
            maxWidth: '400px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}>
            Select an experience to begin your journey
          </p>
        </div>

        {/* Shader Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '28px',
          justifyItems: 'center',
        }}>
          {SHADERS.map((shader, index) => (
            <ShaderCard
              key={shader.id}
              shader={shader}
              index={index}
              onSelect={() => onSelectShader(shader.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '80px',
          paddingTop: '40px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <p style={{
            color: 'rgba(255, 255, 255, 0.3)',
            fontSize: '0.8rem',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontWeight: '400',
          }}>
            Optimized for Meta Quest  ·  Works on all devices
          </p>
        </div>
      </div>
    </div>
  );
}
