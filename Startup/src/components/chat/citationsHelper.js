import React from 'react';

// Format timestamp in MM:SS or HH:MM:SS format
export const formatTimestamp = (sec) => {
  if (sec === undefined || sec === null || isNaN(sec)) return '';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  
  const pad = (n) => String(n).padStart(2, '0');
  
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
};

// Formats PDF page details
export const getPdfPageString = (start, end) => {
  if (start !== undefined && start !== null && end !== undefined && end !== null && start !== end) {
    return `Pages ${start}–${end}`;
  } else if (start !== undefined && start !== null) {
    return `Page ${start}`;
  }
  return '';
};

// Formats YouTube timestamp details
export const getYouTubeDurationString = (start, end) => {
  const startStr = formatTimestamp(start);
  const endStr = formatTimestamp(end);
  if (startStr && endStr) {
    return `${startStr}–${endStr}`;
  } else if (startStr) {
    return startStr;
  }
  return '';
};

// Normalize citations defensively
export const normalizeCitations = (citations) => {
  if (!Array.isArray(citations)) return [];
  const valid = [];
  const seenIndices = new Set();
  
  citations.forEach(c => {
    if (
      c &&
      typeof c.index === 'number' &&
      c.index > 0 &&
      c.title &&
      c.resourceType &&
      ['pdf', 'youtube', 'notes'].includes(c.resourceType.toLowerCase()) &&
      !seenIndices.has(c.index)
    ) {
      valid.push(c);
      seenIndices.add(c.index);
    }
  });
  
  return valid;
};

// Inline citations parser
export const parseCitations = (text, citationsMap, onCitationClick) => {
  if (!text) return '';
  if (!citationsMap || citationsMap.size === 0) return text;
  
  const parts = text.split(/(\[\d+\])/g);
  
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const index = parseInt(match[1], 10);
      const citation = citationsMap.get(index);
      if (citation) {
        return React.createElement(
          'button',
          {
            key: `cit-${index}-${i}`,
            onClick: () => onCitationClick && onCitationClick(citation),
            'aria-label': `View citation ${index}: ${citation.title}${
              citation.pageStart !== undefined && citation.pageStart !== null ? `, page ${citation.pageStart}` : ''
            }${
              citation.timestampStart !== undefined && citation.timestampStart !== null ? `, timestamp ${citation.timestampStart}` : ''
            }`,
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(167, 139, 250, 0.15)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              borderRadius: '4px',
              color: '#c084fc',
              fontSize: '0.725rem',
              fontWeight: '600',
              padding: '1px 5px',
              margin: '0 2px',
              cursor: 'pointer',
              verticalAlign: 'middle',
              lineHeight: '1',
              transition: 'all 0.15s ease',
              outline: 'none',
            },
            tabIndex: 0,
            role: 'button',
            onMouseOver: (e) => {
              e.currentTarget.style.backgroundColor = 'rgba(167, 139, 250, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.5)';
            },
            onMouseOut: (e) => {
              e.currentTarget.style.backgroundColor = 'rgba(167, 139, 250, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.3)';
            },
            onFocus: (e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.4)';
            },
            onBlur: (e) => {
              e.currentTarget.style.boxShadow = 'none';
            }
          },
          `[${index}]`
        );
      }
    }
    return part;
  });
};

// Render Sources Cited Section
export const renderSourcesCited = (citations, isUser, onCitationClick) => {
  const validList = normalizeCitations(citations);
  if (isUser || validList.length === 0) return null;

  return React.createElement(
    'div',
    {
      className: 'sources-cited-section',
      style: {
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        width: '100%',
      }
    },
    React.createElement(
      'div',
      {
        style: {
          fontSize: '0.725rem',
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.5)',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }
      },
      'Sources Cited'
    ),
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }
      },
      validList.map(cit => {
        const labelMap = { pdf: 'PDF', youtube: 'YouTube', notes: 'Notes' };
        const typeLabel = labelMap[cit.resourceType?.toLowerCase()] || 'Resource';
        
        let detailStr = '';
        if (cit.resourceType?.toLowerCase() === 'pdf') {
          detailStr = getPdfPageString(cit.pageStart, cit.pageEnd);
        } else if (cit.resourceType?.toLowerCase() === 'youtube') {
          detailStr = getYouTubeDurationString(cit.timestampStart, cit.timestampEnd);
        }
        
        const metaInfo = detailStr ? `${typeLabel} · ${detailStr}` : typeLabel;

        return React.createElement(
          'div',
          {
            key: cit.index,
            onClick: () => onCitationClick && onCitationClick(cit),
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCitationClick && onCitationClick(cit);
              }
            },
            tabIndex: 0,
            role: 'button',
            'aria-label': `Source ${cit.index}: ${cit.title}, ${metaInfo}`,
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: onCitationClick ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              outline: 'none'
            },
            onMouseOver: (e) => {
              if (onCitationClick) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }
            },
            onMouseOut: (e) => {
              if (onCitationClick) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
              }
            },
            onFocus: (e) => {
              e.currentTarget.style.borderColor = '#a78bfa';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.2)';
            },
            onBlur: (e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.boxShadow = 'none';
            }
          },
          React.createElement(
            'div',
            {
              style: {
                fontSize: '0.725rem',
                fontWeight: 700,
                color: '#a78bfa',
                backgroundColor: 'rgba(167, 139, 250, 0.1)',
                borderRadius: '4px',
                minWidth: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }
            },
            cit.index
          ),
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                overflow: 'hidden'
              }
            },
            React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              },
              cit.title
            ),
            React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.7rem',
                  color: 'rgba(255, 255, 255, 0.45)'
                }
              },
              metaInfo
            )
          )
        );
      })
    )
  );
};
