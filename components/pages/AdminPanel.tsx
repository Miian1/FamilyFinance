import React, { useState } from 'react';
import { useApp } from '../../App';
import { supabase } from '../../supabaseClient';
import { Plus, Trash2, Tag, Check, Loader2, ShieldCheck, Palette, Users, Mail, Wallet, User as UserIcon, Send, ChevronDown, ChevronUp, MessageSquare, UserPlus, X, Megaphone, Search, Ban, Unlock } from 'lucide-react';
import { TransactionType, AccountType, Role } from '../../types';
import { getIcon, AVAILABLE_ICONS } from '../../constants';
import { useNavigate } from 'react-router-dom';

export default function AdminPanel() {
  const { categories, refreshData, currentUser, users, accounts } = useApp();
  const [activeTab, setActiveTab] = useState<'groups' | 'users' | 'broadcast' | 'categories'>('groups');
  const navigate = useNavigate();

  // --- Category State ---
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [newCatColor, setNewCatColor] = useState('#8b5cf6');
  const [newCatIcon, setNewCatIcon] = useState('ShoppingBag');
  const [catLoading, setCatLoading] = useState(false);
  
  // --- Broadcast State ---
  const [msgContent, setMsgContent] = useState('');
  const [msgTitle, setMsgTitle] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);

  // --- Family Fund State ---
  const [fundName, setFundName] = useState('');
  const [fundBalance, setFundBalance] = useState('');
  const [fundLoading, setFundLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  
  // Search state for adding members
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  // --- Helpers ---
  const colors = [
    '#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
  ];

  // --- Handlers: Categories ---
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    setCatLoading(true);

    const { error } = await supabase.from('categories').insert([{
        name: newCatName,
        type: newCatType,
        color: newCatColor,
        icon: newCatIcon,
        is_default: false
    }]);

    if (!error) {
        setNewCatName('');
        refreshData();
    }
    setCatLoading(false);
  };

  const handleDeleteCategory = async (id: string) => {
     if(!confirm("Are you sure?")) return;
     const { error } = await supabase.from('categories').delete().eq('id', id);
     if(!error) refreshData();
  };

  // --- Handlers: Broadcast ---
  const handleBroadcast = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!msgContent || !msgTitle) return;
      setMsgLoading(true);
      
      const targetUsers = users.filter(u => u.id !== currentUser?.id);
      
      if (targetUsers.length === 0) {
          alert("No other users to broadcast to.");
          setMsgLoading(false);
          return;
      }

      const notifications = targetUsers.map(u => ({
          user_id: u.id,
          title: msgTitle,
          message: msgContent,
          type: 'admin',
          is_read: false,
          created_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      
      if (!error) {
          setMsgContent('');
          setMsgTitle('');
          alert(`Broadcast sent successfully to ${targetUsers.length} users.`);
      } else {
          alert("Failed to send broadcast.");
          console.error(error);
      }
      setMsgLoading(false);
  };

  // --- Handlers: Family Groups ---
  const handleCreateFamilyFund = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!fundName || !currentUser) return;
      setFundLoading(true);

      const { error } = await supabase.from('group_accounts').insert([{
          user_id: currentUser.id, // Admin owns the group
          name: fundName,
          balance: parseFloat(fundBalance) || 0,
          currency: 'USD',
          color: 'bg-emerald-600',
          members: [] 
      }]);

      if (!error) {
          setFundName('');
          setFundBalance('');
          refreshData();
      }
      setFundLoading(false);
  };

  const addMemberToGroup = async (accountId: string, userId: string) => {
      try {
        // 1. Fetch fresh data to ensure we have the latest list from group_accounts
        const { data: accountData, error: fetchError } = await supabase
            .from('group_accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (fetchError || !accountData) throw new Error("Could not fetch account data");

        const currentMembers: string[] = accountData.members || [];
        
        // 2. Check if already exists
        if (currentMembers.includes(userId)) {
            alert("User is already a member of this group.");
            return;
        }

        // 3. Update
        const updatedMembers = [...currentMembers, userId];

        const { error: updateError } = await supabase.from('group_accounts')
            .update({ members: updatedMembers })
            .eq('id', accountId);

        if (updateError) throw updateError;

        // 4. Notify and Refresh
        await supabase.from('notifications').insert([{
            user_id: userId,
            title: "Added to Family Group",
            message: `You have been added to the family fund: ${accountData.name}`,
            type: 'info'
        }]);
        
        setMemberSearchTerm(''); 
        await refreshData();

      } catch (err: any) {
          console.error("Add member failed:", err);
          alert(`Failed to add member: ${err.message}`);
      }
  };

  const removeMemberFromGroup = async (accountId: string, userId: string) => {
      if(!confirm("Remove this user from the group?")) return;

      try {
          // 1. Fetch fresh data from group_accounts
          const { data: accountData, error: fetchError } = await supabase
            .from('group_accounts')
            .select('members')
            .eq('id', accountId)
            .single();

          if (fetchError) throw fetchError;
          if (!accountData) throw new Error("Account not found");

          const currentMembers: string[] = accountData.members || [];
          const updatedMembers = currentMembers.filter(m => m !== userId);

          // 2. Update DB
          const { error: updateError } = await supabase
              .from('group_accounts')
              .update({ members: updatedMembers })
              .eq('id', accountId);
          
          if (updateError) throw updateError;

          // 3. Success
          await refreshData();

      } catch (err: any) {
          console.error("Error removing member:", err);
          alert(`Failed to remove member. Error: ${err.message}`);
      }
  };

  const toggleGroupSuspend = async (group: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const action = group.isSuspended ? 'Unsuspend' : 'Suspend';
    if (!confirm(`${action} group "${group.name}"? Transactions will ${group.isSuspended ? 'be allowed' : 'be blocked'}.`)) return;

    const { error } = await supabase.from('group_accounts').update({ is_suspended: !group.isSuspended }).eq('id', group.id);
    if (!error) refreshData();
  };

  if (currentUser?.role !== Role.ADMIN) {
      return <div className="p-8 text-center text-red-500">Access Denied</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <ShieldCheck size={24} className="text-white" />
        </div>
        <div>
            <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
            <p className="text-gray-400 text-sm">System configuration and management</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-dark-card p-1 rounded-xl border border-gray-800 overflow-x-auto no-scrollbar mb-8">
          {[
            { id: 'groups', label: 'Family Groups', icon: Users },
            { id: 'users', label: 'Users Directory', icon: UserIcon },
            { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
            { id: 'categories', label: 'Categories', icon: Tag },
          ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-dark-bg'
                }`}
              >
                  <tab.icon size={16} />
                  {tab.label}
              </button>
          ))}
      </div>

      {/* --- SECTION 1: FAMILY GROUPS --- */}
      {activeTab === 'groups' && (
          <div className="space-y-8">
              
              {/* 1. Add New Group Card */}
              <div className="bg-dark-card border border-gray-800 rounded-3xl p-6">
                  <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                      <Wallet size={18} className="text-emerald-500" />
                      Add New Family Group
                  </h3>
                  <form onSubmit={handleCreateFamilyFund} className="flex flex-col md:flex-row gap-6 items-end">
                      <div className="flex-1 w-full">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Group Name</label>
                          <input 
                              type="text" 
                              value={fundName}
                              onChange={(e) => setFundName(e.target.value)}
                              placeholder="e.g. Vacation Stash"
                              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none placeholder:text-gray-600"
                              required
                          />
                      </div>
                      <div className="w-full md:w-48">
                           <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Initial Balance</label>
                           <input 
                              type="number" 
                              value={fundBalance}
                              onChange={(e) => setFundBalance(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none placeholder:text-gray-600"
                          />
                      </div>
                      <button 
                          type="submit" 
                          disabled={fundLoading}
                          className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                      >
                          {fundLoading ? <Loader2 size={20} className="animate-spin" /> : <><Plus size={18} /> Create</>}
                      </button>
                  </form>
              </div>

              {/* 2. Manage Groups & Members - Blue Border Container */}
              <div className="border border-indigo-500/30 rounded-3xl p-6 bg-indigo-500/5 relative">
                  <div className="absolute top-0 left-6 -translate-y-1/2 bg-dark-bg px-2 text-white font-bold flex items-center gap-2">
                      <Users size={16} /> Manage Groups & Members
                  </div>
                  
                  {accounts.filter(a => a.type === AccountType.SHARED).length === 0 && (
                      <p className="text-gray-500 text-sm italic py-4 text-center">No family groups created yet.</p>
                  )}

                  <div className="grid gap-4 mt-2">
                      {accounts.filter(a => a.type === AccountType.SHARED).map(group => {
                          const isExpanded = expandedGroup === group.id;
                          const groupOwner = users.find(u => u.id === group.userId);
                          const memberIds = group.members || [];
                          
                          // Filter users for search results
                          const searchResults = memberSearchTerm ? users.filter(u => {
                              const matchesSearch = u.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || 
                                                    u.email.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                                                    u.id.includes(memberSearchTerm);
                              const notMember = !memberIds.includes(u.id);
                              const notOwner = u.id !== group.userId;
                              return matchesSearch && notMember && notOwner;
                          }) : [];

                          return (
                              <div key={group.id} className={`bg-dark-card border rounded-2xl overflow-hidden shadow-sm transition-colors ${group.isSuspended ? 'border-red-900/50 bg-red-900/5' : 'border-gray-800'}`}>
                                  {/* Group Header */}
                                  <div 
                                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => {
                                        setExpandedGroup(isExpanded ? null : group.id);
                                        setMemberSearchTerm('');
                                    }}
                                  >
                                      <div className="flex items-center gap-4">
                                          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-lg ${
                                              group.isSuspended 
                                              ? 'bg-red-900/20 border-red-800 text-red-500' 
                                              : 'bg-gradient-to-br from-emerald-900 to-emerald-800 border-emerald-700/50 text-emerald-400'
                                          }`}>
                                              {group.isSuspended ? <Ban size={24} /> : <Wallet size={24} />}
                                          </div>
                                          <div>
                                              <div className="flex items-center gap-2">
                                                 <h4 className="font-bold text-white text-lg">{group.name}</h4>
                                                 {group.isSuspended && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">SUSPENDED</span>}
                                              </div>
                                              <p className="text-xs text-gray-500">Owner: {groupOwner?.name || 'Unknown'} • {memberIds.length} Members</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                          <span className="font-mono font-bold text-white text-lg">${group.balance.toLocaleString()}</span>
                                          <div className="bg-dark-bg p-1 rounded-lg border border-gray-700 text-gray-400">
                                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                          </div>
                                      </div>
                                  </div>

                                  {/* Group Details (Accordion Body) */}
                                  {isExpanded && (
                                      <div className="bg-dark-bg/30 border-t border-gray-800 p-5 space-y-6">
                                          
                                          {/* Suspend Toggle */}
                                          <div className="flex items-center justify-between bg-dark-card border border-gray-800 p-4 rounded-xl">
                                              <div>
                                                  <p className="font-bold text-sm text-white">Account Status</p>
                                                  <p className="text-xs text-gray-500">
                                                      {group.isSuspended ? "Transactions are currently blocked." : "Account is active and operating normally."}
                                                  </p>
                                              </div>
                                              <button 
                                                onClick={(e) => toggleGroupSuspend(group, e)}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border ${
                                                    group.isSuspended 
                                                    ? 'bg-emerald-600/10 text-emerald-500 border-emerald-600/50 hover:bg-emerald-600/20' 
                                                    : 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20'
                                                }`}
                                              >
                                                  {group.isSuspended ? <><Unlock size={16}/> Unsuspend</> : <><Ban size={16}/> Suspend</>}
                                              </button>
                                          </div>

                                          {/* Members List */}
                                          <div>
                                              <p className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Members</p>
                                              <div className="space-y-2">
                                                  {/* Owner Item */}
                                                  <div 
                                                    className="flex items-center justify-between bg-dark-bg border border-gray-800 p-3 rounded-xl opacity-80 cursor-pointer hover:border-gray-600 transition-colors"
                                                    onClick={() => groupOwner && navigate(`/admin/users/${groupOwner.id}`)}
                                                  >
                                                      <div className="flex items-center gap-3">
                                                          <img src={groupOwner?.avatar} className="w-8 h-8 rounded-full border border-gray-700" />
                                                          <div>
                                                              <span className="text-sm font-bold text-white block">{groupOwner?.name}</span>
                                                              <span className="text-xs text-emerald-500">(Owner)</span>
                                                          </div>
                                                      </div>
                                                  </div>

                                                  {/* Member Items */}
                                                  {memberIds.map(mid => {
                                                      const m = users.find(u => u.id === mid);
                                                      if (!m) return null;
                                                      return (
                                                          <div 
                                                            key={mid} 
                                                            className="flex items-center justify-between bg-dark-bg border border-gray-800 p-3 rounded-xl group hover:border-gray-700 transition-colors cursor-pointer"
                                                            onClick={() => navigate(`/admin/users/${m.id}`)}
                                                          >
                                                              <div className="flex items-center gap-3">
                                                                  <img src={m.avatar} className="w-8 h-8 rounded-full border border-gray-700" />
                                                                  <div>
                                                                      <span className="text-sm font-bold text-white block group-hover:text-indigo-400 transition-colors">{m.name}</span>
                                                                      <span className="text-xs text-gray-500">{m.email}</span>
                                                                  </div>
                                                              </div>
                                                              <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); removeMemberFromGroup(group.id, mid); }}
                                                                className="text-gray-600 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                                                                title="Remove Member"
                                                              >
                                                                  <X size={16} />
                                                              </button>
                                                          </div>
                                                      )
                                                  })}
                                              </div>
                                          </div>

                                          {/* Add Member Search */}
                                          <div className="pt-4 border-t border-gray-800/50">
                                              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Add Member</label>
                                              <div className="relative">
                                                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                                  <input 
                                                      type="text"
                                                      value={memberSearchTerm}
                                                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                                                      placeholder="Search user by name, email or ID to add..."
                                                      className="w-full bg-dark-bg border border-gray-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none placeholder:text-gray-600"
                                                  />
                                                  
                                                  {/* Search Results Dropdown */}
                                                  {memberSearchTerm && (
                                                      <div className="absolute bottom-full mb-2 left-0 right-0 bg-dark-card border border-gray-700 rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto custom-scrollbar">
                                                          {searchResults.length === 0 ? (
                                                              <p className="p-3 text-sm text-gray-500 text-center">No matching users found.</p>
                                                          ) : (
                                                              searchResults.map(u => (
                                                                  <button 
                                                                    key={u.id}
                                                                    onClick={() => addMemberToGroup(group.id, u.id)}
                                                                    className="w-full text-left px-4 py-3 hover:bg-indigo-600/10 flex items-center justify-between group border-b border-gray-800 last:border-0"
                                                                  >
                                                                      <div className="flex items-center gap-3">
                                                                          <img src={u.avatar} className="w-8 h-8 rounded-full" />
                                                                          <div>
                                                                              <p className="text-sm font-bold text-white">{u.name}</p>
                                                                              <p className="text-xs text-gray-400">{u.email}</p>
                                                                          </div>
                                                                      </div>
                                                                      <div className="flex items-center gap-1 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold uppercase">
                                                                          <Plus size={14} /> Add
                                                                      </div>
                                                                  </button>
                                                              ))
                                                          )}
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          )
                      })}
                  </div>
              </div>
          </div>
      )}

      {/* --- SECTION 2: USERS DIRECTORY --- */}
      {activeTab === 'users' && (
          <div className="border border-indigo-500/30 rounded-3xl p-6 relative">
              <div className="absolute top-0 left-6 -translate-y-1/2 bg-dark-bg px-2 text-white font-bold flex items-center gap-2">
                  <UserIcon size={16} className="text-indigo-400" /> Registered Users
              </div>
              <div className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-900/40 border border-indigo-500/30 px-3 py-1 rounded text-xs text-indigo-300 font-mono">
                  Total: {users.length}
              </div>

              <div className="grid gap-4 mt-2">
                  {users.map(user => {
                      const userAccounts = accounts.filter(a => a.userId === user.id && a.type === AccountType.PERSONAL);
                      
                      return (
                          <div 
                             key={user.id} 
                             className="bg-dark-card/50 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-gray-600 transition-all group"
                             onClick={() => navigate(`/admin/users/${user.id}`)}
                          >
                              <div className="flex items-center gap-5">
                                  <div className="relative">
                                     <div className="w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center bg-dark-bg">
                                          {/* Use empty placeholder if no avatar for strict similarity to screenshot, but keep avatar if exists */}
                                          <div className="w-10 h-10 rounded-full border border-gray-700 bg-transparent"></div>
                                     </div>
                                  </div>
                                  
                                  <div>
                                      <h4 className="font-bold text-white text-base">{user.name}</h4>
                                      <div className="flex items-center gap-2 text-sm text-gray-400">
                                          <Mail size={12} />
                                          {user.email}
                                      </div>
                                      <div className="text-[10px] text-gray-600 mt-1 font-mono">{user.id}</div>
                                  </div>
                              </div>

                              <div className="flex gap-3">
                                  {/* Role Badge */}
                                  <div className="flex flex-col border border-gray-800 rounded bg-dark-bg p-2 w-24">
                                      <span className="text-[9px] text-gray-500 font-bold uppercase mb-1">Role</span>
                                      <span className={`text-sm font-bold ${user.role === 'admin' ? 'text-blue-400' : 'text-white'}`}>
                                          {user.role}
                                      </span>
                                  </div>

                                  {/* Wallets Badge */}
                                  <div className="flex flex-col border border-gray-800 rounded bg-dark-bg p-2 w-32">
                                      <span className="text-[9px] text-gray-500 font-bold uppercase mb-1">Personal Wallets</span>
                                      <span className="text-sm font-bold text-white">
                                          {userAccounts.length}
                                      </span>
                                  </div>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}

      {/* --- SECTION 3: BROADCAST --- */}
      {activeTab === 'broadcast' && (
          <div className="max-w-2xl mx-auto">
              <div className="bg-dark-card border border-gray-800 rounded-3xl p-8 shadow-xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Megaphone size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white">System Broadcast</h3>
                        <p className="text-gray-400 mt-2">Send a notification to all registered users.</p>
                    </div>

                    <form onSubmit={handleBroadcast} className="space-y-5">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Subject / Title</label>
                            <input 
                                type="text" 
                                value={msgTitle}
                                onChange={(e) => setMsgTitle(e.target.value)}
                                placeholder="Important Update"
                                className="w-full bg-dark-bg border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Message Content</label>
                            <textarea 
                                value={msgContent}
                                onChange={(e) => setMsgContent(e.target.value)}
                                placeholder="We are performing maintenance tonight..."
                                className="w-full bg-dark-bg border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none h-32 resize-none"
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={msgLoading}
                            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
                        >
                            {msgLoading ? <Loader2 size={20} className="animate-spin" /> : <><Send size={18} /> Send Broadcast</>}
                        </button>
                    </form>
              </div>
          </div>
      )}

      {/* --- SECTION 4: CATEGORIES --- */}
      {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Add New */}
              <div className="bg-dark-card border border-gray-800 rounded-3xl p-6 h-fit">
                  <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                      <Plus size={18} className="text-indigo-500" />
                      Add New Category
                  </h3>
                  
                  <form onSubmit={handleAddCategory} className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Name</label>
                          <input 
                            type="text" 
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="e.g., Gym, Pets"
                            className="w-full bg-dark-bg border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none placeholder:text-gray-700"
                            required
                          />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Type</label>
                            <select 
                                value={newCatType}
                                onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                                className="w-full bg-dark-bg border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
                            >
                                <option value={TransactionType.EXPENSE}>Expense</option>
                                <option value={TransactionType.INCOME}>Income</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Color</label>
                            <div className="flex flex-wrap gap-2 bg-dark-bg p-2 rounded-xl border border-gray-800">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setNewCatColor(c)}
                                        className={`w-6 h-6 rounded-full transition-transform ${newCatColor === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Icon</label>
                          <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                              {AVAILABLE_ICONS.map(icon => (
                                  <button
                                      key={icon}
                                      type="button"
                                      onClick={() => setNewCatIcon(icon)}
                                      className={`p-2 rounded-xl flex items-center justify-center transition-all ${newCatIcon === icon ? 'bg-indigo-600 text-white' : 'bg-dark-bg text-gray-500 hover:bg-gray-800'}`}
                                  >
                                      {getIcon(icon)}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <button 
                        type="submit" 
                        disabled={catLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                          {catLoading ? <Loader2 size={20} className="animate-spin" /> : 'Create Category'}
                      </button>
                  </form>
              </div>

              {/* List Existing */}
              <div className="space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                      <Tag size={18} className="text-gray-500" />
                      Existing Categories
                  </h3>
                  <div className="space-y-2">
                      {categories.map(cat => (
                          <div key={cat.id} className="bg-dark-card border border-gray-800 p-3 rounded-2xl flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
                                      {getIcon(cat.icon)}
                                  </div>
                                  <div>
                                      <p className="font-medium text-white">{cat.name}</p>
                                      <p className="text-xs text-gray-500 uppercase">{cat.type}</p>
                                  </div>
                              </div>
                              <button 
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              >
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}