import React, { useEffect, useState } from 'react'
import './cta.css'

export default function HeroCTA(){
  const [visible, setVisible] = useState(false)

  useEffect(()=>{
    const t = setTimeout(()=> setVisible(true), 120)
    return ()=> clearTimeout(t)
  }, [])

  // Enhanced particle positions with more variety
  const particles = [
    {l:8, t:30, d:0, s:0.9, c: 'cyan'}, 
    {l:22, t:12, d:120, s:1.2, c: 'blue'}, 
    {l:40, t:22, d:240, s:0.8, c: 'purple'},
    {l:62, t:18, d:60, s:1.0, c: 'teal'}, 
    {l:78, t:34, d:180, s:0.85, c: 'cyan'}, 
    {l:88, t:10, d:300, s:1.1, c: 'blue'},
    {l:52, t:46, d:90, s:0.7, c: 'purple'}, 
    {l:32, t:54, d:210, s:0.95, c: 'teal'},
    {l:15, t:65, d:150, s:0.75, c: 'cyan'},
    {l:70, t:5, d:270, s:1.15, c: 'blue'}
  ]

  return (
    <section className={`cta-root ${visible ? 'enter' : ''}`} aria-hidden>
      {/* Animated gradient background layers */}
      <div className="cta-backdrop" />
      <div className="cta-gradient-orb cta-orb-1" />
      <div className="cta-gradient-orb cta-orb-2" />
      <div className="cta-gradient-orb cta-orb-3" />
      
      {/* Decorative particles with color variants */}
      {particles.map((p, i)=> (
        <span 
          key={i} 
          className={`cta-particle cta-particle-${p.c}`} 
          style={{ 
            left: `${p.l}%`, 
            top: `${p.t}%`, 
            ['--delay']: `${p.d}ms`, 
            ['--scale']: p.s 
          }} 
        />
      ))}

      {/* Grid pattern overlay */}
      <div className="cta-grid-overlay" />

      <div className="cta-inner">
        {/* Badge */}
        <div className="cta-badge">
          <span className="cta-badge-icon">✨</span>
          <span className="cta-badge-text">Transform Your Learning Journey</span>
        </div>

        <h2 className="cta-title">
          <span className="cta-title-line">Unlock Your</span>
          <span className="cta-title-line cta-title-gradient">Full Potential</span>
        </h2>
        
        <p className="cta-sub">
          Seamlessly integrate knowledge with MindSync's AI-powered platform
        </p>

        <div className="cta-actions">
          <a className="cta-btn" href="#">
            <span className="cta-btn-text">Start Your Transformation</span>
            <span className="cta-btn-arrow">→</span>
            <div className="cta-btn-shine" />
          </a>
          <div className="cta-note">
            <span className="cta-note-icon">✓</span>
            <span>No commitments. Cancel anytime.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
