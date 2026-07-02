import { SHADERS, ShaderInfo } from '../shaders';
import { JOURNEY_CHAPTERS, JOURNEY_TOTAL_MINUTES } from '../journey/journey';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// ── Per-section animated canvas background ───────────────────────────────────
// Runs a fluid particle stream tuned to the shader's accent colour.
// Uses IntersectionObserver so only the visible section's canvas animates.
function ShaderPreviewCanvas({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const activeRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    // Parse hex color once
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Flowing line streams — like light filaments
    type Stream = { x: number; y: number; vy: number; vx: number; len: number; alpha: number; w: number };
    const streams: Stream[] = Array.from({ length: 60 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      vx:    (Math.random() - 0.5) * 0.4,
      vy:    -Math.random() * 0.8 - 0.2,
      len:   Math.random() * 80 + 20,
      alpha: Math.random() * 0.2 + 0.04,
      w:     Math.random() * 1.2 + 0.3,
    }));

    // Orb blobs (slow, large, very translucent)
    type Orb = { x: number; y: number; vx: number; vy: number; radius: number; alpha: number };
    const orbs: Orb[] = Array.from({ length: 4 }, () => ({
      x:      Math.random() * canvas.width,
      y:      Math.random() * canvas.height,
      vx:     (Math.random() - 0.5) * 0.15,
      vy:     (Math.random() - 0.5) * 0.15,
      radius: Math.random() * 180 + 80,
      alpha:  0.025 + Math.random() * 0.035,
    }));

    let t = 0;

    const draw = () => {
      if (!activeRef.current) return;
      t += 0.008;

      // Fade-trail instead of full clear — creates streaking effect
      ctx.fillStyle = 'rgba(4,3,8,0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw orbs
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.radius) o.x = canvas.width + o.radius;
        if (o.x > canvas.width + o.radius) o.x = -o.radius;
        if (o.y < -o.radius) o.y = canvas.height + o.radius;
        if (o.y > canvas.height + o.radius) o.y = -o.radius;

        const og = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.radius);
        og.addColorStop(0, `rgba(${r},${g},${b},${o.alpha})`);
        og.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
        ctx.fillStyle = og;
        ctx.fill();
      });

      // Draw streams
      streams.forEach(s => {
        s.x += s.vx + Math.sin(t + s.y * 0.01) * 0.3;
        s.y += s.vy;
        if (s.y + s.len < 0) {
          s.y = canvas.height + s.len;
          s.x = Math.random() * canvas.width;
        }

        const sg = ctx.createLinearGradient(s.x, s.y, s.x + s.vx * 10, s.y - s.len);
        sg.addColorStop(0, `rgba(${r},${g},${b},0)`);
        sg.addColorStop(0.5, `rgba(${r},${g},${b},${s.alpha})`);
        sg.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.vx * 10, s.y - s.len);
        ctx.strokeStyle = sg;
        ctx.lineWidth = s.w;
        ctx.stroke();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    // IntersectionObserver — only animate when visible
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            activeRef.current = true;
            resize();
            rafRef.current = requestAnimationFrame(draw);
          } else {
            activeRef.current = false;
            cancelAnimationFrame(rafRef.current);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(canvas);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      observer.disconnect();
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Individual experience section ────────────────────────────────────────────
function ExperienceSection({
  shader, index, onSelect, id,
}: {
  shader: ShaderInfo; index: number; onSelect: () => void; id?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isEven = index % 2 === 0;

  return (
    <section
      id={id}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isEven ? 'flex-start' : 'flex-end',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Live canvas background */}
      <ShaderPreviewCanvas color={shader.color} />

      {/* Gradient overlay — heavier on the content side */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: isEven
          ? 'linear-gradient(to right, rgba(4,3,8,0.85) 35%, rgba(4,3,8,0.1) 100%)'
          : 'linear-gradient(to left,  rgba(4,3,8,0.85) 35%, rgba(4,3,8,0.1) 100%)',
      }} />

      {/* Content panel */}
      <div style={{
        position: 'relative', zIndex: 10,
        maxWidth: '480px',
        padding: '0 5vw',
        marginLeft:  isEven ? '5vw' : 'auto',
        marginRight: isEven ? 'auto' : '5vw',
      }}>
        {/* Index number — very muted */}
        <p style={{
          color: 'rgba(255,255,255,0.2)',
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          marginBottom: '20px',
        }}>
          Chapter {String(index + 1).padStart(2, '0')}
        </p>

        {/* Accent line */}
        <div style={{
          width: hovered ? '80px' : '40px',
          height: '2px',
          background: shader.color,
          boxShadow: `0 0 12px ${shader.color}`,
          marginBottom: '28px',
          transition: 'width 0.5s ease',
          borderRadius: '2px',
        }} />

        {/* Shader name */}
        <h2 style={{
          color: '#ffffff',
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          fontWeight: 200,
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: '20px',
          textShadow: hovered ? `0 0 60px ${shader.color}40` : 'none',
          transition: 'text-shadow 0.4s ease',
        }}>
          {shader.name}
        </h2>

        {/* Description */}
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '1rem',
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontWeight: 400,
          lineHeight: 1.75,
          marginBottom: '40px',
          fontStyle: 'italic',
        }}>
          {shader.description}
        </p>

        {/* Enter button */}
        <button
          onClick={onSelect}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            background: hovered ? shader.color : 'transparent',
            border: `1px solid ${hovered ? shader.color : 'rgba(255,255,255,0.2)'}`,
            borderRadius: '9999px',
            padding: '14px 32px',
            color: hovered ? '#040308' : 'rgba(255,255,255,0.7)',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: hovered ? `0 0 40px ${shader.color}40` : 'none',
          }}
        >
          Enter
          <span style={{ fontSize: '1rem', transition: 'transform 0.3s ease', transform: hovered ? 'translateX(4px)' : 'translateX(0)' }}>
            →
          </span>
        </button>
      </div>
    </section>
  );
}

