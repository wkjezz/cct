import React from 'react'

export default function ChipList({items, render, onRemove}){
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
