import React, {useState, useRef, useEffect} from 'react'
import './featureCarousel.css'

export default function FeatureCarousel({features = []}){
  const count = 7
  const len = Math.max(1, Math.min(count, features.length || count))
  const [active, setActive] = useState(3)
  const [animating, setAnimating] = useState(null) // { dir: 'next'|'prev', index }
  const rootRef = useRef(null)
  const animTimer = useRef(null)
  const ANIM_DUR = 700

  useEffect(()=>{
    // keep active in bounds if features length changes
    if(active >= len) setActive(Math.max(0, len-1))
  }, [len])

  // cleanup animation timer on unmount
  useEffect(()=>{
    return ()=>{
      if(animTimer.current) clearTimeout(animTimer.current)
    }
  }, [])

  function prev(){
    if(animating) return
    const outgoing = active
    setAnimating({dir: 'prev', index: outgoing})
    animTimer.current = setTimeout(()=>{
      setActive(a => (a - 1 + len) % len)
      setAnimating(null)
    }, ANIM_DUR)
  }
  function next(){
    if(animating) return
    const outgoing = active
    setAnimating({dir: 'next', index: outgoing})
    animTimer.current = setTimeout(()=>{
      setActive(a => (a + 1) % len)
      setAnimating(null)
    }, ANIM_DUR)
  }

  function handleKey(e){
    if(e.key === 'ArrowLeft') prev()
    if(e.key === 'ArrowRight') next()
  }

  const cards = Array.from({length:count}).map((_,i)=>{
    const f = features[i] || {
      title: `Feature ${i+1}`,
      desc: 'Short description.',
      image: null,
      tagline: 'Feature tagline'
    }
    const offset = i - active
    const absOffset = Math.abs(offset)
    const isCenter = offset === 0
    return (
      <article
        key={i}
        className={`fc-card ${isCenter ? 'center' : ''} ${animating && animating.index === i ? `orbit-out ${animating.dir}` : ''}`}
        style={{ ['--offset']: offset, ['--abs']: absOffset }}
        tabIndex={0}
        aria-label={`${f.title}: ${f.desc}`}
        onClick={()=> { if(!animating) setActive(i) }}
      >
        <div className="fc-thumb" aria-hidden>
          {f.image && <img src={f.image} alt="" className="feature-image" />}
        </div>
        <div className="fc-body">
          <h3 className="fc-title">{f.title}</h3>
          <p className="fc-tagline">{f.tagline}</p>
          <p className="fc-desc">{f.desc}</p>
        </div>
      </article>
    )
  })

  return (
    <div className="fc-root" role="group" aria-label="Feature showcase" ref={rootRef} tabIndex={0} onKeyDown={handleKey}>
      <button className="fc-arrow fc-prev" aria-label="Previous feature" onClick={prev}>‹</button>
      <div className="fc-stage">
        {cards}
      </div>
      <button className="fc-arrow fc-next" aria-label="Next feature" onClick={next}>›</button>
    </div>
  )
}

// cleanup timer if component unmounts mid-animation
// (added at file bottom to keep component body tidy)

