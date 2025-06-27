import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DayPicker } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { 
  Link, 
  Youtube, 
  Music, 
  Upload, 
  Plus, 
  X, 
  FolderPlus,
  Globe,
  Users,
  Lock,
  Calendar,
  CalendarPlus,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { ListCollaborators } from '@/components/list-collaborators';
import FriendSelector from '@/components/friend-selector';
import { MultiSelectCollaborators } from '@/components/multi-select-collaborators';
import MediaPlayer from '@/components/media-player';
import { CreatePostTutorial } from '@/components/create-post-tutorial';
import { useAuth } from '@/lib/auth';

export default function CreatePostPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const additionalFileRef = useRef<HTMLInputElement>(null);

  // Form Data State
  const [formData, setFormData] = useState({
    primaryDescription: '',
    primaryPhoto: null as File | null,
    primaryLink: '',
    linkLabel: '',
    youtubeUrl: '',
    youtubeLabel: '',
    spotifyUrl: '',
    spotifyLabel: '',
    privacy: 'public' as 'public' | 'friends' | 'private',
    listId: '',
    fetchedImagePath: '',
    imageWidth: null as number | null,
    imageHeight: null as number | null,
    fetchErrorMessage: '',
    discountCode: '',
    hashtags: '',
    hashtagList: [] as string[],
    availableImages: [] as string[]
  });

  // Additional photos state
  const [additionalPhotos, setAdditionalPhotos] = useState<{ file: File; link: string; linkLabel: string; description: string; discountCode: string }[]>([]);

  // UI State
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isEvent, setIsEvent] = useState(false);
  const [showFriendSelector, setShowFriendSelector] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
  const [showNewListDialog, setShowNewListDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showYouTubeInput, setShowYouTubeInput] = useState(false);
  const [showSpotifyInput, setShowSpotifyInput] = useState(false);

  // New List State
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListPrivacy, setNewListPrivacy] = useState('public');
  const [newListCollaborators, setNewListCollaborators] = useState<{ userId: number; username: string; name: string; role: "collaborator" | "viewer" }[]>([]);

  // Event State
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [eventTime, setEventTime] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [reminders, setReminders] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'weekly' | 'monthly' | 'annually' | ''>('');
  const [taskList, setTaskList] = useState<{id: string, text: string, completed: boolean, completedBy?: number}[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [attachedLists, setAttachedLists] = useState<number[]>([]);
  const [allowRsvp, setAllowRsvp] = useState(false);

  // Auth - must come before queries that use isAuthenticated
  const { isAuthenticated, user, getIdToken } = useAuth();

  // Fetch user lists
  const { data: lists } = useQuery({
    queryKey: ['/api/lists'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('No token available');
      const response = await fetch('/api/lists', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch lists');
      return response.json();
    },
    select: (data: any) => Array.isArray(data) ? data : []
  });

  // Set default list when lists are loaded
  useEffect(() => {
    if (lists && lists.length > 0 && !formData.listId) {
      setFormData(prev => ({ ...prev, listId: lists[0].id.toString() }));
    }
  }, [lists, formData.listId]);

  // Check if first-time user and show tutorial
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenCreatePostTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
      localStorage.setItem('hasSeenCreatePostTutorial', 'true');
    }
  }, []);

  // Fetch friends
  const { data: friends } = useQuery({
    queryKey: ['/api/friends'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('No token available');
      const response = await fetch('/api/friends', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch friends');
      return response.json();
    },
    select: (data: any) => {
      if (!Array.isArray(data)) return [];
      return data;
    }
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('No token available');
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  // Resize image helper
  const resizeImage = (file: File, maxSizeMB: number = 5): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          
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

    // If file is already under 5MB and in a good format, return as-is
    if (file.size <= 5 * 1024 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
      return file;
    }

    // Process the image (resize if needed)
    return await resizeImage(file, 5);
  };

  // Create post mutation
  const mutation = useMutation({
    mutationFn: async (postData: FormData) => {
      const token = await getIdToken();
      return apiRequest('POST', '/api/posts', postData, token);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Post created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  // Create list mutation
  const createListMutation = useMutation({
    mutationFn: async (listData: any) => {
      const token = await getIdToken();
      return apiRequest('POST', '/api/lists', listData, token);
    },
    onSuccess: async (response) => {
      const newList = await response.json();
      toast({
        title: "Success",
        description: "List created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lists'] });
      setFormData(prev => ({ ...prev, listId: newList.id.toString() }));
      setShowNewListDialog(false);
      setNewListName('');
      setNewListDescription('');
      setNewListPrivacy('public');
      setNewListCollaborators([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create list",
        variant: "destructive",
      });
    },
  });

  // Handle file upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const processedFile = await processImageFile(file);
      setFormData(prev => ({ 
        ...prev, 
        primaryPhoto: processedFile,
        fetchedImagePath: '',
        fetchErrorMessage: ''
      }));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive",
      });
    }
  };

  // Handle additional photos
  const handleAdditionalPhotosChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const newPhotos = await Promise.all(
        files.map(async (file) => {
          const processedFile = await processImageFile(file);
          return {
            file: processedFile,
            link: '',
            linkLabel: '',
            description: '',
            discountCode: ''
          };
        })
      );

      setAdditionalPhotos(prev => [...prev, ...newPhotos].slice(0, 4));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process images",
        variant: "destructive",
      });
    }
  };

  // URL fetching function
  const fetchImageFromUrl = async (url: string) => {
    if (!url.trim()) return;
    
    console.log('Fetching image from URL:', url);
    setIsLoadingImage(true);
    setFormData(prev => ({ ...prev, fetchErrorMessage: '' }));

    try {
      // Use scrape-image endpoint with proper Firebase authentication
      const token = await getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      console.log('Making request to /api/scrape-image with URL:', url);
      const response = await fetch('/api/scrape-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url })
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        if (data.success && data.images && data.images.length > 0) {
          // Use the first image from the array
          const selectedImageUrl = data.images[0];
          
          setFormData(prev => ({
            ...prev,
            fetchedImagePath: selectedImageUrl,
            primaryPhoto: null,
            imageWidth: null,
            imageHeight: null,
            fetchErrorMessage: '',
            availableImages: data.images // Store all available images for future use
          }));

          toast({
            title: "Success",
            description: `Found ${data.images.length} image(s)! Using the first one.`,
          });
        } else {
          throw new Error(data.message || 'No images found on this page');
        }
      } else {
        const errorData = await response.json();
        console.log('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to fetch image');
      }
    } catch (error: any) {
      console.error('Fetch image error:', error);
      setFormData(prev => ({
        ...prev,
        fetchErrorMessage: error.message || 'Failed to fetch image from URL'
      }));
      
      toast({
        title: "Error",
        description: error.message || "Failed to fetch image from URL",
        variant: "destructive",
      });
    } finally {
      setIsLoadingImage(false);
    }
  };

  // Function to cycle through available images
  const cycleThroughImages = () => {
    if (formData.availableImages.length <= 1) return;
    
    const currentIndex = formData.availableImages.findIndex(img => img === formData.fetchedImagePath);
    const nextIndex = (currentIndex + 1) % formData.availableImages.length;
    const nextImage = formData.availableImages[nextIndex];
    
    setFormData(prev => ({
      ...prev,
      fetchedImagePath: nextImage
    }));

    toast({
      title: "Image Changed",
      description: `Switched to image ${nextIndex + 1} of ${formData.availableImages.length}`,
    });
  };

  // Handle hashtag entry
  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const hashtag = formData.hashtags.trim();
      
      if (hashtag && formData.hashtagList.length < 10 && !formData.hashtagList.includes(hashtag)) {
        setFormData(prev => ({
          ...prev,
          hashtagList: [...prev.hashtagList, hashtag],
          hashtags: ''
        }));
      }
    }
  };

  const removeHashtag = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      hashtagList: prev.hashtagList.filter((_, index) => index !== indexToRemove)
    }));
  };

  // Handle privacy change
  const handlePrivacyChange = (newPrivacy: 'public' | 'friends' | 'private') => {
    setFormData(prev => ({ ...prev, privacy: newPrivacy }));
    if (newPrivacy !== 'private') {
      setTaggedUsers([]);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.primaryDescription.trim()) {
      toast({
        title: "Error",
        description: "Please add a description",
        variant: "destructive",
      });
      return;
    }

    // Only require image if no YouTube/Spotify URL is provided
    const hasMediaUrl = formData.youtubeUrl.trim() || formData.spotifyUrl.trim();
    if (!formData.primaryPhoto && !formData.fetchedImagePath && !hasMediaUrl) {
      toast({
        title: "Error", 
        description: "Please add an image or YouTube/Spotify link",
        variant: "destructive",
      });
      return;
    }

    const submitData = new FormData();
    
    // Basic post data
    submitData.append('primaryDescription', formData.primaryDescription);
    submitData.append('primaryLink', formData.primaryLink);
    submitData.append('linkLabel', formData.linkLabel);
    submitData.append('youtubeUrl', formData.youtubeUrl);
    submitData.append('youtubeLabel', formData.youtubeLabel);
    submitData.append('spotifyUrl', formData.spotifyUrl);
    submitData.append('spotifyLabel', formData.spotifyLabel);
    submitData.append('privacy', formData.privacy);
    submitData.append('discountCode', formData.discountCode);
    // Send hashtags as JSON array
    if (formData.hashtagList.length > 0) {
      submitData.append('hashtags', JSON.stringify(formData.hashtagList));
    }

    if (formData.listId) {
      submitData.append('listId', formData.listId);
    }

    if (formData.primaryPhoto) {
      submitData.append('primaryPhoto', formData.primaryPhoto);
    }

    if (formData.fetchedImagePath) {
      submitData.append('fetchedImagePath', formData.fetchedImagePath);
      if (formData.imageWidth) submitData.append('imageWidth', formData.imageWidth.toString());
      if (formData.imageHeight) submitData.append('imageHeight', formData.imageHeight.toString());
    }

    // Tagged users
    if (taggedUsers.length > 0) {
      submitData.append('taggedUsers', JSON.stringify(taggedUsers));
    }

    // Event data
    if (isEvent) {
      submitData.append('isEvent', 'true');
      if (eventDate) submitData.append('eventDate', eventDate);
      if (reminders.length > 0) submitData.append('reminders', JSON.stringify(reminders));
      if (isRecurring) {
        submitData.append('isRecurring', 'true');
        submitData.append('recurringType', recurringType);
      }
      if (taskList.length > 0) submitData.append('taskList', JSON.stringify(taskList));
      if (attachedLists.length > 0) submitData.append('attachedLists', JSON.stringify(attachedLists));
      if (allowRsvp) submitData.append('allowRsvp', 'true');
    }

    // Additional photos
    if (additionalPhotos.length > 0) {
      additionalPhotos.forEach((photo, index) => {
        submitData.append('additionalPhotos', photo.file);
        submitData.append(`additionalPhotoLink_${index}`, photo.link);
        submitData.append(`additionalPhotoLinkLabel_${index}`, photo.linkLabel);
        submitData.append(`additionalPhotoDescription_${index}`, photo.description);
        submitData.append(`additionalPhotoDiscountCode_${index}`, photo.discountCode);
      });
    }

    mutation.mutate(submitData);
  };

  // Event helper functions
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && eventTime) {
      const eventDateTime = new Date(date);
      const [hours, minutes] = eventTime.split(':');
      eventDateTime.setHours(parseInt(hours), parseInt(minutes));
      setEventDate(eventDateTime.toISOString());
    }
  };

  const handleReminderToggle = (reminder: string) => {
    setReminders(prev => {
      if (prev.includes(reminder)) {
        return prev.filter(r => r !== reminder);
      } else {
        if (formData.privacy === 'public' && prev.length >= 3) {
          return prev;
        }
        return [...prev, reminder];
      }
    });
  };

  const addTask = () => {
    if (!taskInput.trim()) return;
    
    const newTask = {
      id: Date.now().toString(),
      text: taskInput,
      completed: false
    };
    
    setTaskList(prev => [...prev, newTask]);
    setTaskInput('');
  };

  const removeTask = (taskId: string) => {
    setTaskList(prev => prev.filter(task => task.id !== taskId));
  };

  const generateCalendarUrl = (type: 'google' | 'apple') => {
    if (!selectedDate || !eventTime) return '#';
    
    const eventDateTime = new Date(selectedDate);
    const [hours, minutes] = eventTime.split(':');
    eventDateTime.setHours(parseInt(hours), parseInt(minutes));
    
    const startTime = eventDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endTime = new Date(eventDateTime.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    if (type === 'google') {
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(formData.primaryDescription)}&dates=${startTime}/${endTime}`;
    }
    
    return `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:${formData.primaryDescription}
END:VEVENT
END:VCALENDAR`;
  };

  // Additional photo helpers
  const addNewPhotoEntry = () => {
    if (additionalPhotos.length < 4) {
      const input = additionalFileRef.current;
      if (input) {
        input.click();
      }
    }
  };

  const removeAdditionalPhoto = (index: number) => {
    setAdditionalPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updateAdditionalPhoto = (index: number, field: string, value: string) => {
    setAdditionalPhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, [field]: value } : photo
    ));
  };

  // Friend helpers
  const toggleFriendTag = (friendId: number) => {
    setTaggedUsers(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const getTaggedFriendNames = () => {
    if (!friends || taggedUsers.length === 0) return '';
    
    const taggedNames = taggedUsers.map(userId => {
      const friend = friends.find((f: any) => f.id === userId);
      return friend ? friend.username : '';
    }).filter(Boolean);
    
    return taggedNames.join(', ');
  };

  const handleCreateList = () => {
    if (!newListName.trim()) return;

    const listData = {
      name: newListName,
      description: newListDescription,
      privacy: newListPrivacy,
      collaborators: newListPrivacy === 'private' ? newListCollaborators : []
    };

    createListMutation.mutate(listData);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-foreground">Create New Post</h1>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTutorial(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <span className="text-sm mr-1">?</span>
                Help
              </Button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Links Section - More Subtle */}
              <div className="space-y-3">
                {/* Primary Link */}
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Add a link (fetches image automatically)"
                      value={formData.primaryLink}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryLink: e.target.value }))}
                      className="bg-input border-border flex-1 text-sm"
                    />
                    <Button
                      type="button"
                      onClick={() => fetchImageFromUrl(formData.primaryLink)}
                      disabled={isLoadingImage || !formData.primaryLink.trim()}
                      variant="outline"
                      size="sm"
                      className="px-3"
                    >
                      {isLoadingImage ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                      ) : (
                        <Link className="h-3 w-3" />
                      )}
                    </Button>
                    
                    {/* Show cycling button when multiple images are available */}
                    {formData.availableImages.length > 1 && formData.fetchedImagePath && (
                      <Button
                        type="button"
                        onClick={cycleThroughImages}
                        variant="outline"
                        size="sm"
                        className="px-3"
                        title={`Cycle through ${formData.availableImages.length} available images`}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Show image counter when multiple images are available */}
                  {formData.availableImages.length > 1 && formData.fetchedImagePath && (
                    <div className="text-xs text-muted-foreground">
                      Image {formData.availableImages.findIndex(img => img === formData.fetchedImagePath) + 1} of {formData.availableImages.length}
                    </div>
                  )}
                  
                  <Input
                    placeholder="Link Label"
                    value={formData.linkLabel}
                    onChange={(e) => setFormData(prev => ({ ...prev, linkLabel: e.target.value }))}
                    className="bg-input border-border text-sm"
                  />
                </div>

                {/* YouTube and Spotify Icons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowYouTubeInput(!showYouTubeInput)}
                    className="p-2"
                  >
                    <Youtube className="h-4 w-4 text-red-500" />
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSpotifyInput(!showSpotifyInput)}
                    className="p-2"
                  >
                    <Music className="h-4 w-4 text-green-500" />
                  </Button>
                </div>

                {/* YouTube Link - Collapsible */}
                {showYouTubeInput && (
                  <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                    <div className="flex gap-2 items-center">
                      <Youtube className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <Label className="text-sm font-medium">YouTube</Label>
                    </div>
                    <Input
                      placeholder="YouTube URL"
                      value={formData.youtubeUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                      className="bg-input border-border text-sm"
                    />
                    <Input
                      placeholder="Link Label"
                      value={formData.youtubeLabel}
                      onChange={(e) => setFormData(prev => ({ ...prev, youtubeLabel: e.target.value }))}
                      className="bg-input border-border text-sm"
                    />
                  </div>
                )}

                {/* Spotify Link - Collapsible */}
                {showSpotifyInput && (
                  <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                    <div className="flex gap-2 items-center">
                      <Music className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <Label className="text-sm font-medium">Spotify</Label>
                    </div>
                    <Input
                      placeholder="Spotify URL"
                      value={formData.spotifyUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, spotifyUrl: e.target.value }))}
                      className="bg-input border-border text-sm"
                    />
                    <Input
                      placeholder="Link Label"
                      value={formData.spotifyLabel}
                      onChange={(e) => setFormData(prev => ({ ...prev, spotifyLabel: e.target.value }))}
                      className="bg-input border-border text-sm"
                    />
                  </div>
                )}
              </div>

              {/* 2. Photo Section */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Photo</Label>
                
                {/* Image Display */}
                {(formData.primaryPhoto || formData.fetchedImagePath) && (
                  <div className="relative">
                    <img
                      src={formData.fetchedImagePath ? formData.fetchedImagePath : URL.createObjectURL(formData.primaryPhoto!)}
                      alt="Preview"
                      className="w-full max-w-md rounded-lg border border-border"
                      style={{
                        maxHeight: '400px',
                        objectFit: 'contain'
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        primaryPhoto: null, 
                        fetchedImagePath: '',
                        fetchErrorMessage: ''
                      }))}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Error Message */}
                {formData.fetchErrorMessage && (
                  <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                    {formData.fetchErrorMessage}
                  </div>
                )}

                {/* Upload Button */}
                {!formData.primaryPhoto && !formData.fetchedImagePath && (
                  <Button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    variant="outline"
                    className="w-full border-border hover:bg-accent"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Media Preview */}
                {(formData.youtubeUrl || formData.spotifyUrl) && (
                  <div className="mt-4">
                    <MediaPlayer
                      youtubeUrl={formData.youtubeUrl}
                      spotifyUrl={formData.spotifyUrl}
                    />
                  </div>
                )}
              </div>

              {/* 3. Hashtags & Description Section */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Description & Hashtags</Label>
                <Textarea
                  placeholder="What's this about?"
                  value={formData.primaryDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryDescription: e.target.value }))}
                  className="bg-input border-border text-foreground min-h-[80px] text-sm"
                  required
                />
                <div className="space-y-2">
                  <Input
                    placeholder="Type hashtags and press Enter (up to 10)"
                    value={formData.hashtags || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, hashtags: e.target.value }))}
                    onKeyDown={handleHashtagKeyDown}
                    className="bg-input border-border text-sm"
                    disabled={formData.hashtagList.length >= 10}
                  />
                  
                  {/* Display selected hashtags */}
                  {formData.hashtagList.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-black rounded-md border border-gray-700">
                      {formData.hashtagList.map((tag, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1 h-6 px-2 text-xs bg-gray-800 text-gray-300 rounded border border-gray-600 hover:bg-gray-700"
                        >
                          #{tag}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHashtag(index)}
                            className="h-4 w-4 p-0 hover:bg-gray-600 text-gray-400 hover:text-white ml-1"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* 4. Post Settings */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <Label htmlFor="privacy" className="text-sm">Post</Label>
                      <Select
                        value={formData.privacy}
                        onValueChange={(value) => handlePrivacyChange(value as 'public' | 'friends' | 'private')}
                      >
                        <SelectTrigger className="w-32 h-8 text-sm bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="public">
                            <div className="flex items-center gap-2">
                              <Globe className="h-3 w-3" />
                              Public
                            </div>
                          </SelectItem>
                          <SelectItem value="friends">
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3" />
                              Connections
                            </div>
                          </SelectItem>
                          <SelectItem value="private">
                            <div className="flex items-center gap-2">
                              <Lock className="h-3 w-3" />
                              Private
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="mt-5 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEvent(!isEvent)}
                        className={`h-8 text-sm ${isEvent ? 'bg-purple-50 border-purple-300 text-purple-700' : ''}`}
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        {isEvent ? 'Event' : 'Event'}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFriendSelector(!showFriendSelector)}
                        className={`h-8 text-sm ${taggedUsers.length > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Tag ({taggedUsers.length})
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Lists Section */}
              <div>
                <Label htmlFor="category" className="text-sm">List</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.listId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, listId: value }))}
                  >
                    <SelectTrigger className="w-40 h-8 text-sm bg-input border-border">
                      <SelectValue placeholder="Select list" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {Array.isArray(lists) && lists.map((list: any) => (
                        <SelectItem key={list.id} value={list.id.toString()}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Dialog open={showNewListDialog} onOpenChange={setShowNewListDialog}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <FolderPlus className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-foreground">Create New List</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pr-2">
                        <div>
                          <Label htmlFor="listName">List Name *</Label>
                          <Input
                            id="listName"
                            placeholder="e.g., Christmas, Travel, Recipes"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            className="bg-input border-border"
                          />
                        </div>
                        <div>
                          <Label htmlFor="listDescription">Description (Optional)</Label>
                          <Textarea
                            id="listDescription"
                            placeholder="Describe this list..."
                            value={newListDescription}
                            onChange={(e) => setNewListDescription(e.target.value)}
                            className="bg-input border-border"
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor="listPrivacy">Privacy Level</Label>
                          <Select value={newListPrivacy} onValueChange={setNewListPrivacy}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Select privacy level" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              <SelectItem value="public">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-4 w-4 text-green-500" />
                                  <div>
                                    <div className="font-medium">Public</div>
                                    <div className="text-xs text-muted-foreground">Visible to everyone</div>
                                  </div>
                                </div>
                              </SelectItem>
                              <SelectItem value="connections">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-blue-500" />
                                  <div>
                                    <div className="font-medium">Connections Only</div>
                                    <div className="text-xs text-muted-foreground">Only your friends can see</div>
                                  </div>
                                </div>
                              </SelectItem>
                              <SelectItem value="private">
                                <div className="flex items-center gap-2">
                                  <Lock className="h-4 w-4 text-red-500" />
                                  <div>
                                    <div className="font-medium">Private</div>
                                    <div className="text-xs text-muted-foreground">Only you and invited collaborators</div>
                                  </div>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Collaborators section for private lists */}
                        {newListPrivacy === 'private' && (
                          <div>
                            <MultiSelectCollaborators
                              initialCollaborators={newListCollaborators}
                              onCollaboratorsChange={setNewListCollaborators}
                            />
                          </div>
                        )}
                        
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowNewListDialog(false)}
                            className="border-border"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleCreateList}
                            disabled={!newListName.trim() || createListMutation.isPending}
                            className="bg-pinterest-red hover:bg-red-700 text-white"
                          >
                            {createListMutation.isPending ? 'Creating...' : 'Create List'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* 6. Discount Code Option */}
              <div>
                <Input
                  placeholder="Discount code (optional)"
                  value={formData.discountCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountCode: e.target.value }))}
                  className="bg-input border-border text-sm"
                />
              </div>


              
              {formData.privacy === 'private' && taggedUsers.length > 0 && (
                <div className="text-xs text-gray-600">
                  Tagged: {getTaggedFriendNames()}
                </div>
              )}

              {/* Event Configuration */}
              {isEvent && (
                <div className="mt-6 p-4 bg-black border border-purple-400 rounded-lg space-y-4">
                  <h3 className="text-lg font-semibold text-purple-300 flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Event Details
                  </h3>
                  
                  {/* Event Date & Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-purple-200">Event Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-gray-800 border-purple-300 text-white"
                          >
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            {selectedDate ? selectedDate.toDateString() : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-card" align="start">
                          <DayPicker
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleDateSelect}
                            disabled={{ before: new Date() }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div>
                      <Label className="text-purple-200">Event Time</Label>
                      <Input
                        type="time"
                        value={eventTime}
                        onChange={(e) => {
                          setEventTime(e.target.value);
                          if (selectedDate) {
                            const eventDateTime = new Date(selectedDate);
                            const [hours, minutes] = e.target.value.split(':');
                            eventDateTime.setHours(parseInt(hours), parseInt(minutes));
                            setEventDate(eventDateTime.toISOString());
                          }
                        }}
                        className="bg-gray-800 border-purple-300 text-white"
                      />
                    </div>
                  </div>

                  {/* Calendar Export Buttons */}
                  {selectedDate && eventTime && (
                    <div className="flex gap-2">
                      <a
                        href={generateCalendarUrl('google')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Add to Google Calendar
                      </a>
                      <a
                        href={generateCalendarUrl('apple')}
                        download="event.ics"
                        className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                      >
                        Download .ics file
                      </a>
                    </div>
                  )}

                  {/* Event Reminders */}
                  <div>
                    <Label className="text-purple-200">Event Reminders {formData.privacy === 'public' ? '(Pick up to 3)' : ''}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['1_month', '2_weeks', '1_week', '3_days', '1_day'].map((reminderValue) => {
                        const reminderLabel = {
                          '1_month': '1 month',
                          '2_weeks': '2 weeks', 
                          '1_week': '1 week',
                          '3_days': '3 days',
                          '1_day': '1 day'
                        }[reminderValue];
                        
                        const isSelected = reminders.includes(reminderValue);
                        const canSelect = formData.privacy !== 'public' || reminders.length < 3 || isSelected;
                        
                        return (
                          <Button
                            key={reminderValue}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleReminderToggle(reminderValue)}
                            disabled={!canSelect}
                            className={`text-xs ${isSelected ? 'bg-purple-600' : ''} ${!canSelect ? 'opacity-50' : ''}`}
                          >
                            {reminderLabel}
                          </Button>
                        );
                      })}
                    </div>
                    {formData.privacy === 'public' && reminders.length >= 3 && (
                      <p className="text-xs text-purple-300 mt-1">Maximum 3 reminders for public events</p>
                    )}
                  </div>

                  {/* Recurring Options */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="recurring"
                      checked={isRecurring}
                      onCheckedChange={(checked) => setIsRecurring(checked === true)}
                      className="border-purple-300"
                    />
                    <Label htmlFor="recurring" className="text-purple-200 text-sm">
                      Recurring Event
                    </Label>
                  </div>

                  {isRecurring && (
                    <div>
                      <Label className="text-purple-200">Repeat</Label>
                      <Select value={recurringType} onValueChange={(value: string) => setRecurringType(value as 'weekly' | 'monthly' | 'annually' | '')}>
                        <SelectTrigger className="bg-gray-800 border-purple-300 text-white">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Task List */}
                  <div>
                    <Label className="text-purple-200">Event Tasks</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a task (press Enter)"
                          value={taskInput}
                          onChange={(e) => setTaskInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTask();
                            }
                          }}
                          className="bg-gray-800 border-purple-300 text-white flex-1"
                        />
                        <Button
                          type="button"
                          onClick={addTask}
                          size="sm"
                          variant="outline"
                          className="border-purple-300"
                        >
                          Add
                        </Button>
                      </div>
                      
                      {taskList.length > 0 && (
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {taskList.map((task, index) => (
                            <div key={task.id} className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                              <span className="text-white text-sm flex-1">{task.text}</span>
                              <Button
                                type="button"
                                onClick={() => removeTask(task.id)}
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* List Attachment */}
                  <div>
                    <Label className="text-purple-200">Attach Lists (Optional)</Label>
                    <div className="space-y-2">
                      <Select
                        value=""
                        onValueChange={(value) => {
                          const listId = parseInt(value);
                          if (!attachedLists.includes(listId)) {
                            setAttachedLists([...attachedLists, listId]);
                          }
                        }}
                      >
                        <SelectTrigger className="bg-gray-800 border-purple-300 text-white">
                          <SelectValue placeholder="Select lists to attach" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {Array.isArray(lists) && lists
                            .filter((list: any) => !attachedLists.includes(list.id))
                            .map((list: any) => (
                              <SelectItem key={list.id} value={list.id.toString()}>
                                {list.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      
                      {attachedLists.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {attachedLists.map((listId) => {
                            const list = Array.isArray(lists) ? lists.find((l: any) => l.id === listId) : null;
                            if (!list) return null;
                            
                            return (
                              <div key={listId} className="flex items-center gap-1 bg-purple-600 text-white px-2 py-1 rounded text-sm">
                                <span>{list.name}</span>
                                <button
                                  type="button"
                                  onClick={() => setAttachedLists(attachedLists.filter(id => id !== listId))}
                                  className="ml-1 hover:text-red-300"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RSVP Toggle */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowRsvp"
                      checked={allowRsvp}
                      onCheckedChange={(checked) => setAllowRsvp(checked === true)}
                      className="border-purple-300"
                    />
                    <Label htmlFor="allowRsvp" className="text-purple-200 text-sm">
                      Allow RSVP responses
                    </Label>
                  </div>
                </div>
              )}

              {/* Friend Selector Dialog */}
              <Dialog open={showFriendSelector} onOpenChange={setShowFriendSelector}>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Tag Connections</DialogTitle>
                  </DialogHeader>
                  <FriendSelector
                    onSelectionChange={setTaggedUsers}
                    initialSelection={taggedUsers}
                  />
                </DialogContent>
              </Dialog>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-pinterest-red hover:bg-red-700 text-white py-3"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating Post...</span>
                  </div>
                ) : (
                  'Create Post'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tutorial Component */}
        <CreatePostTutorial 
          isOpen={showTutorial} 
          onClose={() => setShowTutorial(false)} 
        />
      </div>
    </div>
  );
};