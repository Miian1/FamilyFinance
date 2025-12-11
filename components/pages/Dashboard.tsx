import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../App';
import { ArrowUpRight, ArrowDownRight, Users, Wallet, ChevronDown, User, Shield, Bell, X, Check, ArrowRight, PiggyBank } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TransactionType, AccountType } from '../../types';
import { getIcon } from '../../constants';

// Formatting helpers
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function Dashboard() {
  const { transactions, accounts, categories, currentUser, notifications, markNotificationRead } = useApp();
  const [viewMode, setViewMode] = useState<'family' | 'personal'>('family');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  
  // Ref for click outside detection
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    
    if (showNotifications) {
        document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  // --- Identify Family Groups ---
  const myFamilyGroups = accounts.filter(a => 
    a.type === AccountType.SHARED && 
    (a.userId === currentUser?.id || a.members?.includes(currentUser?.id || ''))
  );

  // Force Personal view if no family groups
  useEffect(() => {
      if (myFamilyGroups.length === 0 && viewMode === 'family') {
          setViewMode('personal');
      }
  }, [myFamilyGroups.length, viewMode]);

  // --- Filtering based on View Mode ---
  let filteredAccounts = [];

  if (viewMode === 'personal') {
      filteredAccounts = accounts.filter(a => a.userId === currentUser?.id && a.type === AccountType.PERSONAL);
  } else {
      // Family View
      if (selectedGroupId === 'all') {
          filteredAccounts = myFamilyGroups;
      } else {
          filteredAccounts = myFamilyGroups.filter(g => g.id === selectedGroupId);
      }
  }

  // Filter transactions to only those belonging to the visible accounts
  const visibleAccountIds = filteredAccounts.map(a => a.id);
  const filteredTransactions = transactions.filter(t => visibleAccountIds.includes(t.accountId));

  // --- Calculations ---
  const totalFunds = filteredAccounts.reduce((acc, curr) => acc + curr.balance, 0);
  
  // Last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
  
  const recentTx = filteredTransactions.filter(t => new Date(t.date) > thirtyDaysAgo);
  const totalIncome = recentTx.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = recentTx.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);

  // Remaining Funds (Net Flow)
  const remainingFunds = totalIncome - totalExpense;

  // Chart Data Preparation
  const chartData = [
    { name: 'Week 1', val: totalIncome * 0.2 },
    { name: 'Week 2', val: totalIncome * 0.4 },
    { name: 'Week 3', val: totalIncome * 0.3 },
    { name: 'Week 4', val: totalIncome * 0.5 },
  ];

  // Category Breakdown Data
  const categorySpend = categories
    .filter(c => c.type === TransactionType.EXPENSE)
    .map(cat => {
      const amount = recentTx
        .filter(t => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      return { name: cat.name, value: amount, color: cat.color };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Recent Transactions List
  const recentHistory = filteredTransactions.slice(0, 5);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6 pb-20 md:pb-0 relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-gray-400">Welcome back, {currentUser?.name}.</p>
        </div>
        
        <div className="flex items-center gap-3">
            {/* Notification Bell - Hidden on mobile because it is in BottomNav */}
            <div className="relative hidden md:block" ref={notifRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2.5 bg-dark-card border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors relative"
                >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full"></span>
                    )}
                </button>

                {/* Notification Popover */}
                {showNotifications && (
                    <div className="absolute right-0 top-14 w-80 bg-dark-card border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-dark-bg/50">
                            <h4 className="font-bold text-white text-sm">Notifications</h4>
                            <button onClick={() => setShowNotifications(false)}><X size={16} className="text-gray-500" /></button>
                        </div>
                        <div className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">No notifications</div>
                            ) : (
                                notifications.slice(0, 5).map(n => (
                                    <div key={n.id} className={`p-4 border-b border-gray-800 hover:bg-dark-bg/50 transition-colors ${!n.isRead ? 'bg-indigo-500/5' : ''}`}>
                                        <div className="flex justify-between items-start gap-2">
                                            <p className={`text-sm ${!n.isRead ? 'text-white font-medium' : 'text-gray-400'}`}>{n.message}</p>
                                            {!n.isRead && (
                                                <button onClick={() => markNotificationRead(n.id)} className="text-indigo-500 hover:text-indigo-400" title="Mark read">
                                                    <Check size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-600 mt-1 block">{new Date(n.createdAt).toLocaleDateString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-2 bg-dark-bg/50 border-t border-gray-800">
                             <button 
                               onClick={() => navigate('/notifications')}
                               className="w-full py-2 text-sm text-indigo-400 font-medium hover:text-indigo-300 flex items-center justify-center gap-1"
                             >
                                 See all notifications <ArrowRight size={14} />
                             </button>
                        </div>
                    </div>
                )}
            </div>

            {/* View Toggle & Group Selector */}
            <div className="flex items-center gap-2">
                {viewMode === 'family' && myFamilyGroups.length > 0 && (
                    <div className="relative">
                        <select
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                            className="appearance-none bg-dark-card border border-gray-800 text-white text-xs font-medium rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer hover:bg-gray-800 transition-colors"
                        >
                            <option value="all">All Groups ({myFamilyGroups.length})</option>
                            {myFamilyGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                )}

                {myFamilyGroups.length > 0 && (
                    <div className="bg-dark-card border border-gray-800 p-1 rounded-xl flex items-center">
                        <button 
                          onClick={() => setViewMode('family')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'family' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Users size={14} />
                            Family
                        </button>
                        <button 
                          onClick={() => setViewMode('personal')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'personal' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            <User size={14} />
                            Personal
                        </button>
                    </div>
                )}
            </div>

            <Link 
              to="/add" 
              className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-600/20"
            >
              <div className="bg-white/20 p-1 rounded-md">
                <ArrowUpRight size={16} />
              </div>
              Add Transaction
            </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={viewMode === 'personal' ? "My Balance" : "Total Family Funds"}
          amount={totalFunds} 
          trend="+2.1%" 
          trendUp={true} 
          icon={Wallet} 
          color={viewMode === 'personal' ? "bg-purple-500/10 text-purple-500" : "bg-emerald-500/10 text-emerald-500"}
        />
        <StatCard 
          title="Income" 
          amount={totalIncome} 
          trend="+10.3%" 
          trendUp={true} 
          icon={ArrowUpRight} 
          color="bg-indigo-500/10 text-indigo-500"
        />
        <StatCard 
          title="Expenses" 
          amount={totalExpense} 
          trend="-5.8%" 
          trendUp={false} 
          isExpense={true}
          icon={ArrowDownRight} 
          color="bg-rose-500/10 text-rose-500"
        />
        {/* Remaining Funds (Net Savings) */}
        <StatCard 
          title="Remaining Funds" 
          amount={remainingFunds} 
          trend={remainingFunds >= 0 ? "Savings" : "Deficit"}
          trendUp={remainingFunds >= 0}
          icon={PiggyBank} 
          color={remainingFunds >= 0 ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"}
          subLabel="Income - Expense"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-dark-card border border-gray-800 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg">{viewMode === 'personal' ? 'My Activity' : 'Income vs Expense'}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
               <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
               Trend
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="val" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVal)" 
                />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Chart */}
        <div className="bg-dark-card border border-gray-800 rounded-3xl p-6 flex flex-col">
          <h3 className="font-semibold text-lg mb-4">Spending Breakdown</h3>
          <div className="flex-1 flex items-center justify-center relative">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-gray-400 text-sm">Total</span>
              <span className="text-2xl font-bold text-white">{formatCurrency(totalExpense)}</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categorySpend}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categorySpend.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {categorySpend.slice(0, 4).map((cat) => (
              <div key={cat.name} className="flex items-center gap-2 text-sm text-gray-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></span>
                {cat.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-dark-card border border-gray-800 rounded-3xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-lg">Recent Transactions</h3>
          <Link to="/transactions" className="text-indigo-400 text-sm hover:text-indigo-300">See All</Link>
        </div>
        <div className="space-y-4">
          {recentHistory.map((tx) => {
             const category = categories.find(c => c.id === tx.categoryId);
             const user = useApp().users.find(u => u.id === tx.createdBy);
             const isIncome = tx.type === TransactionType.INCOME;
             
             return (
               <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-dark-bg/50 rounded-2xl transition-colors">
                  <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                    <div className={`w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-2xl flex items-center justify-center bg-dark-bg border border-gray-800 text-gray-300`}>
                      {getIcon(category?.icon)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-white truncate text-sm md:text-base">{category?.name || 'Unknown'}</h4>
                      <p className="text-xs md:text-sm text-gray-500 truncate">
                        {user?.name.split(' ')[0]} • {new Date(tx.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm md:text-base whitespace-nowrap ml-2 ${isIncome ? 'text-emerald-500' : 'text-gray-200'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
               </div>
             )
          })}
          {recentHistory.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent transactions found.</p>
          )}
        </div>
      </div>

    </div>
  );
}

function StatCard({ title, amount, value, trend, trendUp, isExpense, icon: Icon, color, subLabel }: any) {
  return (
    <div className="bg-dark-card border border-gray-800 p-5 rounded-3xl hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        {trend && (
           <span className={`text-xs px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
             {trend}
           </span>
        )}
      </div>
      <p className="text-gray-400 text-sm font-medium">{title}</p>
      <h4 className="text-2xl font-bold text-white mt-1">
        {amount !== undefined ? formatCurrency(amount) : value}
      </h4>
      {subLabel && <p className="text-xs text-gray-500 mt-1">{subLabel}</p>}
    </div>
  );
}