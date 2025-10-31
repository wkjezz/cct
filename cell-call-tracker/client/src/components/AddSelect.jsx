import React, { useState } from 'react'
import ChipList from './ChipList'

export default function AddSelect({label, options, selectedIds, onAdd, onRemove}){
  const [pick, setPick] = useState('');
  const left = options.filter(o => !selectedIds.includes(String(o.id)));
  return (
    <label className="field">
      <div className="label">{label}</div>
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
