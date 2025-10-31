import React from 'react'
import AiLogo from './AiLogo'
import FormManual from './FormManual'

export default function SmartView({ user, onSaved, setView }){
  // SmartView now reuses the FormManual paste/analyze UI as the Smart Report surface.
  return (
    <div className="card" style={{marginTop:16}}>
      <h2 style={{display:'flex',alignItems:'center',gap:8}}><AiLogo size={22}/> Smart Report <small style={{fontSize:12,opacity:0.7}}>(BETA)</small></h2>
      <p style={{color:'var(--text-light)'}}>
        AI can make mistakes — manually check the extracted data before submitting. This feature is editor-only.
      </p>

      {/* Reuse the manual paste/analyze form as the Smart Report UI */}
      <FormManual user={user} onSaved={onSaved} />

      <div style={{marginTop:8}}>
        <button className="btn" onClick={() => setView && setView('landing')}>Back</button>
      </div>
    </div>
  )
}
