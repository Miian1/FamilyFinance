import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../App';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Calendar, FileText, Loader2, User, Users, AlertTriangle, ChevronRight, ArrowRight, Search } from 'lucide-react';
import { TransactionType, AccountType, Role } from '../../types';
import { supabase } from '../../supabaseClient';

export default function AddTransaction() {
  const navigate = useNavigate();
  const { accounts, categories, currentUser, users, refreshData } = useApp();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [scope, setScope] = useState<'personal' | 'family'>('personal');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter accounts based on selected scope
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
        if (scope === 'personal') {
            // Personal: Must belong to user AND be Type Personal
            return acc.type === AccountType.PERSONAL && acc.userId === currentUser?.id;
        } else {
            // Family: Must be Shared type
            return acc.type === AccountType.SHARED;
        }
    });
  }, [accounts, scope, currentUser]);

  // Auto-select first account when filtered list changes
  useEffect(() => {
    if (filteredAccounts.length > 0) {
        const isValid = filteredAccounts.find(a => a.id === selectedAccount);
        if (!isValid) {
            setSelectedAccount(filteredAccounts[0].id);
        }
    } else {
        setSelectedAccount('');
    }
  }, [filteredAccounts, selectedAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !selectedAccount || !currentUser) return;

    setErrorMsg('');
    const account = accounts.find(a => a.id === selectedAccount);
    
    // Check suspension
    if (account?.isSuspended) {
        setErrorMsg("This account is suspended. Transactions cannot be added.");
        return;
    }

    setSubmitting(true);
    const numericAmount = parseFloat(amount);
    const categoryId = selectedCategory || categories.find(c => c.type === type)?.id;

    try {
      if (type === TransactionType.TRANSFER) {
          // --- TRANSFER LOGIC ---
          if (!recipientId) {
             throw new Error("Please enter a recipient User ID or Group ID.");
          }

          // 1. Find Target
          let targetAccount = null;
          let targetTable = '';

          // Check Group Accounts (Family Funds)
          const { data: groupGroup } = await supabase.from('group_accounts').select('*').eq('id', recipientId).single();
          if (groupGroup) {
              targetAccount = groupGroup;
              targetTable = 'group_accounts';
          } else {
               // Check Users -> Personal Account
               const { data: profile } = await supabase.from('profiles').select('*').eq('id', recipientId).single();
               if (profile) {
                   const { data: userAcc } = await supabase.from('accounts').select('*').eq('user_id', profile.id).limit(1).single();
                   if (userAcc) {
                       targetAccount = userAcc;
                       targetTable = 'accounts';
                   }
               }
               // Fallback: Check if ID is a direct Account ID
               if (!targetAccount) {
                   const { data: rawAcc } = await supabase.from('accounts').select('*').eq('id', recipientId).single();
                   if (rawAcc) {
                       targetAccount = rawAcc;
                       targetTable = 'accounts';
                   }
               }
          }

          if (!targetAccount) throw new Error("Recipient ID invalid. User or Group not found.");
          if (targetAccount.id === selectedAccount) throw new Error("Cannot transfer to the same account.");

          // 2. Create Outgoing Transaction (Source)
          const { error: txError1 } = await supabase.from('transactions').insert([{
            account_id: selectedAccount,
            amount: numericAmount, 
            type: TransactionType.TRANSFER, 
            category_id: categoryId,
            date: new Date().toISOString(),
            note: note ? `Transfer to ${targetAccount.name}: ${note}` : `Transfer to ${targetAccount.name}`,
            created_by: currentUser.id
          }]);
          if (txError1) throw txError1;

          // 3. Create Incoming Transaction (Target)
          const { error: txError2 } = await supabase.from('transactions').insert([{
            account_id: targetAccount.id,
            amount: numericAmount,
            type: TransactionType.TRANSFER,
            category_id: categoryId,
            date: new Date().toISOString(),
            note: note ? `Transfer from ${account.name}: ${note}` : `Transfer from ${account.name}`,
            created_by: currentUser.id
          }]);
          if (txError2) throw txError2;

          // 4. Update Source Balance (-)
          const sourceTable = account.type === AccountType.SHARED ? 'group_accounts' : 'accounts';
          await supabase.from(sourceTable).update({ 
              balance: account.balance - numericAmount 
          }).eq('id', selectedAccount);

          // 5. Update Target Balance (+)
          await supabase.from(targetTable).update({ 
              balance: (targetAccount.balance || 0) + numericAmount 
          }).eq('id', targetAccount.id);

          // 6. Notify
          if (targetAccount.user_id && targetAccount.user_id !== currentUser.id) {
               await supabase.from('notifications').insert([{
                  user_id: targetAccount.user_id,
                  title: "Funds Received",
                  message: `${currentUser.name} transferred $${amount} to ${targetAccount.name}`,
                  type: 'transaction',
                  data: { amount: numericAmount }
              }]);
          }

      } else {
          // --- INCOME / EXPENSE LOGIC ---
          // 1. Insert Transaction
          const { error: txError } = await supabase.from('transactions').insert([
            {
              account_id: selectedAccount,
              amount: numericAmount,
              type,
              category_id: categoryId,
              date: new Date().toISOString(),
              note: note || (type === TransactionType.INCOME ? 'Income' : 'Expense'),
              created_by: currentUser.id
            }
          ]);

          if (txError) throw txError;

          // 2. Update Account Balance
          if (account) {
            const modifier = type === TransactionType.INCOME ? 1 : -1;
            const newBalance = account.balance + (numericAmount * modifier);
            
            const table = account.type === AccountType.SHARED ? 'group_accounts' : 'accounts';
            await supabase.from(table).update({ balance: newBalance }).eq('id', selectedAccount);
          }

          // 3. Create Notification if Shared Account
          if (account?.type === AccountType.SHARED) {
              let targetUserId = account.userId;
              if (targetUserId === currentUser.id) {
                  const otherUser = users.find(u => u.id !== currentUser.id);
                  if (otherUser) targetUserId = otherUser.id;
              }

              if (targetUserId && targetUserId !== currentUser.id) {
                  const categoryName = categories.find(c => c.id === categoryId)?.name || 'General';
                  await supabase.from('notifications').insert([{
                      user_id: targetUserId,
                      title: "New Family Transaction",
                      message: `${currentUser.name} added ${type} of $${amount} to ${account.name} (${categoryName})`,
                      type: 'transaction',
                      data: { accountId: account.id, amount: numericAmount }
                  }]);
              }
          }
      }

      await refreshData();
      navigate('/');
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      setErrorMsg(error.message || "Failed to save transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  if (accounts.length === 0) {
      return (
          <div className="text-center mt-10">
              <p className="text-gray-400 mb-4">You need an account wallet before adding transactions.</p>
              <button onClick={() => navigate('/accounts')} className="bg-indigo-600 px-4 py-2 rounded-xl">Create Wallet</button>
          </div>
      )
  }

  return (
    <div className="max-w-xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 bg-dark-card border border-gray-800 rounded-xl hover:text-white text-gray-400 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-white">New Transaction</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-24 flex-1 overflow-y-auto no-scrollbar">
        
        {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 p-4 rounded-2xl flex items-center gap-2">
                <AlertTriangle size={20} />
                <span className="text-sm font-medium">{errorMsg}</span>
            </div>
        )}

        {/* Amount Input */}
        <div className="bg-dark-card border border-gray-800 rounded-3xl p-10 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <label className="text-sm text-gray-500 font-medium mb-2 relative z-10">Enter Amount</label>
          <div className="flex items-center justify-center gap-1 relative z-10 w-full">
            <span className="text-4xl font-bold text-gray-600 mr-2">$</span>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="bg-transparent text-6xl font-bold text-white text-center w-full focus:outline-none placeholder:text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
              step="0.01"
            />
          </div>
        </div>

        {/* Type Selector */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-dark-card border border-gray-800 rounded-2xl">
          {[TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER].map((t) => (
             <button
               key={t}
               type="button"
               onClick={() => setType(t)}
               className={`py-3 rounded-xl text-sm font-semibold capitalize transition-all ${
                 type === t 
                 ? 'bg-indigo-600 text-white shadow-lg' 
                 : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
               }`}
             >
               {t}
             </button>
          ))}
        </div>

        {/* Source Fund Context */}
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Source Fund</label>
            <div className="bg-dark-card p-1.5 rounded-2xl border border-gray-800 flex gap-2">
                <button
                    type="button"
                    onClick={() => setScope('personal')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                        scope === 'personal' 
                        ? 'bg-indigo-600 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <User size={18} />
                    Personal
                </button>
                <button
                    type="button"
                    onClick={() => setScope('family')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                        scope === 'family' 
                        ? 'bg-indigo-600 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Users size={18} />
                    Family Fund
                </button>
            </div>
        </div>

        {/* Wallet Select (Source) */}
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Wallet (From)</label>
            <div className="relative group">
                <div className="w-full bg-dark-card border border-gray-800 rounded-2xl px-5 py-4 text-white flex items-center justify-between group-hover:border-gray-600 transition-colors">
                    {filteredAccounts.length > 0 ? (
                        (() => {
                            const acc = filteredAccounts.find(a => a.id === selectedAccount);
                            return (
                                <div className="flex flex-col">
                                    <span className="font-bold text-base">{acc?.name}</span>
                                    <span className="text-xs text-gray-500 font-mono">Current: ${acc?.balance.toLocaleString()}</span>
                                </div>
                            );
                        })()
                    ) : (
                        <span className="text-gray-500 italic">No wallets available</span>
                    )}
                    <ChevronRight size={20} className="text-gray-500" />
                </div>
                
                <select 
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={filteredAccounts.length === 0}
                >
                    {filteredAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                            {acc.name} (${acc.balance}) {acc.isSuspended ? '[SUSPENDED]' : ''}
                        </option>
                    ))}
                </select>
            </div>
            {filteredAccounts.length === 0 && (
                 <p className="text-xs text-rose-400 mt-2 px-1">
                     No {scope} accounts available.
                 </p>
            )}
        </div>

        {/* Recipient Input for Transfer */}
        {type === TransactionType.TRANSFER && (
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Transfer To</label>
                <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500">
                        <ArrowRight size={18} />
                    </div>
                    <input
                        type="text"
                        value={recipientId}
                        onChange={(e) => setRecipientId(e.target.value)}
                        placeholder="Enter User ID or Group ID"
                        className="w-full bg-dark-card border border-gray-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-indigo-500 focus:outline-none placeholder:text-gray-600"
                    />
                </div>
                <div className="flex items-center gap-1.5 mt-2 px-1 text-[10px] text-gray-500">
                    <Search size={10} />
                    <span>Paste the ID of the user or family fund you want to send money to.</span>
                </div>
            </div>
        )}

        {/* Category Select */}
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Category</label>
            <div className="grid grid-cols-2 gap-3">
              {categories.filter(c => type === TransactionType.TRANSFER ? true : c.type === type).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-left px-5 py-4 rounded-2xl border text-sm font-bold transition-all flex justify-between items-center ${
                    selectedCategory === cat.id 
                    ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                    : 'border-gray-800 bg-dark-card text-gray-400 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  {cat.name}
                  {selectedCategory === cat.id && <Check size={16} className="text-indigo-500" />}
                </button>
              ))}
            </div>
        </div>

        {/* Note & Date (Collapsible or just below) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
             <div className="relative">
                <FileText size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Add a note (Optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-dark-card border border-gray-800 rounded-2xl py-4 pl-11 pr-4 text-white focus:border-indigo-500 focus:outline-none placeholder:text-gray-600"
                />
             </div>
             <div className="relative">
                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="date" 
                  disabled
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full bg-dark-card border border-gray-800 rounded-2xl py-4 pl-11 pr-4 text-gray-500 cursor-not-allowed opacity-50"
                />
             </div>
        </div>

        <button 
          type="submit"
          disabled={submitting || filteredAccounts.length === 0}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-8"
        >
           {submitting ? <Loader2 size={20} className="animate-spin" /> : <><Check size={20} /> Save Transaction</>}
        </button>

      </form>
    </div>
  );
}