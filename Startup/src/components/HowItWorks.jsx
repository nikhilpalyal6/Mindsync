import React, {useEffect, useRef} from 'react'
import './howitworks.css'

export default function HowItWorks(){
  const stageRef = useRef(null)

  useEffect(()=>{
    const el = stageRef.current
    if(!el) return
    const io = new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){
        el.classList.add('in')
      }
    }, {threshold: 0.25})
    io.observe(el)
    return ()=> io.disconnect()
  }, [])

  return (
    <section className="hiw-root" id="how">
      <div className="section-inner">
        <h2 className="section-title">How it Works</h2>
        <p className="section-sub muted">Three simple steps to get started</p>
      </div>

      <div className="hiw-stage" ref={stageRef}>
        <div className="hiw-floor" aria-hidden></div>
        <Card order={1} idx="01" title="Paste Any Video" lines={["YouTube, Khan Academy,", "Coursera—paste the link", "and we’ll do the rest."]} side="left" />
        <Card order={2} idx="02" title="AI Gets to Work" lines={["MindSync analyzes, summarizes,", "and generates study materials", "instantly."]} side="center" />
        <Card order={3} idx="03" title="Study Smarter" lines={["Flashcards, quizzes, notes, and", "focus tools—all in one beautiful", "interface."]} side="right" />
      </div>
    </section>
  )
}

function Card({idx, title, lines, side, order=1}){
  const cardRef = useRef(null)

  function handleMove(e){
    const el = cardRef.current
    if(!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const px = (x / rect.width) - 0.5
    const py = (y / rect.height) - 0.5
    const rx = (-py * 6).toFixed(2)
    const ry = (px * 8).toFixed(2)
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
    el.style.setProperty('--tx', `${px * 6}px`)
    el.style.setProperty('--ty', `${py * 6}px`)
  }

  function handleLeave(){
    const el = cardRef.current
    if(!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--tx', '0px')
    el.style.setProperty('--ty', '0px')
  }

  return (
    <article
      ref={cardRef}
      className={`hiw-card ${side}`}
      style={{'--stagger': `${order * 120}ms`}}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div className="hiw-glow" aria-hidden></div>
      <div className="hiw-inner">
        <div className="hiw-number">{idx}</div>
        <h3 className="hiw-title">{title}</h3>
        <p className="hiw-text">
          {lines.map((l,i)=> (
            <span key={i}>{l}{i < lines.length-1 ? ' ' : ''}</span>
          ))}
        </p>
      </div>
    </article>
  )
}
