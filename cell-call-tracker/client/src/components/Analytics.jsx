import React, { useEffect, useMemo, useState } from 'react'
import { getJSON, API, toLocalMidnightISO, todayYMD, daysAgoYMD, fmtDateUS } from '../lib/utils'

function Label({children}){ return <div className="label">{children}</div> }
function Row({children}){ return <div className="row">{children}</div> }
function Divider(){ return <div className="section-sep" /> }

export default function Analytics({ user }){
  const [staff,setStaff]=useState([]);
  const staffMap=useMemo(()=>Object.fromEntries(staff.map(s=>[String(s.id),s])),[staff]);

  // Draft filter states (bound to inputs)
  const [from,setFrom]=useState(daysAgoYMD(30));
  const [to,setTo]=useState(todayYMD());
  const [staffId,setStaffId]=useState('');
  const [cellCallType,setCellCallType]=useState('');
  const [verdict,setVerdict]=useState('');

  // Active filters used for loading (updated when Apply Filters is clicked)
  const [activeFrom,setActiveFrom]=useState(from);
  const [activeTo,setActiveTo]=useState(to);
  const [activeStaffId,setActiveStaffId]=useState(staffId);
  const [activeCellCallType,setActiveCellCallType]=useState(cellCallType);
  const [activeVerdict,setActiveVerdict]=useState(verdict);

  const [rows,setRows]=useState([]);
  const [allRows,setAllRows]=useState([]);
  const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    (async () => {
      const rows = await getJSON(`${API}/staff`);
      setStaff(Array.isArray(rows) ? rows : []);
    })();
  },[]);

  // load accepts optional overrides so Apply Filters can pass the draft filters
  async function load(overrides = {}){
    setLoading(true);
    const srcFrom = overrides.from ?? activeFrom;
    const srcTo = overrides.to ?? activeTo;
    const srcStaff = overrides.staffId ?? activeStaffId;
    const srcCellCallType = overrides.cellCallType ?? activeCellCallType;
    const srcVerdict = overrides.verdict ?? activeVerdict;

    const qs=new URLSearchParams();
    if(srcFrom)qs.set('from',toLocalMidnightISO(srcFrom));
    if(srcTo){const end=new Date(srcTo);end.setDate(end.getDate()+1);qs.set('to',end.toISOString())}
    if(srcStaff)qs.set('staffId',srcStaff);
    if(srcCellCallType)qs.set('cellCallType',srcCellCallType);
    if(srcVerdict) qs.set('verdict', srcVerdict);

    const data = await getJSON(`${API}/records?`+qs.toString());
    const fetched = Array.isArray(data) ? data : [];
    setRows(fetched); // rows shown in table (respecting active staff -> leading filter)

    // Also fetch full dataset for observed-count calculations when a staff filter is active.
    try {
      const qs2 = new URLSearchParams(qs.toString());
      qs2.delete('staffId');
      const allData = await getJSON(`${API}/records?` + qs2.toString());
      setAllRows(Array.isArray(allData) ? allData : fetched);
    } catch (e) {
      setAllRows(fetched);
    }

    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  const kpi=useMemo(()=>{
    const total=rows.length;
    const chargesRemoved=rows.filter(r=>r.chargesRemoved).length;
    const chargesReplaced=rows.filter(r=>r.chargesRemoved && r.chargesReplaced).length;
    const bench=rows.filter(r=>r.verdict==='BENCH_REQUEST').length;
    const notGuilty = rows.filter(r=>r.verdict==='NOT_GUILTY').length;

    // For observed counts, use allRows when a staff is selected so we include records
    // where the staff appears as an observer even if they are not the lead.
    const sourceForObserved = activeStaffId ? allRows : rows;
    const filterByDate = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.filter(r => {
        const ts = Date.parse(r.date || r.createdAt);
        if (!Number.isFinite(ts)) return false;
        if (activeFrom) {
          const fromMs = Date.parse(toLocalMidnightISO(activeFrom));
          if (ts < fromMs) return false;
        }
        if (activeTo) {
          const end = new Date(activeTo); end.setDate(end.getDate()+1);
          if (ts >= end.getTime()) return false;
        }
        return true;
      });
    };

    const observedSourceFiltered = filterByDate(sourceForObserved);
    const observedCount = activeStaffId
      ? observedSourceFiltered.filter(r => (Array.isArray(r.attorneyObservers) && r.attorneyObservers.map(String).includes(String(activeStaffId))) || (Array.isArray(r.paralegalObservers) && r.paralegalObservers.map(String).includes(String(activeStaffId)))).length
      : observedSourceFiltered.filter(r => (Array.isArray(r.attorneyObservers) && r.attorneyObservers.length>0) || (Array.isArray(r.paralegalObservers) && r.paralegalObservers.length>0)).length;

    const totalFine=rows.reduce((s,r)=>s+(Number(r.fine)||0),0);
    const totalMonths=rows.reduce((s,r)=>s+(Number(r.sentenceMonths)||0),0);
    const byType=rows.reduce((m,r)=>((m[r.cellCallType]=(m[r.cellCallType]||0)+1),m),{});
    const supervisionCount = activeStaffId
      ? rows.filter(r => Array.isArray(r.supervising) && r.supervising.map(String).includes(String(activeStaffId))).length
      : rows.reduce((s,r)=> s + (Array.isArray(r.supervising) ? r.supervising.length : 0), 0);
    return{total,chargesRemoved,chargesReplaced,bench,notGuilty,observedCount,totalFine,totalMonths,byType,supervisionCount};
  },[rows,allRows,activeStaffId,activeFrom,activeTo]);

  async function deleteRecord(id){
    if(!window.confirm('Delete this record?'))return;
    const delId = String(id).split(':')[0];
    await fetch(`${API}/records?id=${encodeURIComponent(delId)}`, { method:'DELETE' });
    await load();
  }

  async function generateReport(){
    const lines=[];
    lines.push(`## DOJ Analytics Report`);
    lines.push(`**Date Range:** ${activeFrom} → ${activeTo}`);
    if(activeStaffId){const s=staffMap[String(activeStaffId)];lines.push(`**Lead Attorney:** ${s?.name||activeStaffId}`)}
    const totalLabel = activeStaffId ? 'Cell Calls Lead' : 'Total Records';
    lines.push(`**${totalLabel}:** ${kpi.total}`);
    lines.push(`**Cell Calls Supervised:** ${kpi.supervisionCount}`);
    lines.push(`**Cell Calls Observed:** ${kpi.observedCount}`);
    lines.push(`**Charges Removed:** ${kpi.chargesRemoved}`);
    lines.push(`**Charges Replaced:** ${kpi.chargesReplaced}`);
    lines.push(`**Bench Requests:** ${kpi.bench}`);
    lines.push(`**Total Fine:** $${kpi.totalFine}`);
    lines.push(`**Total Sentence Months:** ${kpi.totalMonths}`);
    lines.push(`\n### Breakdown`);
    lines.push(`| Date | Incident | DOJ# | Lead | Verdict | Fine | Sentence | Type |`);
    lines.push(`|------|-----------|------|------|----------|------|-----------|------|`);
    for(const r of rows){
      lines.push(`| ${fmtDateUS(r.date||r.createdAt)} | ${r.incidentId} | ${r.dojReportNumber} | ${staffMap[String(r.leadingId)]?.name||r.leadingId} | ${r.verdict} | ${r.fine??'-'} | ${r.sentenceMonths??'-'} | ${r.cellCallType} |`);
    }
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  return (
  <div className="card" style={{marginTop:16}}>
    <h2>Analytics</h2>
    <div className="card" style={{marginTop:12}}>
      <h3>The Last 7 days at a glance</h3>
      <p style={{marginTop:6, marginBottom:8, color:'var(--muted)'}}>A quick heat map of total cell calls per day over the rolling 7-day window.</p>
      <Heat7Days rows={allRows} staffId={activeStaffId} />
    </div>
    <Row>
      <label className="field"><Label>From</Label><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="field"><Label>To</Label><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    </Row>
    <Row>
      <label className="field"><Label>Staff</Label>
        <select value={staffId} onChange={e=>setStaffId(e.target.value)}>
          <option value="">All</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}{s.role?` (${s.role})`:''}</option>)}
        </select></label>
      <label className="field"><Label>Cell Call Type</Label>
        <select value={cellCallType} onChange={e=>setCellCallType(e.target.value)}>
          <option value="">All</option>
          <option value="CELL_CALL">Cell Call</option>
          <option value="WARRANT_ARREST">Warrant Arrest</option>
          <option value="SENTENCING_HEARING">Sentencing Hearing</option>
        </select></label>
      <label className="field"><Label>Verdict</Label>
        <select value={verdict} onChange={e=>setVerdict(e.target.value)}>
          <option value="">All</option>
          <option value="NOT_GUILTY">Not Guilty Plea</option>
          <option value="BENCH_REQUEST">Bench Trial Request</option>
          <option value="GUILTY">Guilty</option>
        </select></label>
    </Row>

    <div className="row" style={{marginTop:12}}>
      <div className="card"><h3>{activeStaffId ? 'Cell Calls Lead' : 'Total Records'}</h3><p style={{fontSize:28,margin:0}}>{kpi.total}</p></div>
      <div className="card"><h3>Charges Removed</h3><p style={{fontSize:28,margin:0}}>{kpi.chargesRemoved}</p></div>
      <div className="card"><h3>Cell Calls Supervised</h3><p style={{fontSize:28,margin:0}}>{kpi.supervisionCount}</p></div>
      <div className="card"><h3>Cell Calls Observed</h3><p style={{fontSize:28,margin:0}}>{kpi.observedCount}</p></div>
      <div className="card"><h3>Not Guilty Pleas</h3><p style={{fontSize:28,margin:0}}>{kpi.notGuilty}</p></div>
      <div className="card"><h3>Bench Trial Requests</h3><p style={{fontSize:28,margin:0}}>{kpi.bench}</p></div>
      <div className="card"><h3>Total Fine</h3><p style={{fontSize:28,margin:0}}>${kpi.totalFine}</p></div>
      <div className="card"><h3>Total Sentence (months)</h3><p style={{fontSize:28,margin:0}}>{kpi.totalMonths}</p></div>
    </div>

    <div className="row" style={{marginTop:12}}>
      <button className="btn" onClick={()=>{ setActiveFrom(from); setActiveTo(to); setActiveStaffId(staffId); setActiveCellCallType(cellCallType); setActiveVerdict(verdict); load({ from, to, staffId, cellCallType, verdict }); }}>Apply Filters</button>
      <button className="btn" onClick={generateReport}>Generate Report</button>
      {copied && <span className="pill">✅ Report copied to clipboard</span>}
    </div>

    <div className="card" style={{marginTop:16}}>
      <h3>Results</h3>
      {loading?<p>Loading…</p>:(
        <div style={{overflowX:'auto'}}>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Incident</th><th>DOJ #</th><th>Leading</th><th>Verdict</th>
                <th>Charges Removed?</th><th>Charges Replaced?</th><th>Fine</th><th>Sentence</th><th>Type</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td>{fmtDateUS(r.date||r.createdAt)}</td>
                  <td>{r.incidentId}</td>
                  <td>{r.dojReportNumber}</td>
                  <td>{staffMap[String(r.leadingId)]?.name || r.leadingId}</td>
                  <td>{r.verdict}</td>
                  <td>{r.chargesRemoved ? 'Yes' : 'No'}</td>
                  <td>{r.chargesRemoved ? (r.chargesReplaced ? 'Yes' : 'No') : 'N/A'}</td>
                  <td>{r.fine ?? '-'}</td>
                  <td>{r.sentenceMonths ?? '-'}</td>
                  <td>{r.cellCallType}</td>
                  <td>
                    {user?.admin ? (
                      <button
                        onClick={() => { if(window.confirm('Delete this record?')) deleteRecord(r.id) }}
                        style={{ background:'transparent', border:'none', color:'var(--text-light)', cursor:'pointer', fontSize:'1.2em' }}
                        title="Delete record"
                      >🗑️</button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan="11" style={{textAlign:'center'}}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>);
}

function Heat7Days({ rows, staffId }){
  // Compute counts for the last 7 days (rolling, ending today)
  const today = new Date();
  today.setHours(0,0,0,0);
  const days = new Array(7).fill(0).map((_,i)=>{
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i)); // oldest -> newest
    return d;
  });

  const counts = days.map(d => 0);
  if(Array.isArray(rows)){
    // Optionally restrict to a specific staff (when filtering by attorney in the UI).
    const source = staffId ? rows.filter(r => {
      // Treat leadingId or membership in attorneyObservers as belonging to the attorney
      if (String(r.leadingId) === String(staffId)) return true;
      if (Array.isArray(r.attorneyObservers) && r.attorneyObservers.map(String).includes(String(staffId))) return true;
      return false;
    }) : rows;

    for(const r of source){
      const ts = Date.parse(r.date || r.createdAt || r.timestamp || '');
      if(!Number.isFinite(ts)) continue;
      const d = new Date(ts);
      d.setHours(0,0,0,0);
      for(let i=0;i<days.length;i++){
        if(d.getTime() === days[i].getTime()){
          counts[i]++;
          break;
        }
      }
    }
  }

  const max = Math.max(...counts, 1);

  const dayLabels = days.map(d => d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }));

  return (
    <div>
      <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
        {counts.map((c,i)=>{
          const ratio = c / max;
          const bg = `rgba(78,121,167,${0.15 + 0.85 * ratio})`;
          return (
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
              <div title={`${dayLabels[i]}: ${c}`} style={{width:'100%',height:48,background:bg,borderRadius:6,border:'1px solid rgba(0,0,0,0.06)'}} />
              <small style={{marginTop:6,color:'var(--muted)'}}>{dayLabels[i].split(',')[0]}</small>
            </div>
          )
        })}
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
        <small style={{color:'var(--muted)'}}>0</small>
        <div style={{height:8,flex:1,background:'linear-gradient(90deg, rgba(78,121,167,0.15), rgba(78,121,167,1))',borderRadius:4}} />
        <small style={{color:'var(--muted)'}}>{max}</small>
      </div>
    </div>
  )
}
