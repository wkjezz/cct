import React, { useEffect, useState } from 'react'
import { getJSON, API, fmtDateTimeEST, fmtDateUS } from '../lib/utils'

export default function LastLogged(){
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
