import React, { useState } from 'react';
import { useApp } from '../../App';
import { supabase } from '../../supabaseClient';
import { User, Mail, Shield, Camera, LogOut, Check } from 'lucide-react';

export default function Profile() {
  const { currentUser, accounts, transactions, logout, refreshData } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [saving, setSaving] = useState(false);

  // Profile Stats
  const userAccounts = accounts.filter(a => a.userId === currentUser?.id);
  const totalBalance = userAccounts.reduce((acc, curr) => acc + curr.balance, 0);
  const userTxCount = transactions.filter(t => t.createdBy === currentUser?.id).length;

  const handleUpdateProfile = async () => {
      if(!currentUser) return;
      setSaving(true);
      
      const { error } = await supabase.from('profiles').update({ name }).eq('id', currentUser.id);
      
      if (!error) {
          setEditing(false);
          refreshData();
      }
      setSaving(false);
  }

  if (!currentUser) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6">User Profile</h2>

      {/* Profile Card */}
      <div className="bg-dark-card border border-gray-800 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-900/50 to-purple-900/50"></div>
        
        <div className="relative flex flex-col items-center mt-10">
           <div className="relative">
              <img src={currentUser.avatar} alt={currentUser.name} className="w-24 h-24 rounded-full border-4 border-dark-card shadow-xl" />
              <button className="absolute bottom-0 right-0 p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-500 border-4 border-dark-card">
                 <Camera size={14} />
              </button>
           </div>
           
           <div className="mt-4 text-center w-full">
             {editing ? (
                 <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                     <input 
                       type="text" 
                       value={name}
                       onChange={(e) => setName(e.target.value)}
                       className="bg-dark-bg border border-gray-700 rounded-lg px-3 py-1 text-center text-white focus:border-indigo-500 focus:outline-none"
                     />
                     <button onClick={handleUpdateProfile} className="p-1 bg-emerald-600 rounded-md text-white">
                        {saving ? "..." : <Check size={16} />}
                     </button>
                 </div>
             ) : (
                <h3 className="text-2xl font-bold text-white cursor-pointer hover:text-indigo-400 flex items-center justify-center gap-2" onClick={() => setEditing(true)}>
                    {currentUser.name}
                </h3>
             )}
             <p className="text-gray-400 text-sm mt-1">{currentUser.email}</p>
             <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold mt-3 uppercase tracking-wider border border-indigo-500/20">
               <Shield size={12} />
               {currentUser.role}
             </div>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-800">
            <div className="text-center">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Personal Balance</p>
                <p className="text-2xl font-mono text-white mt-1">${totalBalance.toLocaleString()}</p>
            </div>
            <div className="text-center border-l border-gray-800">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Transactions</p>
                <p className="text-2xl font-mono text-white mt-1">{userTxCount}</p>
            </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-dark-card border border-gray-800 rounded-3xl p-6">
         <h4 className="font-bold text-white mb-4 flex items-center gap-2">
            <Mail size={18} className="text-gray-500" />
            Account Details
         </h4>
         <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-gray-800/50">
               <span className="text-gray-400">Email Address</span>
               <span className="text-white">{currentUser.email}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800/50">
               <span className="text-gray-400">User ID</span>
               <span className="text-white text-xs font-mono bg-dark-bg px-2 py-1 rounded text-gray-400">{currentUser.id}</span>
            </div>
            <div className="flex justify-between py-3">
               <span className="text-gray-400">Password</span>
               <button className="text-indigo-400 text-sm hover:text-indigo-300">Change Password</button>
            </div>
         </div>
      </div>

      <button 
        onClick={logout}
        className="w-full bg-red-500/10 border border-red-900/50 hover:bg-red-500/20 text-red-500 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
      >
        <LogOut size={20} />
        Sign Out
      </button>

    </div>
  );
}