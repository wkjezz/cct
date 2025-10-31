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

  useEffect(()=>{
    (async () => {
      const h = await getJSON(`${API}/health`);
      setStatus(h && h.ok ? 'API OK' : 'API unreachable');

      const s = await getJSON(`${API}/staff`);
      setStaffCount(Array.isArray(s) ? s.length : 0);
    })();
  },[]);

  return (
  <div style={{maxWidth:1100,margin:'24px auto'}}>
    <header className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <b>Cell Call Tracker</b>
      <nav style={{display:'flex',gap:8}}>
        <button className="btn" onClick={()=>setView('landing')}>Home</button>
        <button className="btn" onClick={()=>setView('form')}>Report Cell Call</button>
        <button className="btn" onClick={()=>setView('analytics')}>Analytics</button>
        <button className="btn" onClick={()=>setView('performance')}>Performance</button>
      </nav>
      <span style={{fontSize:12,color:'var(--text-light)',opacity:.8}}>{status}</span>
    </header>

    {view==='landing' && (
      <div style={{display:'flex',flexDirection:'column',gap:16,marginTop:16}}>
        <div className="home-options" style={{display:'flex',gap:16}}>
          <div className="card" style={{flex:1,textAlign:'center',cursor:'pointer'}} onClick={()=>setView('form')}>
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

    {view==='form' && <Form onSaved={()=>console.log('saved')} />}
    {view==='analytics' && <Analytics />}
    {view==='performance' && <Performance />}
  </div>);
}