// ── Journey hero CTA ─────────────────────────────────────────────────────────
function BeginJourneyButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '14px',
        background: hovered
          ? 'linear-gradient(90deg, #c084fc, #fbbf24)'
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered ? 'transparent' : 'rgba(255,255,255,0.25)'}`,
        borderRadius: '9999px',
        padding: '18px 44px',
        color: hovered ? '#040308' : '#ffffff',
        fontSize: '0.9rem',
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: hovered
          ? '0 0 60px rgba(192,132,252,0.5), 0 0 30px rgba(251,191,36,0.3)'
          : '0 0 30px rgba(192,132,252,0.12)',
      }}
    >
      Begin the Journey
      <span style={{
        fontSize: '1.1rem',
        transition: 'transform 0.3s ease',
        transform: hovered ? 'translateX(5px)' : 'translateX(0)',
      }}>
        →
      </span>
    </button>
  );
}

// ── Chapter arc strip — the journey's shape at a glance ─────────────────────
function ChapterArc() {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: '18px 26px',
      maxWidth: '820px',
      margin: '0 auto',
    }}>
      {JOURNEY_CHAPTERS.map((chapter, i) => (
        <div key={chapter.shaderId} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '34px',
            height: '3px',
            borderRadius: '3px',
            background: chapter.color,
            boxShadow: `0 0 10px ${chapter.color}80`,
          }} />
          <span style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: '0.6rem',
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            whiteSpace: 'nowrap',
          }}>
            {String(i + 1).padStart(2, '0')} {chapter.phase}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Gallery ──────────────────────────────────────────────────────────────────
export function ShaderGallery({ onSelectShader, onBeginJourney, scrollToId }: { onSelectShader: (id: string) => void; onBeginJourney: () => void; scrollToId?: string | null }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!scrollToId || !scrollContainerRef.current) return;
    const target = scrollContainerRef.current.querySelector<HTMLElement>(`#experience-${scrollToId}`);
    if (target) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target.scrollIntoView({ behavior: 'instant' as any });
    }
  }, [scrollToId]);

  return (
    <div ref={scrollContainerRef} style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: '#040308',
      overflowY: 'scroll', overflowX: 'hidden',
      zIndex: 100,
      WebkitOverflowScrolling: 'touch',
    }}>

      {/* ── Hero: the Journey ── */}
      <header style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        padding: '10vh 24px',
      }}>
        {/* Animated hero background */}
        <ShaderPreviewCanvas color="#c084fc" />

        {/* Vignette so text stays readable */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 90% 70% at 50% 50%, rgba(4,3,8,0.55) 0%, rgba(4,3,8,0.9) 100%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            marginBottom: '28px',
          }}>
            A Longform Psychedelic VR Journey
          </p>

          <h1 style={{
            fontSize: 'clamp(3.5rem, 10vw, 6.5rem)',
            fontWeight: 200,
            color: '#ffffff',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            letterSpacing: '-0.04em',
            lineHeight: 1.0,
            marginBottom: '24px',
            textShadow: '0 0 120px rgba(192,132,252,0.25)',
          }}>
            Ontik
          </h1>

          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontWeight: 300,
            lineHeight: 1.8,
            maxWidth: '560px',
            marginBottom: '40px',
          }}>
            One continuous {JOURNEY_TOTAL_MINUTES}-minute arc through seven abstract worlds —
            onset, dissolution, return. Scored by an original generative
            soundtrack that is synthesized live, so no two journeys sound the same.
          </p>

          <BeginJourneyButton onClick={onBeginJourney} />

          <p style={{
            color: 'rgba(255,255,255,0.28)',
            fontSize: '0.7rem',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            letterSpacing: '0.08em',
            margin: '18px 0 56px',
          }}>
            ~{JOURNEY_TOTAL_MINUTES} minutes · headphones recommended · works on desktop &amp; in VR
          </p>

          <ChapterArc />
        </div>

        {/* Scroll cue */}
        <div style={{
          position: 'absolute', bottom: '2rem', left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        }}>
          <span style={{
            color: 'rgba(255,255,255,0.2)',
            fontSize: '0.6rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
          }}>
            Explore the chapters
          </span>
          <div style={{
            width: '1px', height: '36px',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)',
          }} />
        </div>
      </header>

      {/* ── Chapters intro strip ── */}
      <div style={{
        textAlign: 'center',
        padding: '72px 24px 8px',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
        }}>
          The Chapters — enter any world on its own
        </p>
      </div>

      {/* ── Experience sections ── */}
      {SHADERS.map((shader, i) => (
        <ExperienceSection
          key={shader.id}
          id={`experience-${shader.id}`}
          shader={shader}
          index={i}
          onSelect={() => onSelectShader(shader.id)}
        />
      ))}

      {/* ── Footer ── */}
      <footer style={{
        textAlign: 'center',
        padding: '48px 24px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.18)',
          fontSize: '0.72rem',
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          letterSpacing: '0.1em',
          lineHeight: 2,
        }}>
          Best experienced in VR · Meta Quest optimized<br />
          Original generative soundtrack — synthesized live, every session unique
        </p>
      </footer>

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}
