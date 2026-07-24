
import './toggle.css'

export default function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className="toggle-container" style={{ opacity: disabled ? 0.5 : 1 }}>
      <span className="toggle-label">{label}</span>
      <div className={`toggle ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className="toggle-slider"></div>
      </div>
    </label>
  )
}
