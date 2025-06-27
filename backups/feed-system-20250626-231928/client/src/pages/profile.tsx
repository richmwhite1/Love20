import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Eye, Folder, User, Lock, Users, Globe, Plus, Settings, MoreHorizontal, UserPlus, Trash2, Camera, GripVertical, Edit3, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import PostCard from "@/components/post-card";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { id: paramUserId } = useParams();
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [defaultPrivacy, setDefaultPrivacy] = useState<'public' | 'connections' | 'private'>('public');
  const [showPrivacyControls, setShowPrivacyControls] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListPrivacy, setNewListPrivacy] = useState<'public' | 'connections' | 'private'>('public');
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [location, setLocation] = useLocation();
  const { user: currentUser, getIdToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // If no ID in URL, use current user's ID
  const profileUserId = paramUserId || currentUser?.id;

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/users', profileUserId],
    enabled: !!profileUserId,
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch(`/api/users/${profileUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch user data');
      return res.json();
    },
  });

  const { data: lists } = useQuery({
    queryKey: ['/api/lists/user', profileUserId],
    enabled: !!profileUserId,
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch(`/api/lists/user/${profileUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: userPosts, isLoading: postsLoading } = useQuery({
    queryKey: ['/api/posts/user', profileUserId],
    enabled: !!profileUserId,
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch(`/api/posts/user/${profileUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isOwnProfile = currentUser?.id === profileUserId;

  console.log('Profile logic:', { profileUserId, isOwnProfile, paramUserId, currentUserId: currentUser?.id });

  // iPhone-style long press handlers
  const handleLongPressStart = (e: React.MouseEvent | React.TouchEvent, listId: string) => {
    e.preventDefault();
    if (!isOwnProfile || isEditMode) return;
    
    const timer = setTimeout(() => {
      setIsEditMode(true);
      setLongPressTimer(null);
    }, 800); // 800ms for long press
    
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleListClick = (listId: string) => (e: React.MouseEvent) => {
    if (isEditMode) return; // Prevent navigation in edit mode
    if (!isDragging) {
      setLocation(`/list/${listId}`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, listId: string) => {
    e.preventDefault();
    if (isOwnProfile && !isEditMode) {
      setSelectedList(listId);
      setShowDeleteDialog(true);
    }
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setIsDragging(false);
  };

  const createListMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      privacy: 'public' | 'connections' | 'private';
    }) => {
      const token = await getIdToken();
      return apiRequest('POST', '/api/lists', data, token);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "List created successfully!",
      });
      setShowCreateListDialog(false);
      setNewListName('');
      setNewListDescription('');
      setNewListPrivacy('public');
      queryClient.invalidateQueries({ queryKey: ['/api/lists/user', profileUserId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create list",
        variant: "destructive",
      });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const token = await getIdToken();
      return apiRequest('DELETE', `/api/lists/${listId}`, undefined, token);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "List deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lists/user', profileUserId] });
      setIsEditMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete list",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      // Clean up preview URL to prevent memory leaks
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [longPressTimer, previewImageUrl]);

  // Enhanced image processing functions
  const resizeImage = (file: File, maxSizeMB: number = 5): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          const MAX_WIDTH = 800; // Smaller for profile pictures
          const MAX_HEIGHT = 800;
          
          let { width, height } = img;
          
          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Ensure we have a valid context
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Draw the image with proper scaling
          ctx.drawImage(img, 0, 0, width, height);
          
          // Determine the best format based on original file type
          let mimeType = 'image/jpeg';
          if (file.type === 'image/png') {
            mimeType = 'image/png';
          } else if (file.type === 'image/webp') {
            mimeType = 'image/webp';
          }
          
          // Convert to blob with appropriate quality
          canvas.toBlob((blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + (mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.webp'), {
                type: mimeType,
                lastModified: Date.now(),
              });
              resolve(resizedFile);
            } else {
              reject(new Error('Failed to create image blob'));
            }
          }, mimeType, 0.85); // Good quality with reasonable file size
        } catch (error) {
          reject(new Error(`Image processing failed: ${error}`));
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // Process image file with enhanced validation
  const processImageFile = async (file: File): Promise<File> => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload JPEG, PNG, GIF, or WebP images only.');
    }

    // Validate file size (max 10MB before processing)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Please upload an image smaller than 10MB.');
    }

    // If file is already under 2MB and in a good format, return as-is (smaller limit for profile pics)
    if (file.size <= 2 * 1024 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
      return file;
    }

    // Process the image (resize if needed)
    return await resizeImage(file, 2);
  };

  // Handle profile picture upload with immediate feedback
  const handleProfilePictureUpload = async (file: File) => {
    if (isUploadingProfilePicture) return; // Prevent multiple uploads
    
    setIsUploadingProfilePicture(true);
    setPreviewImageUrl(null);
    
    try {
      // Show immediate preview
      const previewUrl = URL.createObjectURL(file);
      setPreviewImageUrl(previewUrl);
      
      // Process the image with enhanced validation and resizing
      const processedFile = await processImageFile(file);
      
      // Handle profile picture upload
      const formData = new FormData();
      formData.append('profilePicture', processedFile);
      
      const token = await getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch('/api/upload-profile-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: "Profile picture updated!",
        });
        
        // Update the query cache immediately with the new URL
        queryClient.setQueryData(['/api/users', profileUserId], (oldData: any) => ({
          ...oldData,
          profilePictureUrl: result.profilePictureUrl
        }));
        
        // Also invalidate to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['/api/users', profileUserId] });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile picture');
      }
    } catch (error: any) {
      console.error('Error in upload:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile picture",
        variant: "destructive",
      });
      // Clear preview on error
      setPreviewImageUrl(null);
    } finally {
      setIsUploadingProfilePicture(false);
    }
  };

  if (!profileUserId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div>Invalid profile ID</div>
      </div>
    );
  }

  if (userLoading || !userData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div>Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{userData?.name || userData?.username}</h1>
            {userData?.name && (
              <span className="text-gray-400 text-sm">@{userData?.username}</span>
            )}
          </div>
          {isOwnProfile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPrivacyControls(true)}
              className="text-gray-400 hover:text-white"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Profile Info */}
        <div className="px-6 py-6">
          {/* Large Profile Picture Tile */}
          <div className="mb-6">
            <div className="relative aspect-square w-full max-w-sm mx-auto rounded-lg overflow-hidden bg-gray-800">
              {/* Show preview image if uploading, otherwise show current profile picture */}
              {(previewImageUrl || userData?.profilePictureUrl) ? (
                <img 
                  src={previewImageUrl || userData.profilePictureUrl} 
                  alt={userData?.name || userData?.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white text-6xl font-bold">
                  {(userData?.name || userData?.username)?.[0]?.toUpperCase()}
                </div>
              )}
              
              {/* Loading overlay during upload */}
              {isUploadingProfilePicture && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto mb-2" />
                    <div className="text-sm">Uploading...</div>
                  </div>
                </div>
              )}
              
              {/* Camera Icon for Upload - Only for own profile */}
              {isOwnProfile && (
                <div className="absolute top-2 right-2">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingProfilePicture}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleProfilePictureUpload(file);
                      }
                      // Clear the input value to allow selecting the same file again
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="profile-picture-upload"
                  />
                  <label htmlFor="profile-picture-upload" className={`cursor-pointer ${isUploadingProfilePicture ? 'pointer-events-none opacity-50' : ''}`}>
                    <div className="bg-black/60 hover:bg-black/80 rounded-full p-2 transition-all">
                      {isUploadingProfilePicture ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Camera className="h-5 w-5 text-white" />
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="mb-4">
            <p className="text-gray-300 text-sm leading-relaxed text-center">
              {userData?.bio || "No bio yet"}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 py-3 px-4 bg-gray-900 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{Array.isArray(userPosts) ? userPosts.length : 0}</div>
              <div className="text-xs text-gray-400">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{Array.isArray(lists) ? lists.length : 0}</div>
              <div className="text-xs text-gray-400">Lists</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">0</div>
              <div className="text-xs text-gray-400">Friends</div>
            </div>
          </div>
        </div>

        {/* Lists Section */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Lists</h3>
            {isOwnProfile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateListDialog(true)}
                className="text-blue-400 hover:text-blue-300"
              >
                <Plus className="h-4 w-4 mr-1" />
                New List
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {Array.isArray(lists) ? lists.map((list: any) => {
              const recentPost = list.posts?.[0];
              const hasImage = recentPost?.primaryPhotoUrl || recentPost?.thumbnailUrl;

              return (
                <div
                  key={list.id}
                  className={`bg-gray-900 rounded-xl p-2 hover:bg-black transition-colors cursor-pointer relative ${
                    isEditMode ? 'animate-wiggle' : ''
                  }`}
                  onMouseDown={(e) => handleLongPressStart(e, list.id)}
                  onMouseUp={(e) => handleLongPressEnd(e)}
                  onMouseLeave={(e) => handleLongPressEnd(e)}
                  onTouchStart={(e) => handleLongPressStart(e, list.id)}
                  onTouchEnd={(e) => handleLongPressEnd(e)}
                  onContextMenu={(e) => handleContextMenu(e, list.id)}
                  onClick={handleListClick(list.id)}
                >
                  {/* iPhone-style delete button */}
                  {isEditMode && isOwnProfile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteListMutation.mutate(list.id);
                      }}
                      className="absolute -top-1 -right-1 z-10 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}

                  {/* List content */}
                  <div className="w-full aspect-square rounded-lg mb-2 overflow-hidden relative">
                    {hasImage ? (
                      <img 
                        src={recentPost.primaryPhotoUrl || recentPost.thumbnailUrl} 
                        alt={list.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                        <Folder className="h-8 w-8 text-gray-600" />
                      </div>
                    )}
                    
                    {/* Privacy Indicator */}
                    {list.privacyLevel !== 'public' && (
                      <div className="absolute top-1 right-1">
                        <div className="bg-black/80 text-white px-1.5 py-0.5 rounded text-xs">
                          {list.privacyLevel === 'private' ? 'Private' : 'Friends'}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs font-medium text-white truncate">{list.name}</div>
                  <div className="text-xs text-gray-400">{list.postCount || 0} posts</div>
                </div>
              );
            }) : (
              <div className="col-span-3 text-center py-8">
                <div className="text-gray-400">No lists yet</div>
                {isOwnProfile && (
                  <p className="text-gray-500 text-sm mt-1">Create your first list to get started</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Posts Section */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Posts</h3>
          </div>
          
          {postsLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-400">Loading posts...</div>
            </div>
          ) : Array.isArray(userPosts) && userPosts.length > 0 ? (
            <div className="space-y-4">
              {userPosts.map((post: any) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400">No posts yet</div>
              {isOwnProfile && (
                <p className="text-gray-500 text-sm mt-1">Share your first post to get started</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showPrivacyControls} onOpenChange={setShowPrivacyControls}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Privacy Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">Default Post Privacy</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Switch
                    checked={defaultPrivacy === 'public'}
                    onCheckedChange={() => setDefaultPrivacy('public')}
                  />
                  <div>
                    <div className="font-medium">Public</div>
                    <div className="text-sm text-gray-400">Anyone can see your posts</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    checked={defaultPrivacy === 'connections'}
                    onCheckedChange={() => setDefaultPrivacy('connections')}
                  />
                  <div>
                    <div className="font-medium">Connections Only</div>
                    <div className="text-sm text-gray-400">Only your connections can see your posts</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    checked={defaultPrivacy === 'private'}
                    onCheckedChange={() => setDefaultPrivacy('private')}
                  />
                  <div>
                    <div className="font-medium">Private</div>
                    <div className="text-sm text-gray-400">Only you can see your posts</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-red-400 font-medium mb-4">Danger Zone</h4>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowPrivacyControls(false);
                  setShowDeleteDialog(true);
                }}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Profile
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPrivacyControls(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Save privacy settings
                apiRequest('PUT', `/api/users/${profileUserId}/privacy`, {
                  defaultPrivacy
                })
                  .then(() => {
                    toast({
                      title: "Success",
                      description: "Privacy settings updated!",
                    });
                    setShowPrivacyControls(false);
                  })
                  .catch(() => {
                    toast({
                      title: "Error", 
                      description: "Failed to update privacy settings",
                      variant: "destructive",
                    });
                  });
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create List Dialog */}
      <Dialog open={showCreateListDialog} onOpenChange={setShowCreateListDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="list-name">List Name</Label>
              <Input
                id="list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Enter list name"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            
            <div>
              <Label htmlFor="list-description">Description (Optional)</Label>
              <Textarea
                id="list-description"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Describe your list"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            
            <div>
              <Label htmlFor="list-privacy">Privacy</Label>
              <Select value={newListPrivacy} onValueChange={(value: any) => setNewListPrivacy(value)}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-white">
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="connections">Connections Only</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateListDialog(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newListName.trim()) {
                  toast({
                    title: "Error",
                    description: "List name is required",
                    variant: "destructive",
                  });
                  return;
                }
                
                createListMutation.mutate({
                  name: newListName.trim(),
                  description: newListDescription.trim() || undefined,
                  privacy: newListPrivacy,
                });
              }}
              disabled={createListMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createListMutation.isPending ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Profile Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Profile</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-gray-300">
              Are you sure you want to delete your profile? This action cannot be undone.
            </p>
            <p className="text-red-400 font-medium">
              All your posts, lists, and data will be permanently deleted.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                apiRequest('DELETE', `/api/users/${profileUserId}`)
                  .then(() => {
                    toast({
                      title: "Profile Deleted",
                      description: "Your profile has been permanently deleted",
                    });
                    // Redirect to login or home
                    setLocation('/');
                  })
                  .catch(() => {
                    toast({
                      title: "Error",
                      description: "Failed to delete profile",
                      variant: "destructive",
                    });
                  });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}