import { Heart } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface FeedLikeButtonProps {
  postId: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
}

export default function FeedLikeButton({ postId }: FeedLikeButtonProps) {
  const { isAuthenticated, getIdToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get like status
  const { data: userLike } = useQuery<boolean>({
    queryKey: [`/api/posts/${postId}/like`],
    queryFn: getQueryFn({ on401: "returnNull", getToken: getIdToken }),
    enabled: isAuthenticated,
  });

  // Get like count
  const { data: stats } = useQuery<{ likeCount: number; commentCount: number; shareCount: number }>({
    queryKey: [`/api/posts/${postId}/stats`],
    queryFn: getQueryFn({ on401: "returnNull", getToken: getIdToken }),
  });

  // Like/unlike mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      if (userLike) {
        return apiRequest('DELETE', `/api/posts/${postId}/like`, undefined, token);
      } else {
        return apiRequest('POST', `/api/posts/${postId}/like`, undefined, token);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/stats`] });
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/like`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Please log in to like posts",
        variant: "destructive",
      });
    },
  });

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast({
        title: "Login required",
        description: "Please log in to like posts",
        variant: "destructive",
      });
      return;
    }
    
    likeMutation.mutate();
  };

  return (
    <button
      onClick={handleLike}
      className={`flex items-center space-x-1 transition-colors ${
        userLike ? 'text-red-500' : 'text-white hover:text-red-400'
      }`}
      disabled={likeMutation.isPending}
    >
      <Heart className={`w-4 h-4 ${userLike ? 'fill-current' : ''}`} />
      <span>{stats?.likeCount || 0}</span>
    </button>
  );
}