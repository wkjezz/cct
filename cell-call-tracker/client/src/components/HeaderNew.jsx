import React from 'react'
import admins from '../../data/admins.json'
import AiLogo from './AiLogo'
import { API } from '../lib/utils'

export default function HeaderNew({ effectiveUser, user, setView }) {
  return (
    <header className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <b>Cell Call Tracker</b>
      <nav style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => setView('landing')}>Home</button>
        {effectiveUser?.admin && <button className="btn" onClick={() => setView('form')}>Report Cell Call</button>}
        <button className="btn" onClick={() => setView('analytics')}>Analytics</button>
        <button className="btn" onClick={() => setView('performance')}>Performance</button>
        {effectiveUser?.admin && <span style={{ alignSelf: 'center', opacity: 0.8, marginLeft: 8, marginRight: 8, color: 'var(--text)' }}>|</span>}
        {effectiveUser?.admin && (
          <button className="btn" onClick={() => setView('smart')} title="Smart Report (BETA)"><AiLogo size={16} style={{ marginRight: 8 }} /> Smart Report (BETA)</button>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {effectiveUser && effectiveUser.admin && (
          <span style={{ fontSize: 12, color: 'var(--text-light)', opacity: .95, fontWeight: 600 }}>
            {admins[effectiveUser.id] || (typeof window !== 'undefined' && localStorage.getItem(`rpName_${effectiveUser.id}`)) || effectiveUser.username.replace(/#\d+$/, '')}
          </span>
        )}

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={(() => {
                const a = user.avatar
                if (!a) return 'https://cdn.discordapp.com/embed/avatars/0.png'
                if (String(a).startsWith('http')) return a
                const ext = String(a).startsWith('a_') ? 'gif' : 'png'
                return `https://cdn.discordapp.com/avatars/${user.id}/${a}.${ext}`
              })()}
              alt="avatar"
              title={(typeof window !== 'undefined' && (localStorage.getItem(`rpName_${user.id}`) || user.username.replace(/#\d+$/, ''))) || user.username}
              style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', boxShadow: '0 0 0 2px rgba(0,0,0,0.1)' }}
            />
            {typeof window !== 'undefined' && localStorage.getItem(`rpName_${user.id}`) && (
              <span style={{ fontSize: 12, opacity: .95 }}>{localStorage.getItem(`rpName_${user.id}`)}</span>
            )}
            <button className="btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { window.location.href = `${API}/auth/logout` }}>Logout</button>
          </div>
        )}
      </div>
    </header>
  )
}
