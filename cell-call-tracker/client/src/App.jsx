import React, { useEffect, useMemo, useState } from 'react'
import admins from '../data/admins.json'

// Inline AI logo so we can control color via CSS variables
function AiLogo({size=18, style={}}){
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width={size} height={size} style={{display:'inline-block',verticalAlign:'middle',...style}}>
      <path fill="var(--text)" d="M14.217,19.707l-1.112,2.547c-0.427,0.979-1.782,0.979-2.21,0l-1.112-2.547c-0.99-2.267-2.771-4.071-4.993-5.057	L1.73,13.292c-0.973-0.432-0.973-1.848,0-2.28l2.965-1.316C6.974,8.684,8.787,6.813,9.76,4.47l1.126-2.714	c0.418-1.007,1.81-1.007,2.228,0L14.24,4.47c0.973,2.344,2.786,4.215,5.065,5.226l2.965,1.316c0.973,0.432,0.973,1.848,0,2.28	l-3.061,1.359C16.988,15.637,15.206,17.441,14.217,19.707z" />
      <path fill="var(--text)" d="M24.481,27.796l-0.339,0.777c-0.248,0.569-1.036,0.569-1.284,0l-0.339-0.777c-0.604-1.385-1.693-2.488-3.051-3.092	l-1.044-0.464c-0.565-0.251-0.565-1.072,0-1.323l0.986-0.438c1.393-0.619,2.501-1.763,3.095-3.195l0.348-0.84	c0.243-0.585,1.052-0.585,1.294,0l0.348,0.84c0.594,1.432,1.702,2.576,3.095,3.195l0.986,0.438c0.565,0.251,0.565,1.072,0,1.323	l-1.044,0.464C26.174,25.308,25.085,26.411,24.481,27.796z" />
    </svg>
  )
}
import ChipList from './components/ChipList'
import AddSelect from './components/AddSelect'
import PieChart from './components/PieChart'
import LastLogged from './components/LastLogged'
import Form from './components/Form'
import Analytics from './components/Analytics'
import Performance from './components/Performance'
import { getJSON, API, toLocalMidnightISO, todayYMD, daysAgoYMD, fmtDateUS, fmtDateTimeEST, canonicalRole } from './lib/utils'

/* ========== Utilities ========== */
function Label({children}){ return <div className="label">{children}</div> }
function Row({children}){ return <div className="row">{children}</div> }
function Divider(){ return <div className="section-sep" /> }

/* Form moved to components/Form.jsx */

/* LastLogged extracted to components/LastLogged.jsx */

/* Analytics moved to components/Analytics.jsx */

