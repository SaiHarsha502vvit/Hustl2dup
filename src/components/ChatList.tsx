import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, User, ChevronRight, Clock, Eye, MoreVertical, Info, Flag } from 'lucide-react';
import Chat from './Chat';
import GameChat from './GameChat';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { taskService, messageService } from '../lib/database';
import UserProfileModal from './UserProfileModal';
import ReportModal from './ReportModal';

interface ChatListProps {
  userId: string;
  currentUser?: any;
}

interface ChatItem {
  id: string;
  task_id: string;
  task: {
    title: string;
    status: string;
  };
  other_user: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  last_message?: {
    content: string;
    created_at: any;
    image_url?: string;
  };
}

const ChatList: React.FC<ChatListProps> = ({ userId, currentUser }) => {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    
    loadChats();
    subscribeToMessages();
    
    // Handle clicks outside the menu
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userId]);

  const loadChats = async () => {
    try {
      setLoading(true);
      
      // Get all tasks where the user is either creator or acceptor
      const allTasks = await taskService.getTasks();
      
      // Filter tasks where user is involved and task is not open
      const userTasks = allTasks.filter(task => 
        (task.created_by === userId || task.accepted_by === userId) && 
        task.status !== 'open'
      );

      const chatDataPromises = userTasks.map(async (task) => {
        const otherUserId = task.created_by === userId ? task.accepted_by : task.created_by;
        
        // Skip if otherUserId is null
        if (!otherUserId) {
          return null;
        }
        
        // Get other user's profile
        const otherUserProfile = await getOtherUserProfile(otherUserId);
        
        // Skip if we couldn't get the other user's profile
        if (!otherUserProfile) {
          return null;
        }
        
        // Get last message for this task
        const messages = await messageService.getMessages(task.id);
        const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;

        return {
          id: task.id,
          task_id: task.id,
          task: {
            title: task.title,
            status: task.status,
          },
          other_user: {
            id: otherUserId,
            full_name: otherUserProfile.full_name || 'Unknown User',
            avatar_url: otherUserProfile.avatar_url,
          },
          last_message: lastMessage ? {
            content: lastMessage.content,
            created_at: lastMessage.created_at,
            image_url: lastMessage.image_url
          } : undefined,
        };
      });

      const chatDataResults = await Promise.all(chatDataPromises);
      
      // Filter out null entries
      const chatData = chatDataResults.filter((chat): chat is ChatItem => chat !== null);

      // Sort by last message time (most recent first)
      chatData.sort((a, b) => {
        if (!a.last_message && !b.last_message) return 0;
        if (!a.last_message) return 1;
        if (!b.last_message) return -1;
        
        const aTime = new Date(a.last_message.created_at).getTime();
        const bTime = new Date(b.last_message.created_at).getTime();
        
        return bTime - aTime;
      });

      setChats(chatData);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOtherUserProfile = async (userId: string) => {
    try {
      const userDoc = await getDocs(query(
        collection(db, 'profiles'),
        where('id', '==', userId)
      ));
      
      if (userDoc.empty) return null;
      
      return {
        id: userDoc.docs[0].id,
        ...userDoc.docs[0].data()
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  };

  const subscribeToMessages = () => {
    // Subscribe to all message changes to update last messages
    const q = query(
      collection(db, 'messages'),
      orderBy('created_at', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, () => {
      loadChats(); // Reload chats when any message changes
    });

    return unsubscribe;
  };

  const handleViewProfile = (chat: ChatItem) => {
    setSelectedUser(chat.other_user);
    setShowUserProfile(true);
    setShowMenu(null);
  };

  const handleReportIssue = (chat: ChatItem) => {
    setSelectedUser(chat.other_user);
    setSelectedTaskId(chat.task_id);
    setShowReportModal(true);
    setShowMenu(null);
  };

  const filteredChats = chats.filter(chat =>
    chat.task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.other_user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMessagePreview = (message?: ChatItem['last_message']) => {
    if (!message) return 'No messages yet';
    if (message.image_url) {
      return '📷 Image';
    }
    return message.content || 'No messages yet';
  };

  const selectedChatData = selectedChat ? chats.find(chat => chat.id === selectedChat) : null;

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Chat List Sidebar */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold mb-4">Messages</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0021A5]"
            />
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0021A5]"></div>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="w-12 h-12 mb-2" />
              <p>No messages yet</p>
              <p className="text-sm text-center px-4">
                Accept a task or have someone accept your task to start chatting
              </p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div key={chat.id} className="relative">
                <button
                  onClick={() => setSelectedChat(chat.id)}
                  className={`w-full p-4 border-b hover:bg-gray-50 transition-colors flex items-start text-left ${
                    selectedChat === chat.id ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex-shrink-0">
                    {chat.other_user.avatar_url ? (
                      <img
                        src={chat.other_user.avatar_url}
                        alt={chat.other_user.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {chat.other_user.full_name}
                      </h3>
                      {chat.last_message && (
                        <span className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTimestamp(chat.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{chat.task.title}</p>
                    <p className="text-xs text-gray-500 truncate">{getMessagePreview(chat.last_message)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                </button>
                
                <button 
                  onClick={() => setShowMenu(showMenu === chat.id ? null : chat.id)}
                  className="absolute top-4 right-10 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {showMenu === chat.id && (
                  <div 
                    ref={menuRef}
                    className="absolute right-10 top-10 w-48 bg-white rounded-lg shadow-lg py-2 z-10 border border-gray-200"
                  >
                    <button
                      onClick={() => handleViewProfile(chat)}
                      className="flex items-center w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Profile
                    </button>
                    <button
                      className="flex items-center w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                    >
                      <Info className="w-4 h-4 mr-2" />
                      Task Details
                    </button>
                    <button
                      onClick={() => handleReportIssue(chat)}
                      className="flex items-center w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Report Issue
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 bg-gray-50">
        {selectedChat && selectedChatData && currentUser ? (
          <GameChat
            taskId={selectedChat}
            otherUser={selectedChatData.other_user}
            currentUser={currentUser}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-center text-gray-500">
            <div>
              <MessageSquare className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Select a chat to start messaging</h3>
              <p>Choose a conversation from the list to view messages</p>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {showUserProfile && selectedUser && (
        <UserProfileModal
          user={{
            id: selectedUser.id,
            full_name: selectedUser.full_name,
            avatar_url: selectedUser.avatar_url,
            level: 3, // Mock data
            badges: ['First Task', 'Verified'],
            rating: 4.8,
            total_tasks: 12,
            activity_status: 'online'
          }}
          onClose={() => setShowUserProfile(false)}
        />
      )}

      {/* Report Modal */}
      {showReportModal && selectedUser && selectedTaskId && (
        <ReportModal
          taskId={selectedTaskId}
          userId={selectedUser.id}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

export default ChatList;