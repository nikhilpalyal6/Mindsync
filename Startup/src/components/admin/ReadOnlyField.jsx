import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const ReadOnlyField = React.memo(({ label, value, copyable = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', minWidth: 0 }}>
      {label && (
        <span style={{ fontSize: '0.725rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      )}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '10px 14px', 
        backgroundColor: 'rgba(255, 255, 255, 0.01)', 
        border: '1px solid var(--admin-border)', 
        borderRadius: '8px',
        minHeight: '42px',
        width: '100%',
        minWidth: 0,
        transition: 'border-color 0.2s ease'
      }}>
        <span style={{ fontSize: '0.85rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {value !== undefined && value !== null ? value.toString() : 'Configuration unavailable'}
        </span>

        {copyable && value && (
          <button
            type="button"
            onClick={handleCopy}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: copied ? '#10b981' : 'var(--admin-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '6px',
              marginLeft: '8px',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            title="Copy to clipboard"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
});

ReadOnlyField.displayName = 'ReadOnlyField';
export default ReadOnlyField;
