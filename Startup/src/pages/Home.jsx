import '../App.css'
import './home.css'
import '../components/aboutSection.css'
import ModelViewer from '../components/ModelViewer'
import FeatureCarousel from '../components/FeatureCarousel'
import { useState, useEffect } from 'react'
import HowItWorks from '../components/HowItWorks'
import HeroCTA from '../components/HeroCTA'

const FEATURES = [
  {
    title: 'AI Video Summarizer',
    tagline: 'Understand any video in minutes.',
    desc: 'MindSync\'s multi-layer AI summarizer gives you 30-second TL;DRs, 2-minute insights, and 5-minute detailed breakdowns with timestamps and diagrams. Perfect for quick revision or deep understanding.',
    image: '/Aivideosumarizer.png'
  },
  {
    title: 'Auto Flashcard Generator',
    tagline: 'Turn every topic into quick quizzes.',
    desc: 'Instantly create flashcards and short quizzes from any YouTube or EdTech video. Export to Notion, Anki, or Quizlet for smart revision anywhere.',
    image: '/autoflashcard.png'
  },
  {
    title: 'Smart Notes Builder',
    tagline: 'From messy notes to clean knowledge.',
    desc: 'AI turns your raw text or video notes into structured, readable formats — summaries, blogs, or cheat sheets — ready for revision or sharing.',
    image: '/smartnotesbuilder.png'
  },
  {
    title: 'Focus Mode',
    tagline: 'Study distraction-free.',
    desc: 'Combine Pomodoro timer, AI focus detection, and ambient background music to help you maintain deep focus while studying.',
    image: '/focusmode.png'
  },
  {
    title: 'Learning Analytics Dashboard',
    tagline: 'Track your learning, not just your time.',
    desc: 'Visualize your study progress with time charts, focus sessions, and streak tracking. Know what topics you\'ve mastered and where to improve.',
    image: '/learningdashboard.png'
  },
  {
    title: 'Mind Map Generator',
    tagline: 'See your concepts, visually.',
    desc: 'Transform video content or notes into interactive mind maps that connect ideas and make complex topics easier to understand.',
    image: '/mindmap.png'
  },
  {
    title: 'Gamified Learning',
    tagline: 'Make learning addictive (in a good way).',
    desc: 'Earn XP, maintain streaks, and unlock badges as you study. Compete with friends or challenge yourself to stay consistent.',
    image: '/gamifiedlearning.png'
  }
]

