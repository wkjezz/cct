import React, { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react'
import admins from '../../data/admins.json'
import AddSelect from './AddSelect'
import { getJSON, API, toLocalMidnightISO, todayYMD } from '../lib/utils'

function Label({children}){ return <div className="label">{children}</div> }
function Row({children}){ return <div className="row">{children}</div> }
function Divider(){ return <div className="section-sep" /> }

const Form = forwardRef(function Form({ user, onSaved }, ref){
  // hide the form UI for non-admins
  if (!user || !user.admin) return null;
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

  // set default logger name to admin display name (or RP/local name) when user is present
  useEffect(() => {
    if (!user) return;
    const label = admins[user.id] || (typeof window !== 'undefined' ? localStorage.getItem(`rpName_${user.id}`) : null) || user.username.replace(/#\d+$/, '');
    setForm(f => ({ ...f, by: label }));
  }, [user]);
  const staffOpts = useMemo(()=> staff.map(s => ({ id:String(s.id), name: s.name, role: s.role })), [staff]);
  const paralegalOpts = useMemo(() => staff
    .filter(s => /paralegal/i.test(s.role))
    .map(s => ({ id: String(s.id), name: s.name, role: s.role })), [staff]);

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
    // incidentId removed from form
    dojReportNumber: '',
    leadingId: '',
    supervising: [],
    attorneyObservers: [],
    paralegalObservers: [],
    verdict: 'GUILTY',
    benchVerdictNumber: '',
    chargesRemoved: false,
    chargesReplaced: false,
    cellCallType: 'CELL_CALL',
    notes: '',
    by: 'dev-ui'
  });
  const [form,setForm] = useState(init());
  // expose imperative API to allow parents (e.g. SmartView) to pre-fill fields
  useImperativeHandle(ref, () => ({
    setValues: (updates) => setForm(f => ({ ...f, ...updates }))
  }), []);
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));
  const six=s=>String(s).slice(0,6);
  const hardClear=()=>{setForm(init());setMsg('');setFormKey(k=>k+1)};

  function validate(){
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
      dojReportNumber: form.dojReportNumber,
      leadingId: Number(form.leadingId),
      supervising: form.supervising.map(id => id === 'judiciary' ? 'judiciary' : Number(id)),
      attorneyObservers: form.attorneyObservers.map(Number),
      paralegalObservers: form.paralegalObservers.map(Number),
      verdict: form.verdict,
      benchVerdictNumber: form.verdict==='BENCH_REQUEST' ? form.benchVerdictNumber : null,
      chargesRemoved: !!form.chargesRemoved,
      chargesReplaced: !!form.chargesRemoved && !!form.chargesReplaced,
      cellCallType: form.cellCallType,
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

    {/* Row 1: Date of cell call | Cell Call Type | DOJ Report # */}
    <Row>
      <div style={{display:'flex',gap:12,alignItems:'center',width:'100%'}}>
        <label className="field" style={{flex:1}}>
          <Label>Date of cell call</Label>
          <input type="date" value={form.date} onChange={e=>upd('date',e.target.value)} />
        </label>

        <label className="field" style={{flex:1}}>
          <Label>Cell Call Type</Label>
          <select value={form.cellCallType} onChange={(e) => upd('cellCallType', e.target.value)}>
            <option value="CELL_CALL">Cell Call</option>
            <option value="WARRANT_ARREST">Warrant Arrest</option>
            <option value="SENTENCING_HEARING">Sentencing Hearing</option>
          </select>
        </label>

        <label className="field" style={{flex:1}}>
          <Label>DOJ Report # (6 chars)</Label>
          <input value={form.dojReportNumber} onChange={e=>upd('dojReportNumber',six(e.target.value))} maxLength={6}/>
        </label>
      </div>
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

      <AddSelect key={`par-${formKey}`} label="Paralegal Observing" options={paralegalOpts}
        selectedIds={form.paralegalObservers}
        onAdd={id=>upd('paralegalObservers',[...new Set([...form.paralegalObservers,String(id)])])}
        onRemove={id=>upd('paralegalObservers',form.paralegalObservers.filter(x=>x!==String(id)))}/>
    </Row>

    <Divider />

    {/* Row: Plea | Charge(s) Removed? | Charge(s) Replace? (all visible, proportionally distributed) */}
    <Row>
      <div style={{display:'flex',gap:12,alignItems:'center',width:'100%'}}>
        <label className="field" style={{flex:1}}>
          <Label>Plea</Label>
          <select value={form.verdict} onChange={e=>upd('verdict',e.target.value)}>
            <option value="GUILTY">Guilty</option>
            <option value="NOT_GUILTY">Not Guilty</option>
            <option value="NO_CONTEST">No Contest</option>
            <option value="BENCH_REQUEST">Bench Request</option>
          </select>
          {form.verdict==='BENCH_REQUEST' && <div style={{marginTop:8}}><Label>Plea Number</Label><input value={form.benchVerdictNumber} onChange={e=>upd('benchVerdictNumber',e.target.value)}/></div>}
        </label>

        <label className="field" style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
          <input type="checkbox" checked={!!form.chargesRemoved} onChange={e=>upd('chargesRemoved', !!e.target.checked)} style={{transform:'scale(1.25)'}} />
          <div style={{fontSize:14,fontWeight:600}}>Charge(s) Removed?</div>
        </label>

        <label className="field" style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
          <input type="checkbox" checked={!!form.chargesReplaced} onChange={e=>upd('chargesReplaced', !!e.target.checked)} style={{transform:'scale(1.25)'}} />
          <div style={{fontSize:14,fontWeight:600}}>Charge(s) Replace?</div>
        </label>
      </div>
    </Row>

    {/* Fine and Sentence fields removed */}

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
});

export default Form;
