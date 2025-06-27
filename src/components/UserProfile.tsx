import React, { useState, useEffect } from 'react';
import { User, Mail, MapPin, Star, Edit, Camera, Save, X, Shield, Award, DollarSign, Clock, Package, CheckSquare, Loader, History } from 'lucide-react';
import { auth, db, storage } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import TaskHistory from './TaskHistory';

const UserProfile: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<any>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'tasks' | 'stats' | 'history'>('profile');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user profile
      const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
      if (profileDoc.exists()) {
        const profileData = {
          id: profileDoc.id,
          ...profileDoc.data()
        };
        setProfile(profileData);
        setEditedProfile(profileData);
      }

      // Get user stats
      const statsDoc = await getDoc(doc(db, 'user_stats', user.uid));
      if (statsDoc.exists()) {
        setStats({
          id: statsDoc.id,
          ...statsDoc.data()
        });
      }

      // Get user tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('created_by', '==', user.uid),
        orderBy('created_at', 'desc')
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Error loading profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (editing) {
      // Cancel editing
      setEditedProfile(profile);
    }
    setEditing(!editing);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const updatedData = {
        ...editedProfile,
        updated_at: new Date()
      };

      await updateDoc(doc(db, 'profiles', user.uid), updatedData);
      
      // Refresh profile data
      setProfile({
        ...profile,
        full_name: editedProfile.full_name,
        major: editedProfile.major
      });
      
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Image size should be less than 2MB');
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }

      // Upload to Firebase Storage
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update profile
      await updateDoc(doc(db, 'profiles', user.uid), {
        avatar_url: downloadURL,
        updated_at: new Date()
      });
      
      // Update local state
      setProfile({
        ...profile,
        avatar_url: downloadURL
      });
      
      toast.success('Profile picture updated');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(error.message || 'Error uploading image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateNewTask = () => {
    // Dispatch the create-task event
    window.dispatchEvent(new CustomEvent('create-task'));
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0021A5]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="md:w-1/3 lg:w-1/4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-[#002B7F] to-[#0038FF] p-6 text-white relative">
              <div className="flex justify-center">
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-24 h-24 rounded-full border-4 border-white object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white">
                      <User className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="absolute bottom-0 right-0 bg-white text-[#0038FF] p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors"
                  >
                    {uploadingImage ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
              <h2 className="text-xl font-bold text-center mt-4">{profile?.full_name}</h2>
              <p className="text-center text-blue-100">{profile?.major || 'No major specified'}</p>
              
              {profile?.is_verified && (
                <div className="flex items-center justify-center mt-2">
                  <Shield className="w-4 h-4 mr-1 text-blue-200" />
                  <span className="text-sm">Verified Student</span>
                </div>
              )}
            </div>
            
            {/* Navigation */}
            <div className="p-4">
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center p-3 rounded-lg ${
                    activeTab === 'profile'
                      ? 'bg-blue-50 text-[#0038FF]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-5 h-5 mr-3" />
                  <span>Profile Information</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex items-center p-3 rounded-lg ${
                    activeTab === 'tasks'
                      ? 'bg-blue-50 text-[#0038FF]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Package className="w-5 h-5 mr-3" />
                  <span>My Tasks</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center p-3 rounded-lg ${
                    activeTab === 'history'
                      ? 'bg-blue-50 text-[#0038FF]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <History className="w-5 h-5 mr-3" />
                  <span>Task History</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center p-3 rounded-lg ${
                    activeTab === 'stats'
                      ? 'bg-blue-50 text-[#0038FF]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Award className="w-5 h-5 mr-3" />
                  <span>Stats & Achievements</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="md:w-2/3 lg:w-3/4">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Profile Information</h2>
                <button
                  onClick={handleEditToggle}
                  className="text-[#0038FF] hover:text-[#0021A5] flex items-center"
                >
                  {editing ? (
                    <>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </>
                  )}
                </button>
              </div>
              
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={editedProfile.full_name || ''}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#0038FF] focus:border-[#0038FF]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Major
                    </label>
                    <input
                      type="text"
                      name="major"
                      value={editedProfile.major || ''}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#0038FF] focus:border-[#0038FF]"
                    />
                  </div>
                  
                  <div className="pt-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="bg-[#0038FF] text-white px-4 py-2 rounded-lg hover:bg-[#0021A5] transition-colors flex items-center"
                    >
                      {loading ? (
                        <Loader className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <Save className="w-5 h-5 mr-2" />
                      )}
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start">
                    <User className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                      <p className="mt-1">{profile?.full_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Mail className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Email</h3>
                      <p className="mt-1">{profile?.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Major</h3>
                      <p className="mt-1">{profile?.major || 'Not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Clock className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Member Since</h3>
                      <p className="mt-1">{formatDate(profile?.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Shield className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Verification Status</h3>
                      <div className="mt-1 flex items-center">
                        {profile?.is_verified ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckSquare className="w-3 h-3 mr-1" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Unverified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'tasks' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">My Tasks</h2>
                <button
                  onClick={handleCreateNewTask}
                  className="bg-[#FF5A1F] text-white px-4 py-2 rounded-lg hover:bg-[#E63A0B] transition-colors"
                >
                  Create New Task
                </button>
              </div>
              
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No tasks yet</h3>
                  <p className="mt-2 text-gray-500">
                    You haven't created any tasks yet. Click the button above to create your first task.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.filter(task => task.status !== 'completed').map((task) => (
                    <div
                      key={task.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium">{task.title}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          task.status === 'open' ? 'bg-blue-100 text-blue-800' :
                          task.status === 'accepted' ? 'bg-yellow-100 text-yellow-800' :
                          task.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      <div className="flex items-center mt-2 text-sm text-gray-500">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span>{task.location}</span>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <div className="flex items-center text-sm">
                          <DollarSign className="w-4 h-4 mr-1 text-[#0038FF]" />
                          <span className="font-medium text-[#0038FF]">${task.price}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(task.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'history' && (
            <TaskHistory />
          )}
          
          {activeTab === 'stats' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold mb-6">Stats & Achievements</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">Tasks Completed</h3>
                    <CheckSquare className="w-5 h-5 text-[#0038FF]" />
                  </div>
                  <p className="text-2xl font-bold mt-2">{stats?.tasks_completed || 0}</p>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">Total Earnings</h3>
                    <DollarSign className="w-5 h-5 text-[#0038FF]" />
                  </div>
                  <p className="text-2xl font-bold mt-2">${stats?.total_earnings?.toFixed(2) || '0.00'}</p>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">Rating</h3>
                    <Star className="w-5 h-5 text-[#0038FF]" />
                  </div>
                  <div className="flex items-center mt-2">
                    <p className="text-2xl font-bold">{stats?.average_rating?.toFixed(1) || '0.0'}</p>
                    <div className="flex ml-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.round(stats?.average_rating || 0)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold mb-4">Achievements</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border ${
                  (stats?.tasks_completed || 0) >= 1
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                      (stats?.tasks_completed || 0) >= 1
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                    }`}>
                      <Award className={`w-6 h-6 ${
                        (stats?.tasks_completed || 0) >= 1
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium">First Task</h4>
                      <p className="text-sm text-gray-500">Complete your first task</p>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg border ${
                  (stats?.tasks_completed || 0) >= 5
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                      (stats?.tasks_completed || 0) >= 5
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                    }`}>
                      <Award className={`w-6 h-6 ${
                        (stats?.tasks_completed || 0) >= 5
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium">Task Master</h4>
                      <p className="text-sm text-gray-500">Complete 5 tasks</p>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg border ${
                  profile?.is_verified
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                      profile?.is_verified
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                    }`}>
                      <Shield className={`w-6 h-6 ${
                        profile?.is_verified
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium">Verified Student</h4>
                      <p className="text-sm text-gray-500">Verify your student status</p>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg border ${
                  (stats?.total_earnings || 0) >= 50
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                      (stats?.total_earnings || 0) >= 50
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                    }`}>
                      <DollarSign className={`w-6 h-6 ${
                        (stats?.total_earnings || 0) >= 50
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium">Money Maker</h4>
                      <p className="text-sm text-gray-500">Earn $50 from tasks</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;