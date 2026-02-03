import { SHADERS, ShaderInfo } from '../shaders';
import { useEffect, useRef, useState } from 'react';

interface ShaderGalleryProps {
  onSelectShader: (shaderId: string) => void;
}

// Floating particles background
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Particles
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string }[] = [];
    const colors = ['#ffa500', '#4488ff', '#ffcc66', '#6699ff', '#aa66ff'];

    // Create sparse particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15 - 0.05, // Slight upward drift
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();

        // Soft glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = p.alpha * 0.3;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

// Portal-style card with light bleeding through
function PortalCard({ shader, onSelect, index }: { shader: ShaderInfo; onSelect: () => void; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: '100%',
        maxWidth: '340px',
        position: 'relative',
        transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
      }}
    >
      {/* Outer glow - light bleeding from portal */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        left: '-20px',
        right: '-20px',
        bottom: '-20px',
        borderRadius: '32px',
        background: `radial-gradient(ellipse at center, ${shader.color}15 0%, transparent 70%)`,
        opacity: isHovered ? 1 : 0.3,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
      }} />

      {/* Portal frame */}
      <div style={{
        position: 'relative',
        background: 'rgba(8, 8, 12, 0.9)',
        borderRadius: '24px',
        padding: '3px',
        overflow: 'hidden',
      }}>
        {/* Animated border glow */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: '24px',
          background: `linear-gradient(135deg, ${shader.color}40, transparent 40%, transparent 60%, ${shader.color}20)`,
          opacity: isHovered ? 1 : 0.4,
          transition: 'opacity 0.4s ease',
        }} />

        {/* Inner portal content */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(180deg, rgba(15, 15, 22, 0.98) 0%, rgba(8, 8, 12, 0.99) 100%)',
          borderRadius: '22px',
          padding: '32px 28px',
          textAlign: 'left',
        }}>
          {/* Top light beam - like light through doorway crack */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: isHovered ? '80%' : '40%',
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${shader.color}, transparent)`,
            boxShadow: `0 0 20px ${shader.color}60, 0 0 40px ${shader.color}30`,
            transition: 'width 0.4s ease',
            borderRadius: '2px',
          }} />

          {/* Side light beams */}
          <div style={{
            position: 'absolute',
            top: '20%',
            bottom: '20%',
            left: 0,
            width: '1px',
            background: `linear-gradient(180deg, transparent, ${shader.color}60, transparent)`,
            opacity: isHovered ? 1 : 0.3,
            transition: 'opacity 0.4s ease',
          }} />
          <div style={{
            position: 'absolute',
            top: '20%',
            bottom: '20%',
            right: 0,
            width: '1px',
            background: `linear-gradient(180deg, transparent, ${shader.color}60, transparent)`,
            opacity: isHovered ? 1 : 0.3,
            transition: 'opacity 0.4s ease',
          }} />

          {/* Content */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}>
            {/* Pulsing orb */}
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: shader.color,
              boxShadow: `0 0 ${isHovered ? '20px' : '10px'} ${shader.color}`,
              transition: 'box-shadow 0.4s ease',
              animation: 'pulse 3s ease-in-out infinite',
            }} />
            <span style={{
              color: 'rgba(255, 255, 255, 0.35)',
              fontSize: '0.65rem',
              fontWeight: '600',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
            }}>
              Portal
            </span>
          </div>

          <h3 style={{
            color: '#ffffff',
            fontSize: '1.6rem',
            fontWeight: '300',
            marginBottom: '12px',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            letterSpacing: '-0.02em',
            textShadow: isHovered ? `0 0 30px ${shader.color}40` : 'none',
            transition: 'text-shadow 0.4s ease',
          }}>
            {shader.name}
          </h3>

          <p style={{
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: '0.875rem',
            lineHeight: '1.7',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontWeight: '400',
            marginBottom: '28px',
            fontStyle: 'italic',
          }}>
            {shader.description}
          </p>

          {/* Enter button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              color: isHovered ? shader.color : 'rgba(255, 255, 255, 0.5)',
              fontSize: '0.8rem',
              fontWeight: '500',
              letterSpacing: '0.1em',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              transition: 'color 0.3s ease',
              textTransform: 'uppercase',
            }}>
              Enter
            </span>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: `1px solid ${isHovered ? shader.color : 'rgba(255, 255, 255, 0.15)'}`,
              background: isHovered ? `${shader.color}15` : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isHovered ? shader.color : 'rgba(255, 255, 255, 0.4)',
              fontSize: '1.1rem',
              transition: 'all 0.3s ease',
              boxShadow: isHovered ? `0 0 20px ${shader.color}30` : 'none',
            }}>
              ↳
            </div>
          </div>
        </div>
      </div>

      {/* Bottom reflection */}
      <div style={{
        position: 'absolute',
        bottom: '-30px',
        left: '10%',
        right: '10%',
        height: '30px',
        background: `linear-gradient(180deg, ${shader.color}08, transparent)`,
        filter: 'blur(10px)',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
      }} />
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
      background: '#030305',
      overflowY: 'scroll',
      overflowX: 'hidden',
      zIndex: 100,
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Particle field background */}
      <ParticleField />

      {/* Deep void gradient */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(40, 40, 60, 0.12) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '80px 24px 60px',
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '80px',
        }}>
          <p style={{
            color: 'rgba(255, 255, 255, 0.3)',
            fontSize: '0.7rem',
            fontWeight: '600',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '24px',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
          }}>
            Contemplative Experiences
          </p>
          <h1 style={{
            fontSize: 'clamp(2.8rem, 7vw, 4.5rem)',
            fontWeight: '200',
            color: '#ffffff',
            marginBottom: '24px',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            letterSpacing: '-0.04em',
            lineHeight: '1.05',
            textShadow: '0 0 80px rgba(255, 255, 255, 0.1)',
          }}>
            The Threshold
          </h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.35)',
            fontSize: '1.05rem',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontWeight: '400',
            maxWidth: '380px',
            margin: '0 auto',
            lineHeight: '1.7',
            fontStyle: 'italic',
          }}>
            Choose a portal to begin
          </p>
        </div>

        {/* Portal Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '40px',
          justifyItems: 'center',
        }}>
          {SHADERS.map((shader, index) => (
            <PortalCard
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
          marginTop: '100px',
          paddingTop: '40px',
        }}>
          <div style={{
            width: '60px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            margin: '0 auto 30px',
          }} />
          <p style={{
            color: 'rgba(255, 255, 255, 0.25)',
            fontSize: '0.75rem',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontWeight: '400',
            letterSpacing: '0.1em',
          }}>
            Best experienced in VR  ·  Meta Quest optimized
          </p>
        </div>
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
