import { } from 'react';

export const API = import.meta.env.VITE_API_BASE || '/api';

export function toLocalMidnightISO(ymd){
  const [y,m,d]=ymd.split('-').map(Number);
  return new Date(y,m-1,d,0,0,0,0).toISOString();
}
export function todayYMD(){ return new Date().toISOString().slice(0,10) }
export function daysAgoYMD(n){ const t=new Date(); t.setDate(t.getDate()-n); return t.toISOString().slice(0,10) }
export function fmtDateUS(iso){ try{ const d=new Date(iso); return d.toLocaleDateString('en-US') }catch{ return iso } }
export function fmtDateTimeEST(iso){ try{ return new Date(iso).toLocaleString('en-US',{ timeZone:'America/New_York' }) }catch{ return iso } }

/** Safe fetch that returns JSON or null on error (never throws). */
export async function getJSON(url, options) {
  try {
    const r = await fetch(url, options);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export function canonicalRole(role){
  if(!role) return 'Other';
  const r = String(role).toLowerCase();
  if(/chief|deputy/.test(r)) return 'Command';
  if(/lead/.test(r)) return 'Lead';
  if(/senior/.test(r)) return 'Senior';
  if(/junior/.test(r)) return 'Junior';
  if(/paralegal/.test(r)) return 'Paralegal';
  if(/attorney|lawyer|counsel/.test(r)) return 'Attorney';
  return 'Other';
}
