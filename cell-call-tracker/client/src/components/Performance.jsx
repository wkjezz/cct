import React, { useEffect, useMemo, useState } from 'react'
import PieChart from './PieChart'
import { getJSON, API, toLocalMidnightISO, todayYMD, daysAgoYMD, canonicalRole } from '../lib/utils'

function Label({children}){ return <div className="label">{children}</div> }
function Row({children}){ return <div className="row">{children}</div> }
function Divider(){ return <div className="section-sep" /> }

export default function Performance(){
  const [from,setFrom]=useState(daysAgoYMD(30));
  const [to,setTo]=useState(todayYMD());
  const [staff,setStaff]=useState([]);
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    (async()=>{
      const s = await getJSON(`${API}/staff`);
      setStaff(Array.isArray(s)?s:[]);
    })();
  },[]);

  async function load(){
    setLoading(true);
    const qs = new URLSearchParams();
    if(from) qs.set('from', toLocalMidnightISO(from));
    if(to){ const end=new Date(to); end.setDate(end.getDate()+1); qs.set('to', end.toISOString()) }
    const data = await getJSON(`${API}/records?`+qs.toString());
    setRows(Array.isArray(data)?data:[]);
    setLoading(false);
  }

  useEffect(()=>{ load() },[]);

  const table = useMemo(()=>{
    const map = {};
    function ensure(id, name, role){ if(!map[id]) map[id]={ id, name: name||id, role: role||'', lead:0, supervised:0, chargesRemoved:0 } }
    staff.forEach(s=> ensure(String(s.id), s.name, s.role));

    for(const r of rows){
      const leadId = r.leadingId!=null ? String(r.leadingId) : null;
      if(leadId){ const s = staff.find(s=>String(s.id)===leadId); ensure(leadId, s?.name, s?.role); map[leadId].lead++ }

      if(Array.isArray(r.supervising)){
        for(const sid of r.supervising){ const id=String(sid); const s = staff.find(s=>String(s.id)===id); ensure(id, s?.name, s?.role); map[id].supervised++ }
      }

      if(r.chargesRemoved){ if(leadId){ const s = staff.find(s=>String(s.id)===leadId); ensure(leadId, s?.name, s?.role); map[leadId].chargesRemoved++ } }
    }

    const arr = Object.values(map);
    arr.sort((a,b)=>{
      const ta = a.lead + a.supervised;
      const tb = b.lead + b.supervised;
      if(tb !== ta) return tb - ta;
      if(b.chargesRemoved !== a.chargesRemoved) return b.chargesRemoved - a.chargesRemoved;
      return String(a.name).localeCompare(String(b.name));
    });
    return arr;
  },[rows,staff]);

  const pieData = useMemo(()=>{
    const list = table.map(t=>({ id:t.id, name:t.name, role: t.role, value: t.lead + t.supervised }));
    const colors = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac'];
    return list.map((it,idx)=>({ ...it, color: colors[idx % colors.length] }));
  },[table]);

  return (
    <div className="card" style={{marginTop:16}}>
      <h2>Performance</h2>
      <Row>
        <label className="field"><Label>From</Label><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label className="field"><Label>To</Label><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      </Row>
      <div className="row" style={{marginTop:8}}>
        <button className="btn" onClick={load}>Apply Filters</button>
      </div>

      <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:12}}>
        <div className="card" style={{width:'100%'}}>
          <h3>League Table</h3>
          {loading? <p>Loading…</p> : (
            <div style={{overflowX:'auto'}}>
              <table>
                <thead>
                  <tr><th>Staff</th><th>Lead Calls</th><th>Supervised Calls</th><th>Charges Removed</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {table.map(t=> (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.lead}</td>
                      <td>{t.supervised}</td>
                      <td>{t.chargesRemoved}</td>
                      <td>{t.lead + t.supervised}</td>
                    </tr>
                  ))}
                  {table.length===0 && <tr><td colSpan={5} style={{textAlign:'center'}}>No data</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div style={{display:'flex', gap:12, alignItems:'stretch'}}>
          <div className="card" style={{flex:1, display:'flex', flexDirection:'column'}}>
            <h3>Call Call Distribution</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12, flex:1}}>
              <div style={{display:'flex',justifyContent:'center'}}>
                <div style={{width:360, maxWidth:'100%'}}>
                  <PieChart data={pieData} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8, marginTop:'auto'}}>
                {pieData.slice().map(p => (
                  <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:12,height:12,background:p.color,display:'inline-block'}} />
                      <div style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                    </div>
                    <div style={{minWidth:32,textAlign:'right'}}>{p.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{flex:1, display:'flex', flexDirection:'column'}}>
            <h3>Distribution by Role</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12, flex:1}}>
              <div style={{display:'flex',justifyContent:'center', flexDirection:'column', alignItems:'center'}}>
                <div style={{width:360, maxWidth:'100%'}}>
                  <PieChart data={(() => {
                    const buckets = { Command:0, Lead:0, Senior:0, Attorney:0, Junior:0, Paralegal:0, Other:0 };
                    const matchRole = (r)=> canonicalRole(r);
                    for(const t of table){ const cat = matchRole(t.role); buckets[cat] += (t.lead + t.supervised); }
                    const colors = { Command:'#4e79a7', Lead:'#f28e2b', Senior:'#e15759', Attorney:'#76b7b2', Junior:'#59a14f', Paralegal:'#edc948', Other:'#b07aa1' };
                    return Object.keys(buckets)
                      .filter(k => k !== 'Other')
                      .map((k,idx)=>({ name:k, value:buckets[k], color: colors[k] || '#999' }));
                  })()} />
                </div>
                <div style={{width:'100%', maxWidth:360, marginTop:12}}>
                  {/* legend directly under the pie; hide 'Other' bucket */}
                  {(() => {
                    const buckets = { Command:0, Lead:0, Senior:0, Attorney:0, Junior:0, Paralegal:0, Other:0 };
                    const matchRole = (r)=> canonicalRole(r);
                    for(const t of table){ const cat = matchRole(t.role); buckets[cat] += (t.lead + t.supervised); }
                    const colors = { Command:'#4e79a7', Lead:'#f28e2b', Senior:'#e15759', Attorney:'#76b7b2', Junior:'#59a14f', Paralegal:'#edc948', Other:'#b07aa1' };
                    const data = Object.keys(buckets)
                      .filter(k => k !== 'Other')
                      .map(k=>({ name:k, value:buckets[k], color: colors[k] }));
                    return (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                        {data.map(d => (
                          <div key={d.name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{width:12,height:12,background:d.color,display:'inline-block'}} />
                              <div style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{d.name}</div>
                            </div>
                            <div style={{minWidth:32,textAlign:'right'}}>{d.value}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                <div style={{flex:1}} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
