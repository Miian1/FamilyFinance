import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate, Link } from 'react-router-dom';
import { LayoutDashboard, CreditCard, ArrowLeftRight, Settings, Plus, User as UserIcon, LogOut, Loader2, ShieldCheck, Bell, MessageSquare } from 'lucide-react';
import { User, Account, Transaction, Category, TransactionType, Role, Notification, AccountType } from './types';
import { supabase } from './supabaseClient';
import Dashboard from './components/pages/Dashboard';
import Accounts from './components/pages/Accounts';
import Transactions from './components/pages/Transactions';
import AddTransaction from './components/pages/AddTransaction';
import Login from './components/pages/Login';
import Signup from './components/pages/Signup';
import Profile from './components/pages/Profile';
import AdminPanel from './components/pages/AdminPanel';
import UserDetails from './components/pages/UserDetails';
import NotificationsPage from './components/pages/NotificationsPage';
import ChatPage from './components/pages/ChatPage';

// --- Global Context ---
interface AppContextType {
  currentUser: User | null;
  users: User[];
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  notifications: Notification[];
  loading: boolean;
  refreshData: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  respondToRequest: (id: string, action: 'accepted' | 'rejected') => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

// --- Main App Component ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Get Session for user ID usage
      const { data: { session } } = await supabase.auth.getSession();
      
      // 2. Define all promises for parallel execution
      // Optimization: Limit transactions to recent 500 to improve initial load speed
      const profilesPromise = supabase.from('profiles').select('*');
      const personalPromise = supabase.from('accounts').select('*');
      const groupPromise = supabase.from('group_accounts').select('*');
      const categoriesPromise = supabase.from('categories').select('*');
      const transactionsPromise = supabase.from('transactions').select('*').order('date', { ascending: false }).limit(500);
      
