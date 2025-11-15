import React, { useEffect, useMemo, useState } from 'react'
import admins from '../../data/admins.json'
import AddSelect from './AddSelect'
import { getJSON, API, toLocalMidnightISO, todayYMD } from '../lib/utils'

function Label({children}){ return <div className="label">{children}</div> }
function Row({children}){ return <div className="row">{children}</div> }
function Divider(){ return <div className="section-sep" /> }

// Manual report form with image-paste area. Paste an image (Ctrl+V) into the paste box,
// then click Analyze to POST the image to `${API}/analyze` (server-side analysis service).
export default function FormManual({ user, onSaved }){
  if (!user || !user.admin) return null;

  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(()=>{
    (async ()=>{
      const rows = await getJSON(`${API}/staff`);
      setStaff(Array.isArray(rows)?rows:[]);
    })();
  },[]);

  useEffect(()=>{
    if (!user) return;
    const label = admins[user.id] || (typeof window !== 'undefined' ? localStorage.getItem(`rpName_${user.id}`) : null) || user.username.replace(/#\d+$/,'');
    setForm(f => ({ ...f, by: label }));
  }, [user]);

  const staffOpts = useMemo(()=> staff.map(s => ({ id:String(s.id), name: s.name, role: s.role })), [staff]);
  const paralegalOpts = useMemo(() => staff
    .filter(s => /paralegal/i.test(s.role))
    .map(s => ({ id: String(s.id), name: s.name, role: s.role })), [staff]);
  const supervisingOpts = useMemo(()=>{
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
    cellCallType: 'CELL_CALL',
    notes: '',
    by: 'dev-ui'
  });

  const [form,setForm] = useState(init());
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));
  const six=s=>String(s).slice(0,6);
  const hardClear=()=>{setForm(init());setMsg(''); setImageFile(null); setImagePreview(null)};

  function handlePaste(e){
    if (!e.clipboardData) return;
    const items = Array.from(e.clipboardData.items || []);
    const imageItem = items.find(it => it.type && it.type.startsWith('image/'));
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;
    setImageFile(blob);
    const url = URL.createObjectURL(blob);
    setImagePreview(url);
    setMsg('Image pasted — click Analyze to extract text.');
    e.preventDefault();
  }

  async function analyzeImage(){
    if (!imageFile) { setMsg('No image to analyze'); return; }
    setAnalyzing(true); setMsg('Analyzing image...');
    try {
      // Convert image to base64 to avoid multipart on the small mock endpoint
      const toDataURL = (file) => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const dataUrl = await toDataURL(imageFile);
      // Send JSON { image: dataUrl }
      const res = await fetch(`${API}/analyze`, { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ image: dataUrl }) });
      const data = await res.json();
      setAnalyzing(false);
      if (!res.ok) { setMsg(data?.error || 'Analysis failed'); return; }

      // Expected response example: { dojReportNumber, incidentId, date, leadingId, notes }
      const mapped = {};
      if (data.dojReportNumber) mapped.dojReportNumber = String(data.dojReportNumber).slice(0,6);
      if (data.incidentId) mapped.incidentId = String(data.incidentId).slice(0,6);
      if (data.date) mapped.date = data.date;
      if (data.leadingId) mapped.leadingId = String(data.leadingId);
      if (data.notes) mapped.notes = String(data.notes);

      setForm(f => ({ ...f, ...mapped }));
      setMsg('Analysis complete — review fields before saving.');
    } catch (e) {
      console.error(e);
      setAnalyzing(false);
      setMsg('Network error during analysis.');
    }
  }

  async function submit(e){
    e?.preventDefault?.();
    // reuse basic validation from the original form
    if(!form.incidentId) { setMsg('Incident ID required'); return; }
    if(form.incidentId.length!==6) { setMsg('Incident ID must be 6 chars'); return; }
    if(!form.dojReportNumber) { setMsg('DOJ Report required'); return; }
    if(form.dojReportNumber.length!==6) { setMsg('DOJ Report must be 6 chars'); return; }
    if(!form.leadingId) { setMsg('Select lead attorney'); return; }

    setSaving(true); setMsg('Saving...');
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
      cellCallType: form.cellCallType,
      notes: form.notes,
      by: form.by
    };

    try {
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
      <h2>Manual Report (Paste Image)</h2>

      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
        <div style={{flex:1}}>
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

          <Row>
            <label className="field"><Label>DOJ Report # (6 chars)</Label>
              <input value={form.dojReportNumber} onChange={e=>upd('dojReportNumber',six(e.target.value))} maxLength={6}/>
            </label>
            <label className="field"><Label>Incident ID (6 chars)</Label>
              <input value={form.incidentId} onChange={e=>upd('incidentId',six(e.target.value))} maxLength={6}/>
            </label>
          </Row>

          <Divider />

          <Row>
            <label className="field"><Label>Attorney Leading</Label>
              <select value={form.leadingId} onChange={e=>upd('leadingId',e.target.value)}>
                <option value="">Select…</option>
                {staffOpts.map(s=><option key={s.id} value={s.id}>{s.name}{s.role?` (${s.role})`:''}</option>)}
              </select>
            </label>

            <AddSelect key={`sup-manual`} label="Attorney Supervising" options={supervisingOpts}
              selectedIds={form.supervising}
              onAdd={id=>upd('supervising',[...new Set([...form.supervising,String(id)])])}
              onRemove={id=>upd('supervising',form.supervising.filter(x=>x!==String(id)))}/>
          </Row>

          <Row>
            <AddSelect key={`att-manual`} label="Attorney Observing" options={staffOpts}
              selectedIds={form.attorneyObservers}
              onAdd={id=>upd('attorneyObservers',[...new Set([...form.attorneyObservers,String(id)])])}
              onRemove={id=>upd('attorneyObservers',form.attorneyObservers.filter(x=>x!==String(id)))}/>

            <AddSelect key={`par-manual`} label="Paralegal Observing" options={paralegalOpts}
              selectedIds={form.paralegalObservers}
              onAdd={id=>upd('paralegalObservers',[...new Set([...form.paralegalObservers,String(id)])])}
              onRemove={id=>upd('paralegalObservers',form.paralegalObservers.filter(x=>x!==String(id)))}/>
          </Row>

          <Divider />

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

          <Divider />

          <label className="field"><Label>Notes</Label>
            <textarea rows={4} value={form.notes} onChange={e=>upd('notes',e.target.value)}/>
          </label>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
            <span className="pill">Logger: {form.by}</span>
            <div style={{display:'flex',gap:8}}>
              <button type="button" className="btn" onClick={hardClear}>Clear</button>
              <button className="btn primary" disabled={saving}>{saving?'Saving...':'Save'}</button>
            </div>
          </div>
          {msg && <div style={{marginTop:10,color:'var(--text-light)'}}>{msg}</div>}
        </div>

        <div style={{width:320}}>
          <Label>Paste image here</Label>
          <div onPaste={handlePaste} tabIndex={0} style={{border:'1px dashed var(--muted)',minHeight:180,display:'flex',alignItems:'center',justifyContent:'center',padding:12,background:'#0f0f10',color:'var(--text)'}}>
            {imagePreview ? (
              <img src={imagePreview} alt="pasted" style={{maxWidth:'100%',maxHeight:240}} />
            ) : (
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:13,opacity:.9}}>Focus here and press Ctrl+V to paste an image</div>
                <div style={{marginTop:8,fontSize:12,opacity:.7}}>Or use the file input below</div>
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0]; if(f){setImageFile(f); setImagePreview(URL.createObjectURL(f)); setMsg('Image selected')}}} />
            <button type="button" className="btn" onClick={analyzeImage} disabled={analyzing}>{analyzing? 'Analyzing...':'Analyze'}</button>
          </div>
        </div>
      </div>
    </form>
  );
}
