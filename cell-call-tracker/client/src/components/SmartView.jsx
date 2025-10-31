import React from 'react'
import AiLogo from './AiLogo'

export default function SmartView(){
  return (
    <div className="card" style={{marginTop:16}}>
      <h2 style={{display:'flex',alignItems:'center',gap:8}}><AiLogo size={22}/> Smart Report <small style={{fontSize:12,opacity:0.7}}>(BETA)</small></h2>
      <p style={{color:'var(--text-light)'}}>
        AI can make mistakes — manually check the extracted data before submitting. This feature is editor-only.
      </p>
      <div style={{marginTop:12}}>
        <p style={{margin:0}}>Upload an MDT screenshot to auto-fill fields. The app will highlight detected fields; confirm or correct them before saving.</p>
      </div>
    </div>
  )
}
import React from 'react'
import AiLogo from './AiLogo'

export default function SmartView(){
  return (
    <div className="card" style={{marginTop:16}}>
      <h2 style={{display:'flex',alignItems:'center',gap:8}}><AiLogo size={22}/> Smart Report <small style={{fontSize:12,opacity:0.7}}>(BETA)</small></h2>
      <p style={{color:'var(--text-light)'}}>
        AI can make mistakes — manually check the extracted data before submitting. This feature is editor-only.
      </p>
      <div style={{marginTop:12}}>
        <p style={{margin:0}}>Upload an MDT screenshot to auto-fill fields. The app will highlight detected fields; confirm or correct them before saving.</p>
      </div>
    </div>
  )
}
