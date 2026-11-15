import './borderBeam.css';

/**
 * BorderBeam Component (inspired by Vengeance UI)
 * Creates an animated electric cyber-emerald laser beam along the perimeter of cards/buttons.
 */
export default function BorderBeam({
  className = '',
  size = 250,
  duration = 8,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = '#00ff88',
  colorTo = 'transparent',
  delay = 0,
}) {
  return (
    <div
      style={{
        '--size': `${size}px`,
        '--duration': `${duration}s`,
        '--anchor': `${anchor}%`,
        '--border-width': `${borderWidth}px`,
        '--color-from': colorFrom,
        '--color-to': colorTo,
        '--delay': `-${delay}s`,
      }}
      className={`border-beam-container ${className}`}
      aria-hidden="true"
    >
      <div className="border-beam-line" />
    </div>
  );
}
