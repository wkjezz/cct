import React, { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import HomeOptions from './components/HomeOptions'
import SmartView from './components/SmartView'
import ChipList from './components/ChipList'
import AddSelect from './components/AddSelect'
import PieChart from './components/PieChart'
import LastLogged from './components/LastLogged'
import Form from './components/Form'
import FormManual from './components/FormManual'
import Analytics from './components/Analytics'
import Performance from './components/Performance'
import { getJSON, API, toLocalMidnightISO, todayYMD, daysAgoYMD, fmtDateUS, fmtDateTimeEST, canonicalRole } from './lib/utils'

/* ========== Utilities ========== */
function Label({children}){ return <div className="label">{children}</div> }
function Row({children}){ return <div className="row">{children}</div> }
function Divider(){ return <div className="section-sep" /> }

/* ========== APP SHELL ========== */
export default function App(){
  // Feature flags
  const ENABLE_SMART = false; // toggle to show Smart Report (keep code present but hidden)
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

  const displayName = (u) => {
    if (!u) return ''
    return (
      admins[u.id] ||
      (typeof window !== 'undefined' && localStorage.getItem(`rpName_${u.id}`)) ||
      u.username.replace(/#\d+$/, '')
    )
  }

  const avatarUrl = (u) => {
    if (!u) return 'https://cdn.discordapp.com/embed/avatars/0.png'
    const a = u.avatar
    if (!a) return 'https://cdn.discordapp.com/embed/avatars/0.png'
    if (String(a).startsWith('http')) return a
    const ext = String(a).startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${u.id}/${a}.${ext}`
  }

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
  {view==='form-manual' && <FormManual user={effectiveUser} onSaved={()=>console.log('saved')} />}
      {view==='analytics' && <Analytics user={effectiveUser} />}
      {view==='performance' && <Performance />}
  {view==='smart' && ENABLE_SMART && <SmartView user={effectiveUser} onSaved={()=>console.log('saved')} setView={setView} />}
    </div>
  )
}
