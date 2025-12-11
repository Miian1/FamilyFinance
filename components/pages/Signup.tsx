import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { LayoutDashboard, Lock, Mail, User, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Sign up user in Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Create Profile entry
        const { error: profileError } = await supabase.from('profiles').insert([
            {
                id: authData.user.id,
                name: name,
                email: email,
                role: 'admin', // First user usually admin, logic could be refined
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
            }
        ]);

        if (profileError) {
             console.error("Error creating profile:", profileError);
             throw new Error("Account created but profile setup failed.");
        }

        // 3. Create a default account for the user so dashboard isn't empty
        await supabase.from('accounts').insert([
            {
                user_id: authData.user.id,
                name: 'Main Savings',
                balance: 0,
                type: 'personal',
                currency: 'USD',
                color: 'bg-indigo-600'
            }
        ]);

        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-dark-bg flex items-center justify-center p-4 overflow-hidden relative">
      <div className="w-full max-w-md relative z-10">
        
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <LayoutDashboard size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-gray-400">Join FamilyFinance today.</p>
        </div>

        {/* Signup Card */}
        <div className="bg-dark-card border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSignup} className="space-y-6">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

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
                  minLength={6}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Sign Up'}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-gray-500 text-sm">
          Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Login</Link>
        </p>
      </div>
    </div>
  );
}