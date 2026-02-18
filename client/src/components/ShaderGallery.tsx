import { SHADERS, ShaderInfo } from '../shaders';
import { useEffect, useRef, useState } from 'react';

// Inject fonts once
const fontsInjected = { done: false };
function injectFonts() {
  if (fontsInjected.done || document.getElementById('ontik-gallery-fonts')) return;
  const link = document.createElement('link');
  link.id = 'ontik-gallery-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400;1,500&family=Space+Grotesk:wght@300;400;500;600&display=swap';
  document.head.appendChild(link);
  fontsInjected.done = true;
}

// â”€â”€ Ambient particle canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AmbientField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Sparse, slow-drifting motes
    const motes = Array.from({ length: 28 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -Math.random() * 0.12 - 0.03, // gentle upward drift
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.25 + 0.05,
      // warm amber / soft teal palette â€” contemplative
      hue: Math.random() > 0.5 ? 38 : 175,
    }));

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      motes.forEach(m => {
        m.x += m.vx;
        m.y += m.vy;
        if (m.y < -4) { m.y = canvas.height + 4; m.x = Math.random() * canvas.width; }
        if (m.x < 0) m.x = canvas.width;
        if (m.x > canvas.width) m.x = 0;

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${m.hue}, 60%, 70%, ${m.alpha})`;
        ctx.fill();

        // soft aura
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 5);
        g.addColorStop(0, `hsla(${m.hue}, 60%, 70%, ${m.alpha * 0.4})`);
        g.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  );
}

// â”€â”€ Experience card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ExperienceCard({
  shader, onSelect, animDelay,
}: {
  shader: ShaderInfo; onSelect: () => void; animDelay: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: '100%',
        maxWidth: '360px',
        position: 'relative',
        textAlign: 'left',
        transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        animationDelay: `${animDelay}ms`,
      }}
      className="ontik-card-appear"
    >
      {/* Outer ambient halo */}
      <div style={{
        position: 'absolute', top: '-18px', left: '-18px', right: '-18px', bottom: '-18px',
        borderRadius: '28px',
        background: `radial-gradient(ellipse at center, ${shader.color}18 0%, transparent 68%)`,
        opacity: hovered ? 1 : 0.25,
        transition: 'opacity 0.55s ease',
        pointerEvents: 'none',
      }} />

      {/* Card body */}
      <div style={{
        position: 'relative',
        background: hovered
          ? 'linear-gradient(160deg, rgba(18,16,24,0.98) 0%, rgba(10,8,16,0.99) 100%)'
          : 'linear-gradient(160deg, rgba(13,12,19,0.96) 0%, rgba(8,7,13,0.97) 100%)',
        borderRadius: '20px',
        border: `1px solid ${hovered ? shader.color + '50' : 'rgba(255,255,255,0.07)'}`,
        transition: 'border-color 0.45s ease, background 0.45s ease, box-shadow 0.45s ease',
        boxShadow: hovered
          ? `0 20px 60px -10px ${shader.color}22, 0 0 0 1px ${shader.color}18`
          : '0 8px 32px -8px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Colour accent line at top â€” like a chapter rule */}
        <div style={{
          position: 'absolute', top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: hovered ? '75%' : '35%',
          height: '1.5px',
          background: `linear-gradient(90deg, transparent, ${shader.color}, transparent)`,
          boxShadow: `0 0 16px ${shader.color}80`,
          transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
          borderRadius: '2px',
        }} />

        {/* Content */}
        <div style={{ padding: '36px 32px 32px' }}>
          {/* Badge label */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px',
          }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: shader.color,
              boxShadow: `0 0 ${hovered ? 14 : 6}px ${shader.color}`,
              transition: 'box-shadow 0.4s ease',
              flexShrink: 0,
            }} />
            <span style={{
              color: shader.color,
              fontSize: '0.62rem',
              fontWeight: 600,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              opacity: 0.85,
            }}>
              ExperiÃªncia
            </span>
          </div>

          {/* Shader name â€” italic serif */}
          <h3 style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontSize: '2rem',
            fontWeight: 400,
            color: '#ffffff',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            marginBottom: '14px',
            transition: 'text-shadow 0.4s ease',
            textShadow: hovered ? `0 0 40px ${shader.color}50` : 'none',
          }}>
            {shader.name}
          </h3>

          {/* Description â€” italic, muted */}
          <p style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            color: 'rgba(255,255,255,0.4)',
            lineHeight: 1.75,
            marginBottom: '28px',
            fontWeight: 300,
          }}>
            {shader.description}
          </p>

          {/* Footer row: enter pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: '0.7rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontWeight: 600,
              color: hovered ? shader.color : 'rgba(255,255,255,0.28)',
              transition: 'color 0.35s ease',
            }}>
              Entrar
            </span>
            <div style={{
              borderRadius: '9999px',
              border: `1px solid ${hovered ? shader.color : 'rgba(255,255,255,0.12)'}`,
              background: hovered ? `${shader.color}14` : 'transparent',
              padding: '8px 20px',
              fontSize: '0.75rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              color: hovered ? shader.color : 'rgba(255,255,255,0.38)',
              transition: 'all 0.35s ease',
              boxShadow: hovered ? `0 0 18px ${shader.color}25` : 'none',
            }}>
              Iniciar â†—
            </div>
          </div>
        </div>
      </div>

      {/* Bottom reflection */}
      <div style={{
        position: 'absolute', bottom: '-24px', left: '15%', right: '15%',
        height: '24px',
        background: `linear-gradient(180deg, ${shader.color}07, transparent)`,
        filter: 'blur(8px)',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
      }} />
    </button>
  );
}

// â”€â”€ Gallery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function ShaderGallery({ onSelectShader }: { onSelectShader: (id: string) => void }) {
  useEffect(() => { injectFonts(); }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: '#070610',
      overflowY: 'scroll', overflowX: 'hidden',
      zIndex: 100,
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Ambient particles */}
      <AmbientField />

      {/* Warm void radial â€” subtle top-center warmth */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(120,80,30,0.08) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Main content */}
      <div style={{
        position: 'relative',
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '100px 24px 80px',
        zIndex: 1,
      }}>

        {/* â”€â”€ Header â”€â”€ */}
        <header style={{ textAlign: 'center', marginBottom: '88px' }}>
          {/* Uppermark badge */}
          <p style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'hsl(38, 70%, 65%)',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            marginBottom: '22px',
          }}>
            SantuÃ¡rio Digital
          </p>

          {/* Italic serif title â€” entrementes spirit */}
          <h1 style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(3.5rem, 8vw, 5.5rem)',
            color: '#ffffff',
            letterSpacing: '-0.03em',
            lineHeight: 1.0,
            marginBottom: '20px',
            textShadow: '0 0 100px rgba(255,255,255,0.07)',
          }}>
            Ontik
          </h1>

          {/* Chapter rule divider */}
          <div style={{
            width: '48px', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
            margin: '0 auto 20px',
          }} />

          {/* Sub-label */}
          <p style={{
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            marginBottom: '24px',
            fontWeight: 400,
          }}>
            ExperiÃªncias VR Contemplativas
          </p>

          {/* Poetic intro â€” Cormorant italic, muted */}
          <p style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
            color: 'rgba(255,255,255,0.4)',
            fontWeight: 300,
            maxWidth: '400px',
            margin: '0 auto',
            lineHeight: 1.75,
          }}>
            Escolha um portal. Deixe o espaÃ§o interior expandir.
          </p>
        </header>

        {/* â”€â”€ Card grid â”€â”€ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '36px',
          justifyItems: 'center',
        }}>
          {SHADERS.map((shader, i) => (
            <ExperienceCard
              key={shader.id}
              shader={shader}
              animDelay={i * 80}
              onSelect={() => onSelectShader(shader.id)}
            />
          ))}
        </div>

        {/* â”€â”€ Footer â”€â”€ */}
        <footer style={{ textAlign: 'center', marginTop: '110px', paddingTop: '40px' }}>
          <div style={{
            width: '48px', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
            margin: '0 auto 28px',
          }} />
          <p style={{
            color: 'rgba(255,255,255,0.2)',
            fontSize: '0.72rem',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontWeight: 400,
            letterSpacing: '0.12em',
            marginBottom: '10px',
          }}>
            Melhor experiÃªncia no Meta Quest Â· Otimizado para WebXR
          </p>
          <p style={{
            color: 'rgba(255,255,255,0.12)',
            fontSize: '0.65rem',
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            letterSpacing: '0.08em',
          }}>
            ontik.app
          </p>
        </footer>
      </div>

      {/* CSS: card appear animation + scrollbar */}
      <style>{`
        @keyframes cardAppear {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ontik-card-appear {
          animation: cardAppear 0.7s ease both;
        }
        /* Custom scrollbar â€” minimal, warm */
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: rgba(200,160,80,0.18); border-radius: 4px; }
        div::-webkit-scrollbar-thumb:hover { background: rgba(200,160,80,0.35); }
      `}</style>
    </div>
  );
}
