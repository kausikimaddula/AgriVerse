import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Key, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { AgrigenLogo } from '../components/AgrigenIcons.jsx';
import failoverApi from '../api/failoverClient.js';
import { useApp } from '../context/AppContext.jsx';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAdminAuth, adminToken, loadAdminRegistrations } = useApp();

  const [passkey, setPasskey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect to master portal
  React.useEffect(() => {
    if (adminToken) {
      const from = location.state?.from?.pathname || '/master';
      navigate(from, { replace: true });
    }
  }, [adminToken, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!passkey.trim()) {
      setError('Please enter the master passkey.');
      return;
    }
    setLoading(true);

    try {
      const res = await failoverApi.post('auth/login', {
        passkey: passkey.trim(),
        password: passkey.trim()
      });

      if (res.data?.success && res.data?.token) {
        setAdminAuth(res.data.token, res.data.admin);
        loadAdminRegistrations(res.data.token);
        const from = location.state?.from?.pathname || '/master';
        navigate(from, { replace: true });
      } else {
        setError(res.data?.error || 'Invalid master passkey.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Authentication service unreachable.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAF4F4] text-[#1A3C34] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Top return link */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3D6153] hover:text-[#1A3C34] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>

          <span className="text-[11px] font-mono text-[#6B9080]">
            Master Passkey Protected
          </span>
        </div>

        {/* Card */}
        <div className="bg-white p-7 sm:p-9 rounded-[20px] border border-[#CCE3DE] shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-[18px] bg-black text-white flex items-center justify-center shadow-md overflow-hidden border border-black/10">
              <AgrigenLogo className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-black text-[#1A3C34] tracking-tight">
              AgriVerse Master Portal
            </h1>
            <p className="text-xs text-[#3D6153]">
              Enter system passkey to unlock master administration
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-[12px] bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1A3C34] mb-1.5">
                Master Passkey
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoFocus
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  placeholder="Enter passkey"
                  className="w-full pl-10 pr-4 py-3 rounded-[12px] bg-[#F4F9F6] border border-[#CCE3DE] text-xs sm:text-sm text-[#1A3C34] font-mono tracking-widest outline-none focus:border-[#1A3C34] focus:bg-white transition-all shadow-inner"
                />
                <Key className="w-4 h-4 text-[#6B9080] absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-[12px] bg-[#1A3C34] hover:bg-[#132A24] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating Passkey...</span>
              ) : (
                <>
                  <span>Unlock Master Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
