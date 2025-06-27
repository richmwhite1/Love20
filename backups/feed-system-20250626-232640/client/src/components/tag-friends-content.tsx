import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Search, UserPlus } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Friend {
  id: number;
  username: string;
  name: string;
  profilePictureUrl?: string;
}

interface TagFriendsContentProps {
  postId: string;
  onTaggedFriendsChange?: (taggedFriends: string[]) => void;
}

export default function TagFriendsContent({ postId, onTaggedFriendsChange }: TagFriendsContentProps) {
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, getIdToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's friends
  const { data: friends = [] } = useQuery({
    queryKey: ['/api/connections'],
    queryFn: async () => {
      const token = await getIdToken();
      const response = await fetch('/api/connections', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch friends');
      }
      return response.json();
    },
  });

  const filteredFriends = friends.filter((friend: any) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFriendToggle = (friendId: string) => {
    const newSelected = selectedFriends.includes(friendId)
      ? selectedFriends.filter(id => id !== friendId)
      : [...selectedFriends, friendId];
    
    setSelectedFriends(newSelected);
    onTaggedFriendsChange?.(newSelected);
  };

  // Tag friends mutation
  const tagMutation = useMutation({
    mutationFn: async (friendIds: string[]) => {
      const token = await getIdToken();
      const promises = friendIds.map(friendId =>
        fetch(`/api/posts/${postId}/tag-friend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ friendId }),
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Friends tagged",
        description: `Tagged ${selectedFriends.length} friend(s) in this post`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to tag friends. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTagFriends = () => {
    if (selectedFriends.length === 0) {
      toast({
        title: "No friends selected",
        description: "Please select at least one friend to tag",
        variant: "destructive",
      });
      return;
    }
    tagMutation.mutate(selectedFriends);
  };

  if (friends.length === 0) {
    return (
      <div className="p-4 text-center">
        <UserPlus className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-300 mb-4">You don't have any connections yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search connections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-gray-800 border-gray-600 text-white"
        />
      </div>

      {/* Connections list */}
      <div className="max-h-64 overflow-y-auto mb-4">
        {filteredFriends.map((friend: { id: string; name: string; username: string; profilePictureUrl?: string }) => (
          <div key={friend.id} className="flex items-center space-x-3 p-3 hover:bg-gray-700/50 rounded-lg">
            <Checkbox
              id={`friend-${friend.id}`}
              checked={selectedFriends.includes(friend.id)}
              onCheckedChange={() => handleFriendToggle(friend.id)}
            />
            <div className="flex items-center space-x-3 flex-1">
              <Avatar className="w-8 h-8">
                <AvatarImage src={friend.profilePictureUrl} />
                <AvatarFallback>{friend.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-gray-300">{friend.name}</p>
                <p className="text-xs text-gray-500">@{friend.username}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFriends.length === 0 && searchQuery && (
        <div className="text-center py-4">
          <p className="text-gray-400">No friends found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleTagFriends}
          disabled={selectedFriends.length === 0 || tagMutation.isPending}
          className="flex-1 bg-purple-600 hover:bg-purple-700"
        >
          {tagMutation.isPending ? "Tagging..." : `Tag ${selectedFriends.length} Friend(s)`}
        </Button>
      </div>
    </div>
  );
}