import React, { useEffect, useMemo, useState } from 'react'
import Header from './components/HeaderNew'
import HomeOptions from './components/HomeOptions'
import SmartView from './components/SmartView'
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
      <Header effectiveUser={effectiveUser} user={user} setView={setView} />

      {view==='landing' && (
        <div style={{display:'flex',flexDirection:'column',gap:16,marginTop:16}}>
          <HomeOptions effectiveUser={effectiveUser} setView={setView} staffCount={staffCount} />

          <LastLogged />
        </div>
      )}

      {view==='form' && <Form user={effectiveUser} onSaved={()=>console.log('saved')} />}
      {view==='analytics' && <Analytics user={effectiveUser} />}
      {view==='performance' && <Performance />}
      {view==='smart' && <SmartView />}
    </div>
  )
}