/* Performance moved to components/Performance.jsx */
/* ========== APP SHELL ========== */
export default function App(){
  const [view,setView]=useState('landing');
  const [status,setStatus]=useState('Checking API...');
  const [staffCount,setStaffCount]=useState(0);
  const [user,setUser]=useState(null);
  const [checkedAuth,setCheckedAuth]=useState(false);

  useEffect(()=>{
    (async () => {
      // First, require authentication. If not authenticated, redirect to Discord login.
      try {
        const r = await fetch(`${API}/auth/me`, { credentials: 'include' });
        if (r.status === 200) {
          const body = await r.json();
          setUser(body.user || null);
        } else {
          // not authenticated -> kick off OAuth
          window.location.href = `${API}/auth/login`;
          return;
        }
      } catch (err) {
        console.error('auth check failed', err);
        setStatus('API unreachable');
        setCheckedAuth(true);
        return;
      }

      const h = await getJSON(`${API}/health`);
      setStatus(h && h.ok ? 'API OK' : 'API unreachable');

      const s = await getJSON(`${API}/staff`);
      setStaffCount(Array.isArray(s) ? s.length : 0);
      setCheckedAuth(true);
    })();
  },[]);

  if (!checkedAuth) return null; // hide everything until auth resolved

  // effectiveUser is the server-determined user (no local dev override)
  const effectiveUser = user || null;

  return (
  <div style={{maxWidth:1100,margin:'24px auto'}}>
    <header className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <b>Cell Call Tracker</b>
      <nav style={{display:'flex',gap:8}}>
        <button className="btn" onClick={()=>setView('landing')}>Home</button>
        {effectiveUser?.admin && (
          <button className="btn" onClick={()=>setView('form')}>Report Cell Call</button>
        )}
        <button className="btn" onClick={()=>setView('analytics')}>Analytics</button>
        <button className="btn" onClick={()=>setView('performance')}>Performance</button>
        {/* visual separator before Smart Report */}
  {effectiveUser?.admin && <span style={{alignSelf:'center',opacity:0.8,marginLeft:8,marginRight:8,color:'var(--text)'}}>|</span>}
        {effectiveUser?.admin && (
          <button className="btn" onClick={()=>setView('smart')} title="Smart Report (BETA)"><AiLogo size={16} style={{marginRight:8}}/> Smart Report (BETA)</button>
        )}
      </nav>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {/* show admin display name only when effective user is admin */}
        {effectiveUser && effectiveUser.admin && (
          <span style={{fontSize:12,color:'var(--text-light)',opacity:.95,fontWeight:600}}>{admins[effectiveUser.id] || (typeof window !== 'undefined' && localStorage.getItem(`rpName_${effectiveUser.id}`)) || effectiveUser.username.replace(/#\d+$/, '')}</span>
        )}
        {user && (
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {/* avatar (from JWT) - use small circle, title shows display name */}
            <img
              src={(() => {
                const a = user.avatar
                // if it's already a full URL, use it
                if (!a) return 'https://cdn.discordapp.com/embed/avatars/0.png'
                if (String(a).startsWith('http')) return a
                // otherwise assume it's a Discord avatar hash and build the CDN URL
                const ext = String(a).startsWith('a_') ? 'gif' : 'png'
                return `https://cdn.discordapp.com/avatars/${user.id}/${a}.${ext}`
              })()}
              alt="avatar"
              title={(typeof window !== 'undefined' && (localStorage.getItem(`rpName_${user.id}`) || user.username.replace(/#\d+$/, ''))) || user.username}
              style={{width:28,height:28,borderRadius:14,objectFit:'cover',boxShadow:'0 0 0 2px rgba(0,0,0,0.1)'}}
            />
            {/* show RP name if user set it in localStorage as rpName_<id> otherwise show nothing (keeps header compact) */}
            {typeof window !== 'undefined' && localStorage.getItem(`rpName_${user.id}`) && (
              <span style={{fontSize:12,opacity:.95}}>{localStorage.getItem(`rpName_${user.id}`)}</span>
            )}
            {/* logout button for easy re-authentication */}
            <button
              className="btn"
              style={{fontSize:11,padding:'4px 8px'}}
              onClick={() => { window.location.href = `${API}/auth/logout` }}
            >Logout</button>
          </div>
        )}
      </div>
    </header>

    {view==='landing' && (
      <div style={{display:'flex',flexDirection:'column',gap:16,marginTop:16}}>
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
          <div className="card" style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-start', alignItems:'center', paddingTop:16}}>
            <h2 style={{margin:0, fontSize:20, fontWeight:700, color:'var(--text-light)', textAlign:'center'}}>Quick Stats</h2>
            <p style={{marginTop:8, fontSize:14, color:'var(--text)', textAlign:'center'}}>Staff in pool: <b style={{color:'var(--text-light)'}}>{staffCount}</b></p>
          </div>
        </div>

        <LastLogged />
      </div>
    )}

  {view==='form' && <Form user={effectiveUser} onSaved={()=>console.log('saved')} />}
  {view==='analytics' && <Analytics user={effectiveUser} />}
    {view==='performance' && <Performance />}
    {view==='smart' && (
          <div className="card" style={{marginTop:16}}>
            <h2 style={{display:'flex',alignItems:'center',gap:8}}><AiLogo size={22}/> Smart Report <small style={{fontSize:12,opacity:0.7}}>(BETA)</small></h2>
      <p style={{color:'var(--text-light)'}}>
        AI can make mistakes — manually check the extracted data before submitting. This feature is editor-only.
      </p>
      <div style={{marginTop:12}}>
        <p style={{margin:0}}>Upload an MDT screenshot to auto-fill fields. The app will highlight detected fields; confirm or correct them before saving.</p>
      </div>
      </div>
    )}
  </div>);
}