export default function Home(){
  return (
    <main className="home-root">
      {/* Hero: keeps previous styling that depended on .home-page */}
      <section id="hero" className="home-page">
        {/* animated background particles and gradient overlays */}
        <div className="hero-bg">
          <div className="mesh" />
          <span className="bg-particle p1" />
          <span className="bg-particle p2" />
          <span className="bg-particle p3" />
          <span className="bg-particle p4" />
          <span className="bg-particle p5" />
        </div>
        <div className="hero hero-grid">
          <div className="hero-content">
            <h1 className="hero-title">
              Turn YouTube into Your
              <br />
              <span className="hero-gradient">Personal AI Study Assistant</span>
            </h1>

            <p className="hero-sub">Summaries, flashcards, focus tools, and progress—instantly. Learn smarter, focus better, remember longer.</p>

            <div className="hero-ctas">
              <a className="btn primary" href="#">Start Free →</a>
              <a className="btn ghost" href="#">▶ Watch Demo</a>
            </div>

            <div className="hero-note">No credit card needed • Free forever • Upgrade anytime</div>
          </div>

          <div className="hero-media" aria-hidden>
            {/* responsive positioning: larger and higher on desktop, smaller on mobile */}
            <ResponsiveModel />
          </div>
        </div>
      </section>

      {/* Features placeholder section - ready for content */}
      <section id="features" className="section section-features">
        <div className="section-inner">
          <h2 className="section-title">Features</h2>
          <p className="section-sub muted">Core capabilities to turn passive watching into active learning.</p>
          <FeatureCarousel features={FEATURES} />
        </div>
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* About */}
      <section id="about" className="section section-about">
        {/* Animated background particles */}
        <div className="bg-particles">
          <span className="particle p1"></span>
          <span className="particle p2"></span>
          <span className="particle p3"></span>
          <span className="particle p4"></span>
          <span className="particle p5"></span>
          <span className="particle p6"></span>
        </div>
        <div className="about-container">
          <div className="about-content">
            <h2 className="about-title">About Mindsync</h2>
            <h3 className="about-subtitle">Empowering Learning, One Video At A Time.</h3>
            <p className="about-description">
              Founded with the vision of transforming passive video consumption into active, effective learning.
              MindSync leverages cutting-edge AI to unlock knowledge hidden within educational content.
              We believe everyone deserves to learn smarter, retain more, and achieve academic and professional goals.
              Join us on our journey to revolutionize self-study.
            </p>
            <div className="about-features">
              <div className="feature-item" data-aos="fade-up" data-aos-delay="100">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 4C14 4 16.5 5 16.5 9C16.5 11 15 12 14 12.5C13 13 12 13 12 13C12 13 11 13 10 12.5C9 12 7.5 11 7.5 9C7.5 5 10 4 12 4Z" />
                    <path d="M12 4C7 4 3 7.5 3 12.5C3 17.5 7 21 12 21C17 21 21 17.5 21 12.5C21 7.5 17 4 12 4Z" />
                    <path d="M16 16C16 16 14.5 18 12 18C9.5 18 8 16 8 16" />
                  </svg>
                </div>
                <h4 className="feature-title">AI-Powered Understanding</h4>
              </div>
              <div className="feature-item" data-aos="fade-up" data-aos-delay="200">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 3L4 7V17L12 21L20 17V7L12 3Z" />
                    <path d="M12 12L20 8" />
                    <path d="M12 12L12 21" />
                    <path d="M12 12L4 8" />
                  </svg>
                </div>
                <h4 className="feature-title">Unlock Knowledge Potential</h4>
              </div>
              <div className="feature-item" data-aos="fade-up" data-aos-delay="300">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" />
                    <path d="M19 15C19.6 15 20.0902 14.5361 20.0902 13.9111C20.0902 13.2861 19.6 12.8222 19 12.8222H17.5C17.6162 12.5278 17.693 12.2148 17.7246 11.8889H19C19.6 11.8889 20.0902 11.425 20.0902 10.8C20.0902 10.175 19.6 9.71111 19 9.71111H17.7246C17.693 9.38519 17.6162 9.07222 17.5 8.77778H19C19.6 8.77778 20.0902 8.31389 20.0902 7.68889C20.0902 7.06389 19.6 6.6 19 6.6H17.5C16.2972 4.99907 14.2764 4 12 4C9.72361 4 7.70278 4.99907 6.5 6.6H5C4.4 6.6 3.90984 7.06389 3.90984 7.68889C3.90984 8.31389 4.4 8.77778 5 8.77778H6.5C6.38376 9.07222 6.307 9.38519 6.27541 9.71111H5C4.4 9.71111 3.90984 10.175 3.90984 10.8C3.90984 11.425 4.4 11.8889 5 11.8889H6.27541C6.307 12.2148 6.38376 12.5278 6.5 12.8222H5C4.4 12.8222 3.90984 13.2861 3.90984 13.9111C3.90984 14.5361 4.4 15 5 15H6.5C7.70278 16.6009 9.72361 17.6 12 17.6C14.2764 17.6 16.2972 16.6009 17.5 15H19Z" />
                  </svg>
                </div>
                <h4 className="feature-title">Achieve Your Goals</h4>
              </div>
            </div>
          </div>
          <div className="about-robot">
            <video 
              src="/robo.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="robot-video"
              data-aos="fade-left"
              data-aos-duration="1000"
            />
            {/* Glowing dots animation */}
            <div className="glow-dots">
              <span className="glow-dot" style={{top: '20%', left: '10%'}}></span>
              <span className="glow-dot" style={{top: '40%', right: '15%'}}></span>
              <span className="glow-dot" style={{bottom: '30%', left: '20%'}}></span>
              <span className="glow-dot" style={{top: '15%', right: '25%'}}></span>
              <span className="glow-dot" style={{bottom: '25%', right: '10%'}}></span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA: Unlock your full potential (above footer) */}
      <HeroCTA />
    </main>
  )
}

function ResponsiveModel(){
  const [props, setProps] = useState({gltfScale:2.0, gltfYOffset:0.9, modelXOffset:-0.9, modelZOffset:0.9})

  useEffect(()=>{
    function calc(){
      const w = window.innerWidth
      if(w >= 1200){
        setProps({gltfScale:2.0, gltfYOffset:0.9, modelXOffset:-0.9, modelZOffset:0.9})
      } else if(w >= 900){
        setProps({gltfScale:1.6, gltfYOffset:0.7, modelXOffset:-0.6, modelZOffset:0.7})
      } else {
        // mobile: smaller and centered more
        setProps({gltfScale:1.0, gltfYOffset:0.5, modelXOffset:0, modelZOffset:0.6})
      }
    }

    calc()
    window.addEventListener('resize', calc)
    return ()=> window.removeEventListener('resize', calc)
  }, [])

  return (
    <ModelViewer src="/futuristic_flying_animated_robot_-_low_poly/scene.gltf" {...props} />
  )
}
