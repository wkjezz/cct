import React, { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_BASE || '/api';

/* ========== Utilities ========== */
function Label({children}){ return <div className="label">{children}</div> }
function Row({children}){ return <div className="row">{children}</div> }
function Divider(){ return <div className="section-sep" /> }

function toLocalMidnightISO(ymd){
  const [y,m,d]=ymd.split('-').map(Number);
  return new Date(y,m-1,d,0,0,0,0).toISOString();
}
function todayYMD(){ return new Date().toISOString().slice(0,10) }
function daysAgoYMD(n){ const t=new Date(); t.setDate(t.getDate()-n); return t.toISOString().slice(0,10) }
function fmtDateUS(iso){ try{ const d=new Date(iso); return d.toLocaleDateString('en-US') }catch{ return iso } }
function fmtDateTimeEST(iso){ try{ return new Date(iso).toLocaleString('en-US',{ timeZone:'America/New_York' }) }catch{ return iso } }

/** Safe fetch that returns JSON or null on error (never throws). */
async function getJSON(url, options) {
  try {
    const r = await fetch(url, options);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* ========== Chips (selected people) ========== */
function ChipList({items, render, onRemove}){
  return (
    <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
      {items.map((it,idx)=>(
        <span key={idx} className="pill" style={{display:'inline-flex', alignItems:'center', gap:8}}>
          {render(it)}
          <button type="button" className="btn" onClick={()=>onRemove(it)} style={{padding:'2px 8px'}}>×</button>
        </span>
      ))}
    </div>
  );
}

/* ========== AddSelect (dropdown + Add) ========== */
function AddSelect({label, options, selectedIds, onAdd, onRemove}){
  const [pick, setPick] = useState('');
  const left = options.filter(o => !selectedIds.includes(String(o.id)));
  return (
    <label className="field">
      <Label>{label}</Label>
      <div style={{display:'flex', gap:8}}>
        <select value={pick} onChange={e=>setPick(e.target.value)} style={{flex:1}}>
          <option value="">Select…</option>
          {left.map(o => <option key={o.id} value={o.id}>{o.name}{o.role?` (${o.role})`:''}</option>)}
        </select>
        <button
          type="button"
          className="btn"
          onClick={()=>{ if(pick){ onAdd(pick); setPick(''); } }}
        >Add</button>
      </div>
      <ChipList
        items={selectedIds}
        render={(id)=> options.find(o=>String(o.id)===String(id))?.name || id}
        onRemove={(id)=> onRemove(id)}
      />
    </label>
  );
}

/* ========== FORM: Report Cell Call ========== */
function Form({ onSaved }){
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [formKey, setFormKey] = useState(0);

  useEffect(()=>{
    (async () => {
      const rows = await getJSON(`${API}/staff`);
      setStaff(Array.isArray(rows) ? rows : []);
    })();
  },[]);
  const staffOpts = useMemo(()=> staff.map(s => ({ id:String(s.id), name: s.name, role: s.role })), [staff]);

  // Supervising list: exclude Paralegal/Junior + add Judiciary
  const supervisingOpts = useMemo(() => {
    const allowed = staff
      .filter(s => !/paralegal/i.test(s.role) && !/junior/i.test(s.role))
      .map(s => ({ id:String(s.id), name:s.name, role:s.role }));
    allowed.push({ id:'judiciary', name:'Judiciary', role:'Court Oversight' });
    return allowed;
  }, [staff]);

  const init = () => ({
    date: todayYMD(),
    incidentId: '',
    dojReportNumber: '',
    leadingId: '',
    supervising: [],
    attorneyObservers: [],
    paralegalObservers: [],
    verdict: 'GUILTY',
    benchVerdictNumber: '',
    chargesRemoved: 'no',
    chargesReplaced: 'no',
    fine: '',
    sentenceMonths: '',
    cellCallType: 'CELL_CALL',
    incidentType: 'HUT',
    notes: '',
    by: 'dev-ui'
  });
  const [form,setForm] = useState(init());
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));
  const six=s=>String(s).slice(0,6);
  const hardClear=()=>{setForm(init());setMsg('');setFormKey(k=>k+1)};

  function validate(){
    if(!form.incidentId) return 'Incident ID required';
    if(form.incidentId.length!==6) return 'Incident ID must be 6 chars';
    if(!form.dojReportNumber) return 'DOJ Report required';
    if(form.dojReportNumber.length!==6) return 'DOJ Report must be 6 chars';
    if(!form.leadingId) return 'Select lead attorney';
    if(form.verdict==='BENCH_REQUEST'&&!form.benchVerdictNumber) return 'Verdict # required';
    return '';
  }

  /** Exact-match duplicate check (client-side) by DOJ # */
  async function findByDOJ(doj) {
    const trim = v => String(v ?? '').trim();
    const wanted = trim(doj);
    if (!wanted) return null;
    const all = await getJSON(`${API}/records`);
    if (!Array.isArray(all)) return null;
    return all.find(r => trim(r.dojReportNumber) === wanted) || null;
  }

  async function submit(e){
    e.preventDefault();
    const err = validate();
    if (err) { setMsg(err); return; }

    setMsg('');
    setSaving(true);

    const payload = {
      date: toLocalMidnightISO(form.date),
      createdAt: new Date().toISOString(),
      savedAt:   new Date().toISOString(),
      incidentId: form.incidentId,
      dojReportNumber: form.dojReportNumber,
      leadingId: Number(form.leadingId),
      supervising: form.supervising.map(id => id === 'judiciary' ? 'judiciary' : Number(id)),
      attorneyObservers: form.attorneyObservers.map(Number),
      paralegalObservers: form.paralegalObservers.map(Number),
      verdict: form.verdict,
      benchVerdictNumber: form.verdict==='BENCH_REQUEST' ? form.benchVerdictNumber : null,
      chargesRemoved: form.chargesRemoved === 'yes',
      chargesReplaced: form.chargesRemoved === 'yes' && form.chargesReplaced === 'yes',
      fine: form.fine === '' ? null : Number(form.fine),
      sentenceMonths: form.sentenceMonths === '' ? null : Number(form.sentenceMonths),
      cellCallType: form.cellCallType,
      incidentType: form.incidentType,
      notes: form.notes,
      by: form.by
    };

    try {
      const existing = await findByDOJ(form.dojReportNumber);

      if (existing) {
        const ok = window.confirm(
        `Cell Call for Report ${form.dojReportNumber} has already been submitted, do you wish to overwrite it?`
        );
        if (!ok) { setSaving(false); setMsg('Canceled.'); return; }

        // Try PUT (id in query string for our single route setup)
        let data = await getJSON(
        `${API}/records?id=${encodeURIComponent(existing.id.split(':')[0])}`,
          {
            method: 'PUT',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify(payload)
          }
        );

        // If PUT not supported, fall back to DELETE + POST
        if (!data) {
        await fetch(`${API}/records?id=${encodeURIComponent(existing.id.split(':')[0])}`, { method:'DELETE' });
          data = await getJSON(`${API}/records`, {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify(payload)
          });
        }

        setSaving(false);
        if (!data || data.error) { setMsg(data?.error || 'Failed to save (overwrite).'); return; }
        setMsg(`Entry for report ${form.dojReportNumber} saved`);
        onSaved?.(data);
        hardClear();
        return;
      }

      // Create
      const created = await getJSON(`${API}/records`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });

      setSaving(false);
      if (!created || created.error) { setMsg(created?.error || 'Failed to save.'); return; }
      setMsg(`Entry for report ${form.dojReportNumber} saved`);
      onSaved?.(created);
      hardClear();

    } catch (e) {
      console.error(e);
      setSaving(false);
      setMsg('Network error while saving.');
    }
  }

  return (
  <form className="card" onSubmit={submit} style={{marginTop:16}}>
    <h2>Report Cell Call</h2>

    {/* Row 1: Date | Cell Call Type */}
    <Row>
      <label className="field">
        <Label>Date</Label>
        <input type="date" value={form.date} onChange={e=>upd('date',e.target.value)} />
      </label>

      <label className="field">
        <Label>Cell Call Type</Label>
        <select value={form.cellCallType} onChange={(e) => upd('cellCallType', e.target.value)}>
          <option value="CELL_CALL">Cell Call</option>
          <option value="WARRANT_ARREST">Warrant Arrest</option>
          <option value="SENTENCING_HEARING">Sentencing Hearing</option>
        </select>
      </label>
    </Row>

    {/* Row 2: DOJ Report # | Incident ID */}
    <Row>
      <label className="field"><Label>DOJ Report # (6 chars)</Label>
        <input value={form.dojReportNumber} onChange={e=>upd('dojReportNumber',six(e.target.value))} maxLength={6}/>
      </label>
      <label className="field"><Label>Incident ID (6 chars)</Label>
        <input value={form.incidentId} onChange={e=>upd('incidentId',six(e.target.value))} maxLength={6}/>
      </label>
    </Row>

    <Divider />

    {/* Row 3: Attorney Leading | Attorney Supervising (Add) */}
    <Row>
      <label className="field"><Label>Attorney Leading</Label>
        <select value={form.leadingId} onChange={e=>upd('leadingId',e.target.value)}>
          <option value="">Select…</option>
          {staffOpts.map(s=><option key={s.id} value={s.id}>{s.name}{s.role?` (${s.role})`:''}</option>)}
        </select>
      </label>

      <AddSelect key={`sup-${formKey}`} label="Attorney Supervising" options={supervisingOpts}
        selectedIds={form.supervising}
        onAdd={id=>upd('supervising',[...new Set([...form.supervising,String(id)])])}
        onRemove={id=>upd('supervising',form.supervising.filter(x=>x!==String(id)))}/>
    </Row>

    {/* Row 4: Attorney Observing | Paralegal Observing */}
    <Row>
      <AddSelect key={`att-${formKey}`} label="Attorney Observing" options={staffOpts}
        selectedIds={form.attorneyObservers}
        onAdd={id=>upd('attorneyObservers',[...new Set([...form.attorneyObservers,String(id)])])}
        onRemove={id=>upd('attorneyObservers',form.attorneyObservers.filter(x=>x!==String(id)))}/>

      <AddSelect key={`par-${formKey}`} label="Paralegal Observing" options={staffOpts}
        selectedIds={form.paralegalObservers}
        onAdd={id=>upd('paralegalObservers',[...new Set([...form.paralegalObservers,String(id)])])}
        onRemove={id=>upd('paralegalObservers',form.paralegalObservers.filter(x=>x!==String(id)))}/>
    </Row>

    <Divider />

    {/* Row 5: Verdict | Bench Verdict Number (conditional) */}
    <Row>
      <label className="field"><Label>Verdict</Label>
        <select value={form.verdict} onChange={e=>upd('verdict',e.target.value)}>
          <option value="GUILTY">Guilty</option>
          <option value="NOT_GUILTY">Not Guilty</option>
          <option value="NO_CONTEST">No Contest</option>
          <option value="BENCH_REQUEST">Bench Request</option>
        </select>
      </label>

      {form.verdict==='BENCH_REQUEST'
        ? <label className="field"><Label>Verdict Number</Label><input value={form.benchVerdictNumber} onChange={e=>upd('benchVerdictNumber',e.target.value)}/></label>
        : <div />
      }
    </Row>

    {/* Row 6: Charges Removed? | Charges Replaced? */}
    <Row>
      <label className="field"><Label>Charges Removed?</Label>
        <select value={form.chargesRemoved} onChange={e=>upd('chargesRemoved',e.target.value)}>
          <option value="no">No</option><option value="yes">Yes</option>
        </select>
      </label>

      {form.chargesRemoved==='yes'
        ? (
          <label className="field"><Label>Charges Replaced?</Label>
            <select value={form.chargesReplaced} onChange={e=>upd('chargesReplaced',e.target.value)}>
              <option value="no">No</option><option value="yes">Yes</option>
            </select>
          </label>
        ) : <div />
      }
    </Row>

    {/* Row 7: Fine | Sentence */}
    <Row>
      <label className="field"><Label>Fine ($)</Label>
        <input type="number" value={form.fine} onChange={e=>upd('fine',e.target.value)}/>
      </label>
      <label className="field"><Label>Sentence (months)</Label>
        <input type="number" value={form.sentenceMonths} onChange={e=>upd('sentenceMonths',e.target.value)}/>
      </label>
    </Row>

    <Divider />

    {/* Notes full width */}
    <label className="field"><Label>Notes</Label>
      <textarea rows={4} value={form.notes} onChange={e=>upd('notes',e.target.value)}/>
    </label>

    {/* Actions */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
      <span className="pill">Logger: {form.by}</span>
      <div style={{display:'flex',gap:8}}>
        <button type="button" className="btn" onClick={hardClear}>Clear</button>
        <button className="btn primary" disabled={saving}>{saving?'Saving...':'Save'}</button>
      </div>
    </div>
    {msg && <div style={{marginTop:10,color:'var(--text-light)'}}>{msg}</div>}
  </form>);
}

/* ========== LAST LOGGED CARD (Home) ========== */
function LastLogged(){
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    (async () => {
      const rows = await getJSON(`${API}/records`);
      if (!Array.isArray(rows) || rows.length === 0) { setLatest(null); return; }

      const getTs = (r) => {
        const t = r.savedAt || r.createdAt || r.updatedAt || r._created || r._ts;
        const n = Date.parse(t); return Number.isFinite(n) ? n : -Infinity;
      };

      let bestIdx = 0, bestTs = getTs(rows[0]);
      for (let i = 1; i < rows.length; i++) {
        const t = getTs(rows[i]);
        if (t > bestTs || (t === bestTs && i > bestIdx)) { bestTs = t; bestIdx = i; }
      }
      setLatest(rows[bestIdx]);
    })();
  }, []);

  if (!latest) return null;

  const doj = latest.dojReportNumber || 'N/A';
  const by  = latest.loggedBy || latest.by || 'Unknown';

  const addedISO =
    latest.savedAt ?? latest.createdAt ?? latest.updatedAt ?? latest._created ?? latest._ts ?? null;

  const when = addedISO ? (fmtDateTimeEST(addedISO)+' EST') : fmtDateUS(latest.date);

  return (
    <div className="card" style={{marginTop:16}}>
      <h2>Last Cell Call Logged</h2>
      <p><b>DOJ Report:</b> {doj}</p>
      <p><b>Added By:</b> {by}</p>
      <p><b>Date Added:</b> {when}</p>
    </div>
  );
}

