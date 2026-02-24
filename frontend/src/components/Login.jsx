import { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login({ setupRequired, onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const isSetup = setupRequired;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {return;}
    if (isSetup && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (isSetup && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = isSetup ? '/api/auth/setup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Authentication failed.');
      } else {
        onSuccess?.();
      }
    } catch {
      setError('Connection failed.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '40px 32px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="openOrchestrator" style={{
            width: 80, height: 80, borderRadius: 18,
            margin: '0 auto 16px', display: 'block',
            filter: 'drop-shadow(0 0 40px rgba(230, 57, 70, 0.3))',
          }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
            {isSetup ? 'Set Password' : 'openOrchestrator'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
            {isSetup ? 'Choose a master password to protect your data.' : 'Enter your password to continue.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              className="input-apple"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              autoFocus
              style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
            }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {isSetup && (
            <input
              type={showPw ? 'text' : 'password'}
              className="input-apple"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(null); }}
            />
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,59,48,0.08)', color: '#D70015',
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}
            style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Please wait...' : isSetup ? 'Set Password & Start' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
