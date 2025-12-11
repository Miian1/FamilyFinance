import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../App';
import { ChevronLeft, Mail, Shield, Wallet, Calendar, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { User, Account, Transaction } from '../../types';

export default function UserDetails() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { users, accounts: allAccounts, transactions: allTransactions } = useApp();
  
  const user = users.find(u => u.id === userId);
  const userAccounts = allAccounts.filter(a => a.userId === userId);
  // Get transactions where user is creator
  const userTransactions = allTransactions.filter(t => t.createdBy === userId);

  if (!user) {
      return (
          <div className="p-8 text-center">
              <p className="text-gray-500">User not found.</p>
              <button onClick={() => navigate('/admin')} className="mt-4 text-indigo-400">Back to Admin</button>
          </div>
      )
  }

  const totalBalance = userAccounts.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <button 
        onClick={() => navigate('/admin')} 
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ChevronLeft size={20} /> Back to Directory
      </button>

      {/* Profile Header */}
      <div className="bg-dark-card border border-gray-800 rounded-3xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
              <Shield size={120} className="text-indigo-500" />
          </div>
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
              <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full border-4 border-dark-bg shadow-xl" />
              
              <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-bold text-white mb-2">{user.name}</h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-gray-400 text-sm">
                      <div className="flex items-center gap-1.5">
                          <Mail size={16} /> {user.email}
                      </div>
                      <div className="flex items-center gap-1.5">
                          <Shield size={16} /> <span className="capitalize">{user.role}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                          <Clock size={16} /> ID: <span className="font-mono text-xs bg-dark-bg px-2 py-0.5 rounded border border-gray-700">{user.id}</span>
                      </div>
                  </div>
              </div>

              <div className="bg-dark-bg border border-gray-700 rounded-2xl p-4 text-center min-w-[140px]">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Total Balance</p>
                  <p className="text-2xl font-mono font-bold text-white">${totalBalance.toLocaleString()}</p>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Wallets Section */}
          <div className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Wallet className="text-emerald-500" /> Wallets
              </h3>
              <div className="grid gap-3">
                  {userAccounts.length === 0 && <p className="text-gray-500 italic">No wallets found.</p>}
                  {userAccounts.map(acc => (
                      <div key={acc.id} className="bg-dark-card border border-gray-800 p-4 rounded-xl flex justify-between items-center">
                          <div>
                              <p className="font-bold text-white">{acc.name}</p>
                              <p className="text-xs text-gray-500 capitalize">{acc.type}</p>
                          </div>
                          <span className="font-mono font-bold text-gray-200">${acc.balance.toLocaleString()}</span>
                      </div>
                  ))}
              </div>
          </div>

          {/* Recent Activity Section */}
          <div className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="text-indigo-500" /> Recent Activity
              </h3>
              <div className="space-y-2">
                  {userTransactions.length === 0 && <p className="text-gray-500 italic">No recent transactions.</p>}
                  {userTransactions.slice(0, 5).map(tx => (
                      <div key={tx.id} className="bg-dark-card border border-gray-800 p-3 rounded-xl flex justify-between items-center text-sm">
                          <div>
                              <p className="text-gray-300">{tx.note || 'Transaction'}</p>
                              <p className="text-[10px] text-gray-500">{new Date(tx.date).toLocaleDateString()}</p>
                          </div>
                          <span className={`font-mono font-bold ${tx.type === 'income' ? 'text-emerald-500' : 'text-gray-400'}`}>
                              {tx.type === 'income' ? '+' : '-'}${tx.amount}
                          </span>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
}