import React, { useRef, useState } from 'react'
import AiLogo from './AiLogo'
import Form from './Form'
import { API } from '../lib/utils'

export default function SmartView({ user, onSaved, setView }){
  const formRef = useRef();
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [msg, setMsg] = useState('');

  function handlePaste(e){
    if (!e.clipboardData) return;
    const items = Array.from(e.clipboardData.items || []);
    const imageItem = items.find(it => it.type && it.type.startsWith('image/'));
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;
    setImageFile(blob);
    setImagePreview(URL.createObjectURL(blob));
    setMsg('Image pasted — click Analyze to extract text.');
    e.preventDefault();
  }

  async function analyzeImage(){
    if (!imageFile) { setMsg('No image to analyze'); return; }
    setAnalyzing(true); setMsg('Analyzing image...');
    try {
      // Quick health check to give a clearer error when the API isn't reachable
      try {
        const h = await fetch(`${API}/health`);
        if (!h.ok) {
          setAnalyzing(false);
          setMsg(`API health check failed: ${h.status} ${h.statusText}`);
          return;
        }
      } catch (he) {
        setAnalyzing(false);
        setMsg(`API unreachable: ${he.message}`);
        return;
      }
      const toDataURL = (file) => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      // Resize / upscale small images before sending to OCR to improve small-text recognition.
      const resizeDataUrl = (dataUrl, { maxWidth = 2000, scaleFactor = 2, quality = 0.92 } = {}) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          try {
            const origW = img.naturalWidth || img.width;
            const origH = img.naturalHeight || img.height;
            // target width: the larger of origW * scaleFactor or maxWidth, but don't shrink
            const targetW = Math.max(Math.min(maxWidth, Math.max(origW * scaleFactor, origW)), origW);
            const targetH = Math.round((origH * targetW) / origW);
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            // fill with white for JPEG backgrounds
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // prefer JPEG to reduce size and improve OCR in many cases
            const out = canvas.toDataURL('image/jpeg', quality);
            res(out);
          } catch (e) { rej(e); }
        };
        img.onerror = (e) => rej(new Error('failed to load image for resize'));
        img.src = dataUrl;
      });

      const dataUrl = await toDataURL(imageFile);
      let sendDataUrl = dataUrl;
      try {
        sendDataUrl = await resizeDataUrl(dataUrl, { maxWidth: 2000, scaleFactor: 2, quality: 0.92 });
      } catch (re) {
        console.warn('image resize failed, sending original', re);
        sendDataUrl = dataUrl;
      }

      const res = await fetch(`${API}/analyze`, { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ image: sendDataUrl }) });
      let data;
      try { data = await res.json(); } catch (pj) { data = null; }
      setAnalyzing(false);
      if (!res.ok) { setMsg(data?.error || `Analysis failed: ${res.status} ${res.statusText}`); return; }

      // Map known fields from analysis to form keys. setValues accepts partial updates.
      const mapped = {};
      if (data.dojReportNumber) mapped.dojReportNumber = String(data.dojReportNumber).slice(0,6);
      if (data.incidentId) mapped.incidentId = String(data.incidentId).slice(0,6);
      if (data.date) mapped.date = data.date;
      if (data.leadingId) mapped.leadingId = String(data.leadingId);
      if (data.notes) mapped.notes = String(data.notes);
      if (typeof data.chargesRemoved !== 'undefined') mapped.chargesRemoved = data.chargesRemoved ? 'yes' : 'no';
      if (typeof data.chargesReplaced !== 'undefined') mapped.chargesReplaced = data.chargesReplaced ? 'yes' : 'no';

      formRef.current?.setValues(mapped);
      setMsg('Analysis complete — review fields before saving.');
    } catch (e) {
      console.error(e);
      setAnalyzing(false);
      setMsg('Network error during analysis.');
    }
  }

  return (
    <div className="card" style={{marginTop:16}}>
      <h2 style={{display:'flex',alignItems:'center',gap:8}}><AiLogo size={22}/> Smart Report <small style={{fontSize:12,opacity:0.7}}>(BETA)</small></h2>
      <p style={{color:'var(--text-light)'}}>
        AI can make mistakes — manually check the extracted data before submitting. This feature is editor-only.
      </p>

      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
        <div style={{width:340}}>
          <div style={{marginBottom:8}}><strong>Paste or select the image to analyze</strong></div>
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
          {msg && <div style={{marginTop:10,color:'var(--text-light)'}}>{msg}</div>}
        </div>

        <div style={{flex:1}}>
          <Form ref={formRef} user={user} onSaved={onSaved} />
        </div>
      </div>

      <div style={{marginTop:8}}>
        <button className="btn" onClick={() => setView && setView('landing')}>Back</button>
      </div>
    </div>
  )
}