      const notificationsPromise = session 
        ? supabase.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] });

      // 3. Await all in parallel
      const [
        { data: profilesData },
        { data: personalData },
        { data: groupData },
        { data: categoriesData },
        { data: transactionsData },
        { data: notifData }
      ] = await Promise.all([
        profilesPromise,
        personalPromise,
        groupPromise,
        categoriesPromise,
        transactionsPromise,
        notificationsPromise
      ]);

      // 4. Process Results
      if (profilesData) {
        setUsers(profilesData.map(p => ({
          id: p.id,
          name: p.name || 'Unknown User',
          email: p.email || '',
          role: p.role || Role.MEMBER,
          avatar: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || 'User')}&background=random`
        })));
      }

      let mergedAccounts: Account[] = [];

      if (personalData) {
        mergedAccounts = [...mergedAccounts, ...personalData.map(a => ({
          id: a.id,
          userId: a.user_id,
          name: a.name,
          balance: a.balance,
          type: AccountType.PERSONAL,
          currency: a.currency,
          color: a.color,
          isSuspended: a.is_suspended ?? false,
          members: []
        }))];
      }

      if (groupData) {
        mergedAccounts = [...mergedAccounts, ...groupData.map(a => ({
          id: a.id,
          userId: a.user_id,
          name: a.name,
          balance: a.balance,
          type: AccountType.SHARED,
          currency: a.currency,
          color: a.color,
          isSuspended: a.is_suspended ?? false,
          members: a.members || []
        }))];
      }

      setAccounts(mergedAccounts);

      if (categoriesData) {
        setCategories(categoriesData);
      }

      if (transactionsData) {
        setTransactions(transactionsData.map(t => ({
          id: t.id,
          accountId: t.account_id,
          amount: t.amount,
          type: t.type,
          categoryId: t.category_id,
          date: t.date,
          note: t.note,
          createdBy: t.created_by
        })));
      }

      if (notifData) {
          setNotifications(notifData.map(n => ({
              id: n.id,
              userId: n.user_id,
              title: n.title,
              message: n.message,
              type: n.type,
              status: n.status || 'pending',
              isRead: n.is_read,
              createdAt: n.created_at,
              data: n.data
          })));
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const initSession = async () => {
      setLoading(true);
      
      // Safety timeout: Ensure loading spinner disappears quickly (4s max)
      const timeoutId = setTimeout(() => {
        if (isMounted && loading) {
            console.warn("Session init taking too long, showing UI.");
            setLoading(false);
        }
      }, 4000);

      try {
          // 1. Critical Path: Auth & Profile Only
          // This must happen before showing the app shell
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          
          if (session && isMounted) {
             const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
             
             if (profileError && profileError.code !== 'PGRST116') {
                 console.error("Error fetching profile:", profileError);
             }

             if (profile && isMounted) {
               const userName = profile.name || 'User';
               setCurrentUser({
                 id: profile.id,
                 name: userName,
                 email: profile.email || session.user.email,
                 role: profile.role || 'member',
                 avatar: profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`
               });
             }
          }
      } catch (err) {
          console.error("Initialization error:", err);
          if (isMounted) setCurrentUser(null);
      } finally {
          clearTimeout(timeoutId);
          // 2. Unblock UI immediately after knowing who the user is
          if (isMounted) {
              setLoading(false);
          }
      }

      // 3. Background Fetch: Load heavy data after UI is visible
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isMounted) {
          await fetchData();
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
       if (event === 'SIGNED_OUT') {
           if (isMounted) {
               setCurrentUser(null);
               setAccounts([]);
               setTransactions([]);
               setNotifications([]);
           }
       } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
           if (session && isMounted) {
               const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
               if (profile && isMounted) {
                   setCurrentUser({
                       id: profile.id,
                       name: profile.name,
                       email: profile.email,
                       role: profile.role,
                       avatar: profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random`
                   });
                   // Fetch data in background
                   fetchData();
               }
           }
       }
    });

    return () => { 
        isMounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const markNotificationRead = async (id: string) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (!error) {
          setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
  };

  const respondToRequest = async (id: string, action: 'accepted' | 'rejected') => {
      const notif = notifications.find(n => n.id === id);
      const { error } = await supabase.from('notifications').update({ 
          status: action,
          is_read: true 
      }).eq('id', id);

      if (!error && action === 'accepted' && notif?.data?.accountId && currentUser) {
          try {
             const accountId = notif.data.accountId;
             const { data: group } = await supabase.from('group_accounts').select('members').eq('id', accountId).single();
             if (group) {
                 const currentMembers = group.members || [];
                 if (!currentMembers.includes(currentUser.id)) {
                     const updatedMembers = [...currentMembers, currentUser.id];
                     await supabase.from('group_accounts').update({ members: updatedMembers }).eq('id', accountId);
                 }
             }
          } catch (e) {
              console.error("Failed to add member to group automatically", e);
          }
      }

      if (!error) {
          await fetchData();
      }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center text-indigo-500">
        <Loader2 size={40} className="animate-spin" />
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ 
      currentUser, 
      users, 
      accounts, 
      transactions, 
      categories,
      notifications,
      loading,
      refreshData: fetchData,
      markNotificationRead,
      respondToRequest,
      logout
    }}>
      <HashRouter>
        <div className="min-h-screen bg-dark-bg text-gray-100 font-sans selection:bg-indigo-500/30">
          <MainLayout />
        </div>
      </HashRouter>
    </AppContext.Provider>
  );
}

// --- Layout & Navigation ---
function MainLayout() {
  const { currentUser } = useApp();
  const location = useLocation();
  const pathname = location.pathname;

  // If not logged in, show Auth screens
  if (!currentUser) {
    return (
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const isHomePage = pathname === '/';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative pb-24 md:pb-0">
         {/* Mobile Header */}
         <div className="md:hidden flex items-center justify-between p-4 bg-dark-bg/80 backdrop-blur sticky top-0 z-20 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <LayoutDashboard size={18} className="text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">FamilyFinance</span>
            </div>
            <Link to="/profile">
               <img src={currentUser.avatar} alt="User" className="w-8 h-8 rounded-full border border-gray-700" />
            </Link>
         </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto h-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/add" element={<AddTransaction />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            {currentUser.role === Role.ADMIN && (
              <>
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/admin/users/:userId" element={<UserDetails />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Floating Action Button - Mobile */}
      {isHomePage && (
        <Link 
            to="/add" 
            className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 z-30"
        >
            <Plus size={24} className="text-white" />
        </Link>
      )}

      {/* Bottom Nav - Mobile */}
      <BottomNav />
    </div>
  );
}

function Sidebar() {
  const { pathname } = useLocation();
  const { logout, currentUser, notifications } = useApp();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: CreditCard, label: 'Accounts', path: '/accounts' },
    { icon: ArrowLeftRight, label: 'Transactions', path: '/transactions' },
    { icon: MessageSquare, label: 'Chats', path: '/chat' },
    { icon: Bell, label: 'Notifications', path: '/notifications', badge: unreadCount },
  ];

  const getLinkClass = (path: string) => {
    const isActive = pathname === path;
    return `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
      isActive 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
        : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
    }`;
  };

  return (
    <aside className="hidden md:flex w-64 flex-col bg-dark-card border-r border-gray-800 h-full p-6">
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <LayoutDashboard size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          FamilyFinance
        </h1>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} className={getLinkClass(item.path)}>
            <div className="relative">
              <item.icon size={20} className={pathname === item.path ? 'animate-pulse-slow' : ''} />
              {item.badge ? (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
        {currentUser?.role === Role.ADMIN && (
          <Link to="/admin" className={getLinkClass('/admin')}>
            <ShieldCheck size={20} className={pathname === '/admin' ? 'animate-pulse-slow' : ''} />
            <span className="font-medium">Admin Panel</span>
          </Link>
        )}
      </nav>

      {/* Mini Profile in Sidebar */}
      <Link to="/profile" className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-dark-bg/50 border border-gray-800 hover:border-gray-700 transition-colors">
        <img src={currentUser?.avatar} alt="" className="w-9 h-9 rounded-full" />
        <div className="flex-1 overflow-hidden">
           <p className="text-sm font-semibold truncate text-white">{currentUser?.name}</p>
           <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
        </div>
      </Link>

      <div className="pt-2 border-t border-gray-800 space-y-2">
        <Link to="/profile" className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-dark-lighter transition-colors">
            <UserIcon size={20} />
            <span className="font-medium">Profile</span>
        </Link>
        <button 
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-900/10 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
function BottomNav() {
  const { pathname } = useLocation();
  const { currentUser, notifications } = useApp();
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  const navItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/' },
    { icon: CreditCard, label: 'Accounts', path: '/accounts' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: Bell, label: 'Inbox', path: '/notifications', badge: unreadCount },
    { icon: UserIcon, label: 'Profile', path: '/profile' }, 
  ];

  if (currentUser?.role === Role.ADMIN) {
      navItems.splice(4, 0, { icon: ShieldCheck, label: 'Admin', path: '/admin', badge: 0 });
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-card/90 backdrop-blur-lg border-t border-gray-800 pb-safe z-40">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link key={item.label} to={item.path} className="flex flex-col items-center justify-center w-full h-full relative">
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'text-indigo-500' : 'text-gray-500'}`}>
                <item.icon size={24} />
                {item.badge ? (
                   <span className="absolute top-2 right-6 w-3 h-3 bg-rose-500 rounded-full border-2 border-dark-card"></span>
                ) : null}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-indigo-500' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}