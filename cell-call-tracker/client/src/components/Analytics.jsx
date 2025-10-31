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
        const ts = Date.parse(r.createdAt || r.date);
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
      lines.push(`| ${fmtDateUS(r.createdAt||r.date)} | ${r.incidentId} | ${r.dojReportNumber} | ${staffMap[String(r.leadingId)]?.name||r.leadingId} | ${r.verdict} | ${r.fine??'-'} | ${r.sentenceMonths??'-'} | ${r.cellCallType} |`);
    }
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  return (
  <div className="card" style={{marginTop:16}}>
    <h2>Analytics</h2>
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
                  <td>{fmtDateUS(r.createdAt||r.date)}</td>
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
