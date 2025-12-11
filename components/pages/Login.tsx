import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { LayoutDashboard, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // Auth state listener in App.tsx handles redirection
  };

  return (
    <div className="h-screen w-full bg-dark-bg flex items-center justify-center p-4 overflow-hidden relative">
      <div className="w-full max-w-md relative z-10">
        
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <LayoutDashboard size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">FamilyFinance</h1>
          <p className="text-gray-400">Manage your family wealth together.</p>
        </div>

        {/* Login Card */}
        <div className="bg-dark-card border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="flex justify-end">
                <button type="button" className="text-xs text-indigo-400 hover:text-indigo-300">Forgot Password?</button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Login'}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-gray-500 text-sm">
          Don't have an account? <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">Register</Link>
        </p>
      </div>
    </div>
  );
}