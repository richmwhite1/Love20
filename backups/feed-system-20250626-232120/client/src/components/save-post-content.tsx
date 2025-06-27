import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { getQueryFn } from "@/lib/queryClient";
import { Bookmark, Plus } from "lucide-react";

interface List {
  id: string;
  name: string;
  description?: string;
}

interface SavePostContentProps {
  postId: string;
  initialSaved?: boolean;
  initialSaveCount?: number;
  onClose: () => void;
}

export default function SavePostContent({ postId, onClose }: SavePostContentProps) {
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const { toast } = useToast();
  const { user, getIdToken } = useAuth();
  const queryClient = useQueryClient();

  // Get user's lists
  const { data: lists = [], isLoading } = useQuery<List[]>({
    queryKey: [`/api/lists/user/${user?.id}`],
    queryFn: getQueryFn({ on401: "returnNull", getToken: getIdToken }),
    enabled: !!user,
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
      setSelectedListId(newList.id);
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

  // Save post mutation
  const saveMutation = useMutation({
    mutationFn: async (listId: string) => {
      const token = await getIdToken();
      const response = await fetch(`/api/posts/${postId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ listId }),
      });

      if (!response.ok) {
        throw new Error('Failed to save post');
      }
    },
    onSuccess: () => {
      toast({
        title: "Post saved",
        description: "Post has been saved to your collection",
        duration: 2000, // Auto-dismiss after 2 seconds
      });
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-posts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts/list'] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSavePost = () => {
    if (!selectedListId) {
      toast({
        title: "List required",
        description: "Please select a list to save this post",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(selectedListId);
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
      description: "Created from post save dialog",
      privacy: 'public'
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-300">Loading lists...</p>
      </div>
    );
  }

  if (showCreateList) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <label className="block text-white font-medium mb-2">
            Create New List
          </label>
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Enter list name"
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleCreateList}
            disabled={!newListName.trim() || createListMutation.isPending}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {createListMutation.isPending ? "Creating..." : "Create List"}
          </Button>
          <Button
            onClick={() => setShowCreateList(false)}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!lists || lists.length === 0) {
    return (
      <div className="p-4 text-center">
        <Bookmark className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-300 mb-4">You don't have any lists yet.</p>
        <p className="text-gray-400 text-sm mb-4">Create lists to organize your saved posts.</p>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowCreateList(true)} 
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create List
          </Button>
          <Button onClick={onClose} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <label className="block text-white font-medium mb-2">
          Save to List
        </label>
        <Select value={selectedListId} onValueChange={setSelectedListId}>
          <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
            <SelectValue placeholder="Select a list" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-600">
            {lists.map((list) => (
              <SelectItem 
                key={list.id} 
                value={list.id}
                className="text-white hover:bg-gray-700"
              >
                {list.name}
                {list.description && (
                  <span className="text-gray-400 text-sm ml-2">
                    - {list.description}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSavePost}
          disabled={!selectedListId || saveMutation.isPending}
          className="flex-1 bg-purple-600 hover:bg-purple-700"
        >
          {saveMutation.isPending ? "Saving..." : "Save Post"}
        </Button>
        <Button
          onClick={() => setShowCreateList(true)}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-800"
        >
          <Plus className="h-4 w-4 mr-2" />
          New List
        </Button>
        <Button
          onClick={onClose}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-800"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}