/* ========== ANALYTICS ========== */
function Analytics(){
  const [staff,setStaff]=useState([]);
  const staffMap=useMemo(()=>Object.fromEntries(staff.map(s=>[String(s.id),s])),[staff]);

  const [from,setFrom]=useState(daysAgoYMD(30));
  const [to,setTo]=useState(todayYMD());
  const [staffId,setStaffId]=useState('');
  const [cellCallType,setCellCallType]=useState('');
  const [incidentType,setIncidentType]=useState('');
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    (async () => {
      const rows = await getJSON(`${API}/staff`);
      setStaff(Array.isArray(rows) ? rows : []);
    })();
  },[]);

  async function load(){
    setLoading(true);
    const qs=new URLSearchParams();
    if(from)qs.set('from',toLocalMidnightISO(from));
    if(to){const end=new Date(to);end.setDate(end.getDate()+1);qs.set('to',end.toISOString())}
    if(staffId)qs.set('staffId',staffId);
    if(cellCallType)qs.set('cellCallType',cellCallType);
    if(incidentType)qs.set('incidentType',incidentType);

    const data = await getJSON(`${API}/records?`+qs.toString());
    setRows(Array.isArray(data) ? data : []); // never crash UI on API error
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  const kpi=useMemo(()=>{
    const total=rows.length;
    const chargesRemoved=rows.filter(r=>r.chargesRemoved).length;
    const chargesReplaced=rows.filter(r=>r.chargesRemoved && r.chargesReplaced).length;
    const bench=rows.filter(r=>r.verdict==='BENCH_REQUEST').length;
    const totalFine=rows.reduce((s,r)=>s+(Number(r.fine)||0),0);
    const totalMonths=rows.reduce((s,r)=>s+(Number(r.sentenceMonths)||0),0);
    const byType=rows.reduce((m,r)=>((m[r.cellCallType]=(m[r.cellCallType]||0)+1),m),{});
    const supervisionCount = staffId
      ? rows.filter(r => Array.isArray(r.supervising) && r.supervising.map(String).includes(String(staffId))).length
      : rows.reduce((s,r)=> s + (Array.isArray(r.supervising) ? r.supervising.length : 0), 0);
    return{total,chargesRemoved,chargesReplaced,bench,totalFine,totalMonths,byType,supervisionCount};
  },[rows,staffId]);

  async function deleteRecord(id){
    if(!window.confirm('Delete this record?'))return;
  const delId = String(id).split(':')[0];
  await fetch(`${API}/records?id=${encodeURIComponent(delId)}`, { method:'DELETE' });
    await load();
  }

  async function generateReport(){
    const lines=[];
    lines.push(`## DOJ Analytics Report`);
    lines.push(`**Date Range:** ${from} → ${to}`);
    if(staffId){const s=staffMap[String(staffId)];lines.push(`**Lead Attorney:** ${s?.name||staffId}`)}
    lines.push(`**Total Records (Led):** ${kpi.total}`);
    lines.push(`**Cell Calls Supervised:** ${kpi.supervisionCount}`);
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
      <label className="field"><Label>Staff (LEADING only)</Label>
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
      <label className="field"><Label>Incident Type</Label>
        <select value={incidentType} onChange={e=>setIncidentType(e.target.value)}>
          <option value="">All</option>
          <option value="HUT">HUT</option>
          <option value="CRIMINAL">CRIMINAL</option>
        </select></label>
    </Row>

    <div className="row" style={{marginTop:12}}>
      <div className="card"><h3>Total Records</h3><p style={{fontSize:28,margin:0}}>{kpi.total}</p></div>
      <div className="card"><h3>Charges Removed</h3><p style={{fontSize:28,margin:0}}>{kpi.chargesRemoved}</p></div>
      <div className="card"><h3>Cell Calls Supervised</h3><p style={{fontSize:28,margin:0}}>{kpi.supervisionCount}</p></div>
      <div className="card"><h3>Total Fine</h3><p style={{fontSize:28,margin:0}}>${kpi.totalFine}</p></div>
      <div className="card"><h3>Total Sentence (months)</h3><p style={{fontSize:28,margin:0}}>{kpi.totalMonths}</p></div>
    </div>

    <div className="row" style={{marginTop:12}}>
      <button className="btn" onClick={load}>Apply Filters</button>
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
                <th>Charges Removed?</th><th>Charges Replaced?</th><th>Fine</th><th>Sentence</th><th>Type</th><th>Incident Type</th><th></th>
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
                  <td>{r.incidentType}</td>
                  <td>
                    <button
                      onClick={() => { if(window.confirm('Delete this record?')) deleteRecord(r.id) }}
                      style={{ background:'transparent', border:'none', color:'var(--text-light)', cursor:'pointer', fontSize:'1.2em' }}
                      title="Delete record"
                    >🗑️</button>
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan="12" style={{textAlign:'center'}}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>);
}

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
  </div>);
}
