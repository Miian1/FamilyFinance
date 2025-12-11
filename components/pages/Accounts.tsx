import React, { useState, useEffect } from 'react';
import { useApp } from '../../App';
import { supabase } from '../../supabaseClient';
import { MoreVertical, Plus, X, Wallet, Users, User, Loader2, Ban, Eye, UserPlus, Clock, UserCheck, LogOut } from 'lucide-react';
import { AccountType, Role } from '../../types';
import { useNavigate } from 'react-router-dom';

export default function Accounts() {
  const { accounts, users, currentUser, refreshData } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsAccount, setDetailsAccount] = useState<any | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  // Local state to simulate pending requests for this session
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newType, setNewType] = useState<AccountType>(AccountType.PERSONAL);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  // --- Filter Accounts based on Role ---
  // Member: Only OWN personal accounts, but ALL Shared accounts (created by admin)
  // Admin: All accounts
  const visibleAccounts = accounts.filter(acc => {
      if (!currentUser) return false;
      if (currentUser.role === Role.ADMIN) return true;
      
      const isMine = acc.userId === currentUser.id;
      const isShared = acc.type === AccountType.SHARED;
      
      // Show if it's mine (Personal) OR if it is a Shared account
      return (isMine && acc.type === AccountType.PERSONAL) || isShared;
  });

  const handleCreateAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newName || !currentUser) return;
      setSubmitting(true);

      const table = newType === AccountType.SHARED ? 'group_accounts' : 'accounts';
      const insertData: any = {
          user_id: currentUser.id,
          name: newName,
          balance: parseFloat(newBalance) || 0,
          currency: 'USD',
          color: newType === AccountType.SHARED ? 'bg-emerald-600' : 'bg-indigo-600',
          is_suspended: false
      };
      
      if (newType === AccountType.SHARED) {
          // No 'type' column needed if tables are split, but if schema has it, we add it. 
          // Based on new schema 'group_accounts' doesn't have 'type'.
          insertData.members = [];
      } else {
          // 'accounts' table might still have type column if legacy
          insertData.type = newType; 
      }

      const { error } = await supabase.from(table).insert([insertData]);

      if (!error) {
          refreshData();
          setIsModalOpen(false);
          setNewName('');
          setNewBalance('');
      }
      setSubmitting(false);
  };

  const handleJoinRequest = async (account: any) => {
      const targetAdminId = account.userId; // Owner
      if (targetAdminId) {
          await supabase.from('notifications').insert([{
              user_id: targetAdminId,
              title: "Fund Join Request",
              message: `${currentUser?.name} requests to join the family fund: ${account.name}`,
              type: 'invite', 
              status: 'pending',
              data: { accountId: account.id, action: 'join' }
          }]);
          setPendingRequests(prev => new Set(prev).add(account.id));
      }
  };

  const handleLeaveGroup = async (account: any) => {
      if (!confirm(`Are you sure you want to leave the group "${account.name}"?`)) return;

      try {
          // 1. Fetch fresh data to ensure we have the latest list
          // Shared accounts are now in group_accounts
          const { data: freshAccount, error: fetchError } = await supabase
              .from('group_accounts')
              .select('members')
              .eq('id', account.id)
              .single();

          if (fetchError) throw fetchError;

          const currentMembers: string[] = freshAccount.members || [];
          const updatedMembers = currentMembers.filter((id) => id !== currentUser?.id);

          // 2. Update DB
          const { error: updateError } = await supabase
            .from('group_accounts')
            .update({ members: updatedMembers })
            .eq('id', account.id);

          if (updateError) throw updateError;

          // 3. Refresh UI
          await refreshData();
          
          // Notify admin/owner
          const targetAdminId = account.userId;
          if (targetAdminId) {
             await supabase.from('notifications').insert([{
                 user_id: targetAdminId,
                 title: "Member Left",
                 message: `${currentUser?.name} has left the family fund: ${account.name}`,
                 type: 'info',
                 is_read: false
             }]);
          }

      } catch (err: any) {
          console.error("Error leaving group:", err);
          alert("Failed to leave group. Please try again.");
      }
  };

  const handleRemoveMember = async (accountId: string, memberId: string) => {
      if (!confirm("Remove this member from the group?")) return;
      
      try {
          // 1. Fetch fresh from group_accounts
          const { data: freshAccount, error: fetchError } = await supabase
              .from('group_accounts')
              .select('members, name')
              .eq('id', accountId)
              .single();

          if (fetchError) throw fetchError;

          const currentMembers: string[] = freshAccount.members || [];
          const updatedMembers = currentMembers.filter((id) => id !== memberId);

          // 2. Update DB
          const { error: updateError } = await supabase
            .from('group_accounts')
            .update({ members: updatedMembers })
            .eq('id', accountId);

          if (updateError) throw updateError;

          // 3. Refresh UI & Modal
          await refreshData();
          setDetailsAccount((prev: any) => {
              if (!prev || prev.id !== accountId) return prev;
              return { ...prev, members: updatedMembers };
          });
          
          // Notify the removed user
          await supabase.from('notifications').insert([{
             user_id: memberId,
             title: "Removed from Group",
             message: `You have been removed from the family fund: ${freshAccount.name}`,
             type: 'alert',
             is_read: false
         }]);

      } catch (err: any) {
          console.error("Error removing member:", err);
          alert("Failed to remove member.");
      }
  };

  const toggleSuspend = async (account: any) => {
      const action = account.isSuspended ? "Unsuspend" : "Suspend";
      if (!confirm(`${action} this account? No transactions will be allowed.`)) return;
      
      const table = account.type === AccountType.SHARED ? 'group_accounts' : 'accounts';
      const { error } = await supabase.from(table).update({ is_suspended: !account.isSuspended }).eq('id', account.id);
      
      if(error) {
          console.error("Suspend error:", error);
          alert(`Failed to update account status: ${error.message}`);
      } else {
          refreshData();
          setActiveMenu(null);
      }
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setActiveMenu(activeMenu === id ? null : id);
  };

  useEffect(() => {
      const closeMenu = () => setActiveMenu(null);
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold text-white">Family Accounts</h2>
         
         {currentUser?.role === Role.ADMIN && (
             <button 
               onClick={() => setIsModalOpen(true)}
               className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl transition-all text-sm font-medium shadow-lg shadow-indigo-600/20"
             >
               <Plus size={18} />
               Add Account
             </button>
         )}
      </div>

      <div className="grid gap-4">
        {visibleAccounts.length === 0 && (
            <div className="text-gray-500 text-center py-12 bg-dark-card/30 rounded-3xl border border-gray-800 border-dashed">
                <Wallet size={48} className="mx-auto mb-3 opacity-20" />
                <p>No accounts visible.</p>
            </div>
        )}

        {visibleAccounts.map((account, index) => {
          const owner = users.find(u => u.id === account.userId);
          const isShared = account.type === AccountType.SHARED;
          const isOwner = currentUser?.id === account.userId;
          const isMember = account.members?.includes(currentUser?.id || '');
          const isPending = pendingRequests.has(account.id);
          const isSuspended = account.isSuspended;
          
          // Determine if menu should open upwards (if it's one of the last items in list)
          const isLastItem = index > visibleAccounts.length - 2 && visibleAccounts.length > 2;

          return (
            <div key={account.id} className={`bg-dark-card border border-gray-800 p-5 rounded-3xl relative group transition-all hover:border-gray-700 ${isSuspended ? 'opacity-75 grayscale-[0.5]' : ''}`}>
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    {/* Avatar / Icon */}
                    <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-dark-bg border-2 border-gray-800 flex items-center justify-center overflow-hidden">
                             {isShared ? (
                                 <Wallet size={24} className="text-emerald-500" />
                             ) : (
                                 <img src={owner?.avatar} alt={account.name} className="w-full h-full object-cover" />
                             )}
                        </div>
                        {/* Status Dot */}
                        <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-dark-card ${isShared ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                    </div>

                    {/* Main Info */}
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <h3 className="font-bold text-lg text-white leading-none">{account.name}</h3>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                isShared 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            }`}>
                                {isShared ? 'SHARED' : 'PERSONAL'}
                            </span>
                             {isSuspended && (
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                                    Suspended
                                </span>
                            )}
                        </div>
                        <p className="text-2xl font-mono font-bold text-white tracking-tight">
                            {formatCurrency(account.balance, account.currency)}
                        </p>
                    </div>
                  </div>

                  {/* Actions / Menu */}
                  <div 
                    className="relative"
                    onMouseLeave={() => { if(activeMenu === account.id) setActiveMenu(null); }}
                  >
                      {currentUser?.role === Role.ADMIN ? (
                          <>
                              <button 
                                onClick={(e) => toggleMenu(e, account.id)}
                                className="p-2 text-gray-500 hover:text-white hover:bg-dark-bg rounded-lg transition-colors relative z-10"
                              >
                                <MoreVertical size={20} />
                              </button>
                              
                              {activeMenu === account.id && (
                                  <div className={`absolute right-0 w-48 z-50 ${isLastItem ? 'bottom-full pb-1' : 'top-full pt-1'}`}>
                                      <div className="bg-dark-card/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl overflow-hidden py-1">
                                          <button 
                                            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3 transition-colors"
                                            onClick={() => { setDetailsAccount(account); setActiveMenu(null); }}
                                          >
                                              <Eye size={16} /> See Details
                                          </button>
                                          <button 
                                            className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors ${isSuspended ? 'text-emerald-400 hover:bg-emerald-900/20' : 'text-rose-400 hover:bg-rose-900/20'}`}
                                            onClick={() => toggleSuspend(account)}
                                          >
                                              <Ban size={16} /> {isSuspended ? 'Unsuspend' : 'Suspend'}
                                          </button>
                                      </div>
                                  </div>
                              )}
                          </>
                      ) : (
                          // Member Logic for Shared Accounts
                          isShared && !isOwner && (
                             <div className="flex items-center">
                                 {isPending ? (
                                    <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg font-medium border border-amber-500/20">
                                        <Clock size={12} /> Pending
                                    </span>
                                 ) : isMember ? (
                                    <button 
                                        onClick={() => handleLeaveGroup(account)}
                                        className="group flex items-center gap-2 px-3 py-1.5 bg-dark-bg border border-gray-700 text-gray-400 text-xs font-medium rounded-lg hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500 transition-all min-w-[90px] justify-center"
                                    >
                                        <span className="group-hover:hidden flex items-center gap-2"><UserCheck size={14} /> Joined</span>
                                        <span className="hidden group-hover:flex items-center gap-2"><LogOut size={14} /> Leave</span>
                                    </button>
                                 ) : (
                                    <button 
                                        onClick={() => handleJoinRequest(account)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-500 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-emerald-600 hover:text-white transition-all border border-emerald-600/20"
                                    >
                                        <UserPlus size={14} /> Join Fund
                                    </button>
                                 )}
                             </div>
                          )
                      )}
                  </div>
              </div>

              {/* Shared Account Footer Indicator */}
              {isShared && (
                  <div className="mt-4 pt-3 border-t border-gray-800/50 flex items-center justify-end gap-2 text-emerald-500">
                      <Users size={14} />
                      <span className="text-xs font-medium tracking-wide">Family Fund</span>
                  </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Details Modal */}
      {detailsAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetailsAccount(null)}>
            <div className="bg-dark-card border border-gray-800 w-full max-w-sm rounded-3xl p-0 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header Graphic */}
                <div className={`h-24 w-full ${detailsAccount.type === 'shared' ? 'bg-gradient-to-r from-emerald-800 to-teal-900' : 'bg-gradient-to-r from-indigo-800 to-purple-900'}`}></div>
                <button onClick={() => setDetailsAccount(null)} className="absolute top-4 right-4 bg-black/20 p-2 rounded-full text-white hover:bg-black/40 backdrop-blur-sm">
                    <X size={16} />
                </button>

                <div className="px-6 pb-8 -mt-10">
                    {/* Icon */}
                    <div className="w-20 h-20 rounded-2xl bg-dark-card border-4 border-dark-card shadow-lg flex items-center justify-center mx-auto mb-4">
                        {detailsAccount.type === 'shared' ? <Wallet size={32} className="text-emerald-500" /> : <User size={32} className="text-indigo-500" />}
                    </div>
                    
                    <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-white">{detailsAccount.name}</h3>
                        <p className="text-gray-400 text-sm mt-1">Owned by {users.find(u => u.id === detailsAccount.userId)?.name}</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 border-b border-gray-800">
                            <span className="text-gray-500 text-sm">Status</span>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${detailsAccount.isSuspended ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                {detailsAccount.isSuspended ? 'Suspended' : 'Active'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-800">
                            <span className="text-gray-500 text-sm">Current Balance</span>
                            <span className="text-white font-mono font-bold">{formatCurrency(detailsAccount.balance, detailsAccount.currency)}</span>
                        </div>
                         {detailsAccount.type === 'shared' && (
                            <div className="py-3">
                                <span className="text-gray-500 text-sm block mb-2">Members</span>
                                
                                {currentUser?.id === detailsAccount.userId ? (
                                    /* Admin View: List with Remove option */
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        <div className="flex items-center justify-between bg-dark-bg p-2 rounded-lg border border-gray-800">
                                            <div className="flex items-center gap-2">
                                                <img src={users.find(u=>u.id===detailsAccount.userId)?.avatar} className="w-6 h-6 rounded-full" alt="owner"/>
                                                <span className="text-sm text-white">Me (Owner)</span>
                                            </div>
                                        </div>
                                        {detailsAccount.members?.map((mid: string) => {
                                            const m = users.find(u => u.id === mid);
                                            if (!m) return null;
                                            return (
                                                <div key={m.id} className="flex items-center justify-between bg-dark-bg p-2 rounded-lg border border-gray-800">
                                                    <div className="flex items-center gap-2">
                                                        <img src={m.avatar} className="w-6 h-6 rounded-full" alt={m.name}/>
                                                        <span className="text-sm text-white">{m.name}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleRemoveMember(detailsAccount.id, mid)}
                                                        className="text-gray-500 hover:text-red-500 p-1 rounded hover:bg-red-500/10 transition-colors"
                                                        title="Remove Member"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {(!detailsAccount.members || detailsAccount.members.length === 0) && (
                                            <p className="text-xs text-gray-600 italic">No other members</p>
                                        )}
                                    </div>
                                ) : (
                                    /* Member View: Simple Avatar Stack */
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {/* Owner first */}
                                        <img 
                                            src={users.find(u => u.id === detailsAccount.userId)?.avatar} 
                                            className="inline-block h-8 w-8 rounded-full ring-2 ring-dark-card" 
                                            title="Owner"
                                        />
                                        {/* Other members */}
                                        {detailsAccount.members?.map((mid: string) => {
                                            const m = users.find(u => u.id === mid);
                                            if (!m || m.id === detailsAccount.userId) return null;
                                            return (
                                                <img 
                                                    key={m.id}
                                                    src={m.avatar} 
                                                    alt={m.name}
                                                    className="inline-block h-8 w-8 rounded-full ring-2 ring-dark-card"
                                                    title={m.name}
                                                />
                                            )
                                        })}
                                        {(!detailsAccount.members || detailsAccount.members.length === 0) && (
                                            <span className="text-xs text-gray-600 italic ml-3 mt-1">No other members</span>
                                        )}
                                    </div>
                                )}
                            </div>
                         )}
                    </div>
                    
                    {detailsAccount.isSuspended ? (
                         <button onClick={() => { toggleSuspend(detailsAccount); setDetailsAccount(null); }} className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium">
                             Unsuspend Account
                         </button>
                    ) : (
                         <button onClick={() => { toggleSuspend(detailsAccount); setDetailsAccount(null); }} className="w-full mt-6 bg-dark-bg border border-red-900/50 text-red-500 hover:bg-red-900/20 py-3 rounded-xl font-medium">
                             Suspend Account
                         </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Create Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-dark-card border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white"
                >
                    <X size={20} />
                </button>
                
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Wallet className="text-indigo-500" /> Create Wallet
                </h3>

                <form onSubmit={handleCreateAccount} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Wallet Name</label>
                        <input 
                            type="text" 
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Vacation Fund, Personal Savings"
                            className="w-full bg-dark-bg border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none placeholder:text-gray-700"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Initial Balance</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                            <input 
                                type="number" 
                                value={newBalance}
                                onChange={(e) => setNewBalance(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-dark-bg border border-gray-800 rounded-xl py-3 pl-8 pr-4 text-white focus:border-indigo-500 focus:outline-none placeholder:text-gray-700"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Wallet Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setNewType(AccountType.PERSONAL)}
                                className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${newType === AccountType.PERSONAL ? 'bg-indigo-600/10 border-indigo-600 text-indigo-500' : 'bg-dark-bg border-gray-800 text-gray-500 hover:border-gray-700'}`}
                            >
                                <User size={20} />
                                <span className="text-sm font-bold">Personal</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setNewType(AccountType.SHARED)}
                                className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${newType === AccountType.SHARED ? 'bg-emerald-600/10 border-emerald-600 text-emerald-500' : 'bg-dark-bg border-gray-800 text-gray-500 hover:border-gray-700'}`}
                            >
                                <Users size={20} />
                                <span className="text-sm font-bold">Family Fund</span>
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl mt-4 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                        {submitting ? <Loader2 size={20} className="animate-spin" /> : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}