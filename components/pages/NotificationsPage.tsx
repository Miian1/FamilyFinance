import React, { useState } from 'react';
import { useApp } from '../../App';
import { Bell, Check, Trash2, UserPlus, Info, AlertTriangle, ArrowLeftRight, ShieldAlert, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function NotificationsPage() {
  const { notifications, markNotificationRead, respondToRequest, refreshData, currentUser } = useApp();
  const [filter, setFilter] = useState<'all' | 'unread' | 'requests' | 'alerts'>('all');

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'requests') return n.type === 'invite';
    if (filter === 'alerts') return n.type === 'alert' || n.type === 'admin';
    return true;
  });

  const clearAll = async () => {
      if(!confirm("Clear all notifications?")) return;
      if (!currentUser) return;
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', currentUser.id);

      if (!error) refreshData();
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'invite': return <UserPlus size={20} className="text-indigo-400" />;
          case 'alert': return <AlertTriangle size={20} className="text-rose-400" />;
          case 'admin': return <ShieldAlert size={20} className="text-amber-400" />;
          case 'transaction': return <ArrowLeftRight size={20} className="text-emerald-400" />;
          default: return <Info size={20} className="text-blue-400" />;
      }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Bell className="text-indigo-500" /> Notifications
            </h2>
            <p className="text-gray-400 text-sm mt-1">Manage your alerts and requests</p>
        </div>
        <button 
            onClick={clearAll} 
            className="text-gray-500 hover:text-rose-500 text-sm flex items-center gap-1 transition-colors"
        >
            <Trash2 size={16} /> Clear All
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['all', 'unread', 'requests', 'alerts'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize whitespace-nowrap transition-colors border ${
                    filter === f 
                    ? 'bg-indigo-600 border-indigo-600 text-white' 
                    : 'bg-dark-card border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                  {f}
              </button>
          ))}
      </div>

      <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-dark-card/50 rounded-3xl border border-gray-800 border-dashed">
                  <Bell size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No notifications found</p>
              </div>
          ) : (
              filteredNotifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`relative p-5 rounded-2xl border transition-all ${
                        !n.isRead 
                        ? 'bg-dark-card border-indigo-500/30 shadow-[0_0_15px_-3px_rgba(99,102,241,0.1)]' 
                        : 'bg-dark-card border-gray-800 opacity-80 hover:opacity-100'
                    }`}
                  >
                      <div className="flex gap-4">
                          <div className={`mt-1 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-dark-bg border border-gray-800`}>
                              {getIcon(n.type)}
                          </div>
                          
                          <div className="flex-1">
                              <div className="flex justify-between items-start">
                                  <h4 className="font-bold text-white text-sm md:text-base">{n.title}</h4>
                                  <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                                      {new Date(n.createdAt).toLocaleDateString()}
                                  </span>
                              </div>
                              <p className="text-gray-400 text-sm mt-1 leading-relaxed">{n.message}</p>

                              {/* Action Buttons for Requests */}
                              {n.type === 'invite' && n.status === 'pending' && (
                                  <div className="flex gap-3 mt-4">
                                      <button 
                                        onClick={() => respondToRequest(n.id, 'accepted')}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                      >
                                          <Check size={16} /> Accept
                                      </button>
                                      <button 
                                        onClick={() => respondToRequest(n.id, 'rejected')}
                                        className="flex-1 bg-dark-bg border border-gray-700 hover:bg-gray-800 text-gray-300 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                      >
                                          <X size={16} /> Reject
                                      </button>
                                  </div>
                              )}
                              
                              {/* Status Badges */}
                              {n.type === 'invite' && n.status !== 'pending' && (
                                  <div className={`mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                      n.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                  }`}>
                                      {n.status === 'accepted' ? <Check size={12} /> : <X size={12} />}
                                      {n.status}
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Mark Read Dot */}
                      {!n.isRead && (
                          <button 
                            onClick={() => markNotificationRead(n.id)}
                            className="absolute top-5 right-5 w-2 h-2 bg-indigo-500 rounded-full hover:scale-150 transition-transform"
                            title="Mark as read"
                          ></button>
                      )}
                  </div>
              ))
          )}
      </div>
    </div>
  );
}