import { useState, useRef } from 'react';
import './spotlightCard.css';

/**
 * SpotlightCard Component (inspired by Skiper UI & Vengeance UI)
 * Dynamic cursor-tracking spotlight across dark obsidian card surfaces and borders.
 */
export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(0, 255, 136, 0.14)',
  borderColor = 'rgba(0, 255, 136, 0.35)',
  ...props
}) {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => setOpacity(1);
  const handleBlur = () => setOpacity(0);
  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`spotlight-card ${className}`}
      {...props}
    >
      {/* Dynamic Cursor Spotlight Layer */}
      <div
        className="spotlight-layer"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
        aria-hidden="true"
      />
      
      {/* Border Spotlight Glow */}
      <div
        className="spotlight-border"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${borderColor}, transparent 40%)`,
        }}
        aria-hidden="true"
      />

      <div className="spotlight-content">{children}</div>
    </div>
  );
}
