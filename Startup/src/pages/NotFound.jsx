import React from 'react'
import { Link } from 'react-router-dom'
import '../App.css'

export default function NotFound(){
  return (
    <main className="page-root notfound-root">
      <section className="section">
        <div className="section-inner">
          <h1 className="section-title">404 — Page not found</h1>
          <p className="section-sub muted">We couldn't find the page you're looking for.</p>
          <p><Link to="/">Return to Home</Link></p>
        </div>
      </section>
    </main>
  )
}
