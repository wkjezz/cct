import React from 'react'
import AiLogo from './AiLogo'

export default function HomeOptions({ effectiveUser, setView, staffCount }){
  return (
    <div className="home-options" style={{display:'flex',gap:16}}>
      {effectiveUser?.admin && (
        <div className="card" style={{flex:1, textAlign:'center', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'flex-start', alignItems:'center', paddingTop:16}} onClick={()=>setView('form')}>
          <h2 style={{margin:0, fontSize:20, fontWeight:700, color:'var(--text-light)', textAlign:'center'}}>Report Cell Call</h2>
          <p style={{marginTop:8, fontSize:14, color:'var(--text)', textAlign:'center'}}>Create a new record.</p>
        </div>
      )}

      {effectiveUser?.admin && (
        <div className="card" style={{flex:1, textAlign:'center', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'flex-start', alignItems:'center', paddingTop:16}} onClick={()=>setView('smart')}>
          <h2 style={{margin:0, fontSize:20, fontWeight:700, color:'var(--text-light)', display:'flex', alignItems:'center', gap:8}}><AiLogo size={20} style={{marginRight:8}}/> Smart Report</h2>
          <p style={{marginTop:8, fontSize:14, color:'var(--text)', textAlign:'center'}}>AI-assisted extraction (BETA). Auto-filled fields must be manually verified before submission.</p>
        </div>
      )}

      <div className="card" style={{flex:1, textAlign:'center', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'flex-start', alignItems:'center', paddingTop:16}} onClick={()=>setView('analytics')}>
        <h2 style={{margin:0, fontSize:20, fontWeight:700, color:'var(--text-light)', textAlign:'center'}}>Analytics</h2>
        <p style={{marginTop:8, fontSize:14, color:'var(--text)', textAlign:'center'}}>View counts and filters.</p>
      </div>

      {/* Quick Stats removed per request - card omitted */}

    </div>
  )
}
