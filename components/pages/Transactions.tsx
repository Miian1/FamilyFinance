import React, { useState } from 'react';
import { useApp } from '../../App';
import { Search, Filter, Download, Calendar } from 'lucide-react';
import { getIcon } from '../../constants';
import { TransactionType } from '../../types';

export default function Transactions() {
  const { transactions, categories, users } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');

  const filtered = transactions.filter(tx => {
    const matchesSearch = tx.note.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Transactions</h2>
        
        <div className="flex gap-2">
           <button className="flex items-center gap-2 bg-dark-card border border-gray-800 text-gray-300 px-4 py-2 rounded-xl text-sm hover:text-white transition-colors">
              <Download size={16} />
              Export
           </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-card border border-gray-800 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-600"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border ${filterType === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-dark-card border-gray-800 text-gray-400'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilterType(TransactionType.EXPENSE)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border ${filterType === TransactionType.EXPENSE ? 'bg-rose-600 border-rose-600 text-white' : 'bg-dark-card border-gray-800 text-gray-400'}`}
          >
            Expenses
          </button>
          <button 
             onClick={() => setFilterType(TransactionType.INCOME)}
             className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border ${filterType === TransactionType.INCOME ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-dark-card border-gray-800 text-gray-400'}`}
          >
            Income
          </button>
          <button className="px-4 py-2 rounded-xl bg-dark-card border border-gray-800 text-gray-400 flex items-center gap-2 hover:bg-gray-800 whitespace-nowrap">
            <Calendar size={16} />
            <span className="text-sm">Date</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No transactions found.</div>
        ) : (
          filtered.map((tx) => {
            const category = categories.find(c => c.id === tx.categoryId);
            const user = users.find(u => u.id === tx.createdBy);
            const isIncome = tx.type === TransactionType.INCOME;

            return (
              <div key={tx.id} className="bg-dark-card border border-gray-800 p-4 rounded-2xl flex items-center justify-between group hover:border-gray-700 transition-all">
                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                  <div className={`w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-800 text-indigo-400'}`}>
                    {getIcon(category?.icon)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-white truncate text-sm md:text-base">{tx.note || category?.name}</h4>
                    <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-gray-500 mt-0.5 truncate">
                      <span className="truncate">{category?.name}</span>
                      <span>•</span>
                      <span className="truncate">{user?.name.split(' ')[0]}</span>
                      <span className="hidden xs:inline">•</span>
                      <span className="hidden xs:inline">{new Date(tx.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className={`font-bold text-sm md:text-lg whitespace-nowrap ${isIncome ? 'text-emerald-500' : 'text-gray-200'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}