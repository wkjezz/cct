import React, { useEffect, useMemo, useState } from 'react'
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

  return (
  <div style={{maxWidth:1100,margin:'24px auto'}}>
    <header className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <b>Cell Call Tracker</b>
      <nav style={{display:'flex',gap:8}}>
        <button className="btn" onClick={()=>setView('landing')}>Home</button>
  <button className="btn" onClick={()=>user?.admin && setView('form')} disabled={!user?.admin}>Report Cell Call</button>
        <button className="btn" onClick={()=>setView('analytics')}>Analytics</button>
        <button className="btn" onClick={()=>setView('performance')}>Performance</button>
      </nav>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:12,color:'var(--text-light)',opacity:.8}}>{status}</span>
        {user && (
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {/* avatar (from JWT) - use small circle, title shows display name */}
            <img
              src={user.avatar || '/favicon.ico'}
              alt="avatar"
              title={(typeof window !== 'undefined' && (localStorage.getItem(`rpName_${user.id}`) || user.username.replace(/#\d+$/, ''))) || user.username}
              style={{width:28,height:28,borderRadius:14,objectFit:'cover',boxShadow:'0 0 0 2px rgba(0,0,0,0.1)'}}
            />
            {/* show RP name if user set it in localStorage as rpName_<id> otherwise show nothing (keeps header compact) */}
            {typeof window !== 'undefined' && localStorage.getItem(`rpName_${user.id}`) && (
              <span style={{fontSize:12,opacity:.95}}>{localStorage.getItem(`rpName_${user.id}`)}</span>
            )}
          </div>
        )}
      </div>
    </header>

    {view==='landing' && (
      <div style={{display:'flex',flexDirection:'column',gap:16,marginTop:16}}>
        <div className="home-options" style={{display:'flex',gap:16}}>
          <div className="card" style={{flex:1,textAlign:'center',cursor:user?.admin ? 'pointer' : 'default',opacity:user?.admin?1:0.6}} onClick={()=>user?.admin && setView('form')}>
            <h2>Report Cell Call</h2>
            <p>Create a new record.</p>
          </div>
          <div className="card" style={{flex:1,textAlign:'center',cursor:'pointer'}} onClick={()=>setView('analytics')}>
            <h2>Analytics</h2>
            <p>View counts and filters.</p>
          </div>
          <div className="card" style={{flex:1}}>
            <h2>Quick Stats</h2>
            <p>Staff in pool: <b>{staffCount}</b></p>
          </div>
        </div>

        <LastLogged />
      </div>
    )}

  {view==='form' && <Form user={user} onSaved={()=>console.log('saved')} />}
  {view==='analytics' && <Analytics user={user} />}
    {view==='performance' && <Performance />}
  </div>);
}
