import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, X, Upload, ExternalLink, Image } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Header from "@/components/header-simple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

// Create post schema
const createPostSchema = z.object({
  primaryLink: z.string().url("Please enter a valid URL"),
  primaryDescription: z.string().min(1, "Description is required").max(1000, "Description must be less than 1000 characters"),
  primaryPhotoUrl: z.string().optional(),
  additionalPhotos: z.array(z.string()).optional(),
});

interface CreatePostFormData {
  primaryLink: string;
  primaryDescription: string;
  primaryPhoto: FileList;
  additionalPhotos?: FileList;
  listId: string;
}

export default function CreatePostPage() {
  const [additionalPhotoFields, setAdditionalPhotoFields] = useState<number[]>([]);
  const [primaryPhotoPreview, setPrimaryPhotoPreview] = useState<string | null>(null);
  const [additionalPhotoPreviews, setAdditionalPhotoPreviews] = useState<{ [key: number]: string }>({});
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  
  const { isAuthenticated, user, getIdToken } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect if not authenticated - watch for auth state changes
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const form = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema.extend({
      primaryPhoto: createPostSchema.shape.primaryPhotoUrl.refine(() => true, "Primary photo is required"),
      additionalPhotos: createPostSchema.shape.additionalPhotos.optional(),
    })),
    defaultValues: {
      primaryLink: "",
      primaryDescription: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreatePostFormData) => {
      const formData = new FormData();
      formData.append('primaryLink', data.primaryLink);
      formData.append('primaryDescription', data.primaryDescription);
      
      if (data.primaryPhoto && data.primaryPhoto.length > 0) {
        formData.append('primaryPhoto', data.primaryPhoto[0]);
      }
      
      if (data.additionalPhotos) {
        for (let i = 0; i < data.additionalPhotos.length; i++) {
          formData.append('additionalPhotos', data.additionalPhotos[i]);
        }
      }

      // Get Firebase ID token for authentication
      const token = await getIdToken();
      
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create post');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      toast({
        title: "Post created!",
        description: "Your post has been shared successfully.",
      });
      setLocation(`/post/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to create post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create list mutation
  const createListMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; privacy: 'public' | 'connections' | 'private' }) => {
      const token = await getIdToken();
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create list');
      }

      return response.json();
    },
    onSuccess: (newList) => {
      toast({
        title: "List created",
        description: "Your new list has been created successfully",
      });
      setShowCreateList(false);
      setNewListName("");
      form.setValue('listId', newList.id);
      queryClient.invalidateQueries({ queryKey: [`/api/lists/user/${user?.id}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create list. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch lists for the current user - fixed endpoint
  const { data: lists = [], isLoading: listsLoading } = useQuery({
    queryKey: [`/api/lists/user/${user?.id}`],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      const response = await fetch(`/api/lists/user/${user?.id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch lists");
      }
      return response.json();
    },
    enabled: !!user && !!getIdToken,
  });

  const handlePrimaryPhotoChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        setPrimaryPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPrimaryPhotoPreview(null);
    }
  };

  const handleAdditionalPhotoChange = (index: number, files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        setAdditionalPhotoPreviews(prev => ({
          ...prev,
          [index]: e.target?.result as string,
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setAdditionalPhotoPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[index];
        return newPreviews;
      });
    }
  };

  const addPhotoField = () => {
    if (additionalPhotoFields.length < 4) {
      setAdditionalPhotoFields(prev => [...prev, Date.now()]);
    }
  };

  const removePhotoField = (index: number) => {
    setAdditionalPhotoFields(prev => prev.filter((_, i) => i !== index));
    setAdditionalPhotoPreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[index];
      return newPreviews;
    });
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your list",
        variant: "destructive",
      });
      return;
    }
    createListMutation.mutate({
      name: newListName.trim(),
      description: "Created from post creation",
      privacy: 'public'
    });
  };

  return (
    <div className="min-h-screen bg-surface-gray">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card className="bg-white rounded-2xl pinterest-shadow overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Create New Post
            </CardTitle>
            <p className="text-pinterest-gray">
              Share something amazing with the community
            </p>
          </CardHeader>

          <CardContent>
            {listsLoading ? (
              <div className="text-center text-gray-500">Loading lists...</div>
            ) : lists.length === 0 ? (
              <div className="text-center space-y-4">
                <div className="text-gray-500">
                  <p className="mb-4">You have no lists. Please create a list before posting.</p>
                  {showCreateList ? (
                    <div className="max-w-md mx-auto space-y-4">
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="Enter list name"
                        className="w-full p-2 border border-gray-300 rounded text-gray-900"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCreateList}
                          disabled={!newListName.trim() || createListMutation.isPending}
                          className="flex-1 bg-pinterest-red text-white hover:bg-red-700"
                        >
                          {createListMutation.isPending ? "Creating..." : "Create List"}
                        </Button>
                        <Button
                          onClick={() => setShowCreateList(false)}
                          variant="outline"
                          className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowCreateList(true)}
                      className="bg-pinterest-red text-white hover:bg-red-700"
                    >
                      Create Your First List
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
                  {/* List Selector */}
                  <FormField
                    control={form.control}
                    name="listId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>List *</FormLabel>
                        <FormControl>
                          <select {...field} className="w-full border rounded p-2">
                            <option value="">Select a list</option>
                            {lists.map((list: any) => (
                              <option key={list.id} value={list.id}>{list.name}</option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Primary Photo Upload */}
                  <FormField
                    control={form.control}
                    name="primaryPhoto"
                    render={({ field: { onChange } }) => (
                      <FormItem>
                        <FormLabel>Primary Photo *</FormLabel>
                        <FormControl>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-pinterest-red transition-colors">
                            {primaryPhotoPreview ? (
                              <div className="relative">
                                <img
                                  src={primaryPhotoPreview}
                                  alt="Primary photo preview"
                                  className="max-w-full h-48 object-cover mx-auto rounded-lg"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={() => {
                                    onChange(null);
                                    setPrimaryPhotoPreview(null);
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                                <p className="text-sm text-gray-500">JPEG or PNG, max 5MB</p>
                              </>
                            )}
                            <Input
                              type="file"
                              accept="image/jpeg,image/png"
                              className="hidden"
                              onChange={(e) => {
                                onChange(e.target.files);
                                handlePrimaryPhotoChange(e.target.files);
                              }}
                              value=""
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Primary Link */}
                  <FormField
                    control={form.control}
                    name="primaryLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link URL *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <ExternalLink className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <Input
                              type="url"
                              placeholder="https://example.com"
                              className="pl-10 focus:ring-2 focus:ring-pinterest-red focus:border-transparent"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="primaryDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your post..."
                            className="resize-none focus:ring-2 focus:ring-pinterest-red focus:border-transparent"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-1">
                          {field.value.length}/500 characters
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Additional Photos */}
                  <div>
                    <FormLabel>Additional Photos (Optional)</FormLabel>
                    <div className="space-y-4 mt-2">
                      {additionalPhotoFields.map((fieldId, index) => (
                        <div key={fieldId} className="relative border-2 border-dashed border-gray-300 rounded-lg p-4">
                          {additionalPhotoPreviews[index] ? (
                            <div className="relative">
                              <img
                                src={additionalPhotoPreviews[index]}
                                alt={`Additional photo ${index + 1} preview`}
                                className="max-w-full h-32 object-cover mx-auto rounded-lg"
                              />
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-600">Upload additional photo</p>
                            </div>
                          )}
                          <Input
                            type="file"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            onChange={(e) => handleAdditionalPhotoChange(index, e.target.files)}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => removePhotoField(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      
                      {additionalPhotoFields.length < 4 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addPhotoField}
                          className="w-full border-dashed border-gray-300 hover:border-pinterest-red"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add another photo (up to {4 - additionalPhotoFields.length} more)
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex space-x-4 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setLocation('/')}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-pinterest-red text-white hover:bg-red-700"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? 'Creating...' : 'Create Post'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
