import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../App';
import { supabase } from '../../supabaseClient';
import { Search, UserPlus, Send, ArrowLeft, MessageSquare, Check, X, Bell, User } from 'lucide-react';
import { Friendship, Message, User as UserType } from '../../types';

export default function ChatPage() {
  const { currentUser, users } = useApp();
  const [activeTab, setActiveTab] = useState<'chats' | 'search'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<UserType[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<UserType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Initial Fetch ---
  useEffect(() => {
    if (currentUser) {
        fetchFriendsAndRequests();
    }
  }, [currentUser]);

  // --- Fetch Messages when active user changes ---
  useEffect(() => {
      if (currentUser && activeChatUser) {
          fetchMessages(activeChatUser.id);
          
          // Subscribe to new messages
          const channel = supabase
            .channel(`chat:${currentUser.id}-${activeChatUser.id}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'messages' },
              (payload) => {
                const newMsg = payload.new;
                if (
                  (newMsg.sender_id === activeChatUser.id && newMsg.receiver_id === currentUser.id) ||
                  (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeChatUser.id)
                ) {
                   setMessages((prev) => {
                       if (prev.find(m => m.id === newMsg.id)) return prev;
                       return [...prev, {
                         id: newMsg.id,
                         senderId: newMsg.sender_id,
                         receiverId: newMsg.receiver_id,
                         content: newMsg.content,
                         createdAt: newMsg.created_at,
                         isRead: newMsg.is_read
                       }]
                   });
                }
              }
            )
            .subscribe();

          return () => { supabase.removeChannel(channel); }
      }
  }, [activeChatUser, currentUser]);

  // --- Scroll to bottom on new message ---
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChatUser]);

  const fetchFriendsAndRequests = async () => {
      if (!currentUser) return;
      
      // 1. Get Friendships where current user is EITHER requester OR receiver
      const { data: friendships } = await supabase
          .from('friendships')
          .select('*')
          .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      if (friendships) {
          // Filter for Accepted (Visible to both)
          const accepted = friendships.filter((f: any) => f.status === 'accepted');
          
          // Filter for Pending (Only visible to Receiver in requests list)
          const pending = friendships.filter((f: any) => f.status === 'pending' && f.receiver_id === currentUser.id);
          
          // Map Accepted to User objects (Get the "other" person)
          const friendIds = accepted.map((f: any) => f.requester_id === currentUser.id ? f.receiver_id : f.requester_id);
          const friendObjs = users.filter(u => friendIds.includes(u.id));
          setFriends(friendObjs);

          // Map Pending Requests
          const requestObjs = pending.map((f: any) => {
              const u = users.find(user => user.id === f.requester_id);
              return { ...f, user: u };
          }).filter((r: any) => r.user);
          setFriendRequests(requestObjs);
      }
  };

  const fetchMessages = async (friendId: string) => {
      if (!currentUser) return;
      const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });

      if (data) {
          setMessages(data.map((m: any) => ({
              id: m.id,
              senderId: m.sender_id,
              receiverId: m.receiver_id,
              content: m.content,
              createdAt: m.created_at,
              isRead: m.is_read
          })));
      }
  };

  const handleSendRequest = async (targetId: string) => {
      if (!currentUser) return;
      setLoading(true);
      
      // Check if exists
      const { data: existing } = await supabase
          .from('friendships')
          .select('*')
          .or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${currentUser.id})`);

      if (existing && existing.length > 0) {
          alert("Request pending or already friends.");
          setLoading(false);
          return;
      }

      const { error } = await supabase.from('friendships').insert([{
          requester_id: currentUser.id,
          receiver_id: targetId,
          status: 'pending'
      }]);

      if (!error) {
          alert("Friend request sent!");
          setSearchQuery('');
          setActiveTab('chats');
          fetchFriendsAndRequests();
      }
      setLoading(false);
  };

  const handleAcceptRequest = async (friendshipId: string) => {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      if (!error) fetchFriendsAndRequests();
  };

  const handleRejectRequest = async (friendshipId: string) => {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (!error) fetchFriendsAndRequests();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !currentUser || !activeChatUser) return;

      const content = newMessage.trim();
      setNewMessage(''); // Optimistic clear

      const { error } = await supabase.from('messages').insert([{
          sender_id: currentUser.id,
          receiver_id: activeChatUser.id,
          content: content
      }]);

      if (error) {
          console.error("Failed to send message", error);
          setNewMessage(content); // Restore if failed
      } else {
          // Explicit fetch not strictly needed if subscription is active, but good for backup
          fetchMessages(activeChatUser.id);
      }
  };

  // Filter users for search
  const filteredUsers = searchQuery 
    ? users.filter(u => 
        u.id !== currentUser?.id && 
        !friends.find(f => f.id === u.id) &&
        (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  // Filter friends for chat list
  const filteredFriends = friends.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    // Fixed height container to prevent page scrolling, full height of parent
    <div className="h-full flex flex-col md:grid md:grid-cols-3 bg-dark-card border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
      
      {/* LEFT PANE: List */}
      <div className={`md:col-span-1 border-r border-gray-800 flex flex-col bg-dark-card h-full ${activeChatUser ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-6 border-b border-gray-800 space-y-5 flex-shrink-0">
              <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Chats</h2>
                  <button 
                    onClick={() => {
                        setActiveTab(activeTab === 'chats' ? 'search' : 'chats');
                        setSearchQuery('');
                    }} 
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${activeTab === 'search' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-dark-bg text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  >
                      {activeTab === 'search' ? <MessageSquare size={20} /> : <UserPlus size={20} />}
                  </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                      type="text" 
                      placeholder={activeTab === 'search' ? "Find users..." : "Search friends..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-dark-bg border border-gray-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500"
                  />
              </div>

              {/* Friend Requests Alert */}
              {friendRequests.length > 0 && activeTab === 'chats' && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-xl">
                      <p className="text-xs font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                          <Bell size={12} /> Friend Requests
                      </p>
                      {friendRequests.map(req => (
                          <div key={req.id} className="flex items-center justify-between mb-3 last:mb-0">
                              <div className="flex items-center gap-3">
                                  <img src={req.user.avatar} className="w-8 h-8 rounded-full" alt="" />
                                  <span className="text-sm font-medium text-white">{req.user.name}</span>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => handleAcceptRequest(req.id)} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors"><Check size={14}/></button>
                                  <button onClick={() => handleRejectRequest(req.id)} className="p-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-white transition-colors"><X size={14}/></button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'search' ? (
                  // Global Search Results
                  <div className="p-3 space-y-1">
                      <p className="px-3 py-2 text-xs text-gray-500 uppercase font-bold tracking-wider">Suggestions</p>
                      {filteredUsers.length === 0 ? (
                          <div className="p-8 text-center">
                               <p className="text-gray-500 text-sm">No users found.</p>
                          </div>
                      ) : (
                          filteredUsers.map(u => (
                              <div key={u.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
                                  <div className="flex items-center gap-3">
                                      <img src={u.avatar} className="w-10 h-10 rounded-full bg-dark-bg" alt="" />
                                      <div>
                                          <p className="text-sm font-bold text-white">{u.name}</p>
                                          <p className="text-xs text-gray-500">{u.email}</p>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => handleSendRequest(u.id)} 
                                    className="text-indigo-400 hover:text-white hover:bg-indigo-600 p-2 rounded-lg transition-all"
                                  >
                                      <UserPlus size={18} />
                                  </button>
                              </div>
                          ))
                      )}
                  </div>
              ) : (
                  // Friends List
                  <div className="p-3 space-y-1">
                      {friends.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500 mt-10">
                              <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mb-4">
                                <UserPlus size={24} className="opacity-50" />
                              </div>
                              <p className="text-sm text-gray-400">No friends yet. Click the + icon to find people.</p>
                          </div>
                      ) : (
                          filteredFriends.length === 0 ? (
                              <p className="text-center text-gray-500 text-sm py-8">No friends match your search.</p>
                          ) : (
                              filteredFriends.map(friend => (
                                  <div 
                                    key={friend.id} 
                                    onClick={() => setActiveChatUser(friend)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${
                                        activeChatUser?.id === friend.id 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                                    }`}
                                  >
                                      <div className="relative">
                                          <img src={friend.avatar} className={`w-12 h-12 rounded-full border-2 ${activeChatUser?.id === friend.id ? 'border-indigo-400' : 'border-dark-bg'}`} alt="" />
                                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-dark-card"></div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-baseline mb-0.5">
                                              <h4 className={`font-bold text-sm truncate ${activeChatUser?.id === friend.id ? 'text-white' : 'text-gray-200'}`}>{friend.name}</h4>
                                          </div>
                                          <p className={`text-xs truncate ${activeChatUser?.id === friend.id ? 'text-indigo-200' : 'text-gray-500'}`}>Tap to chat</p>
                                      </div>
                                  </div>
                              ))
                          )
                      )}
                  </div>
              )}
          </div>
      </div>

      {/* RIGHT PANE: Chat Area */}
      <div className={`md:col-span-2 flex flex-col bg-dark-bg/50 h-full relative ${!activeChatUser ? 'hidden md:flex' : 'flex'}`}>
          {activeChatUser ? (
              <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-dark-card/90 backdrop-blur z-10">
                      <button 
                        onClick={() => setActiveChatUser(null)} 
                        className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
                      >
                          <ArrowLeft size={24} />
                      </button>
                      <div className="relative">
                          <img src={activeChatUser.avatar} className="w-10 h-10 rounded-full border border-gray-700" alt="" />
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-dark-card"></div>
                      </div>
                      <div>
                          <h3 className="font-bold text-white text-base">{activeChatUser.name}</h3>
                          <p className="text-xs text-emerald-500 font-medium">Online</p>
                      </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-dark-bg">
                      {messages.map((msg) => {
                          const isMe = msg.senderId === currentUser?.id;
                          return (
                              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  {!isMe && <img src={activeChatUser.avatar} className="w-8 h-8 rounded-full mr-3 self-end mb-1 opacity-80" alt="" />}
                                  <div className={`max-w-[75%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                      isMe 
                                      ? 'bg-indigo-600 text-white rounded-br-none' 
                                      : 'bg-dark-card border border-gray-800 text-gray-200 rounded-bl-none'
                                  }`}>
                                      {msg.content}
                                      <p className={`text-[10px] mt-1.5 text-right font-medium opacity-70`}>
                                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                  </div>
                              </div>
                          )
                      })}
                      <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-gray-800 bg-dark-card z-10">
                      <form onSubmit={handleSendMessage} className="flex gap-3">
                          <input 
                              type="text" 
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type a message..."
                              className="flex-1 bg-dark-bg border border-gray-800 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-600"
                          />
                          <button 
                            type="submit" 
                            disabled={!newMessage.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                          >
                              <Send size={20} />
                          </button>
                      </form>
                  </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 bg-dark-bg/30">
                  <div className="w-24 h-24 bg-dark-card border border-gray-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
                      <MessageSquare size={40} className="text-indigo-500 opacity-80" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Your Messages</h3>
                  <p className="text-sm text-gray-400 max-w-xs text-center">Select a conversation from the list or start a new one to begin chatting.</p>
              </div>
          )}
      </div>
    </div>
  );
}