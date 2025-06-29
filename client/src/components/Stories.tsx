import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import AuricField from '@/components/auric-field';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface Story {
  user: {
    id: number;
    username: string;
    name: string;
    profilePictureUrl?: string;
  };
  posts: Array<{
    id: number;
    primaryPhotoUrl?: string;
    primaryDescription: string;
    createdAt: string;
    user: {
      id: number;
      username: string;
      name: string;
      profilePictureUrl?: string;
    };
    list?: {
      id: number;
      name: string;
    };
  }>;
  hasUnseen: boolean;
}

interface StoriesProps {
  users: Array<{
    id: string;
    name: string;
    username: string;
    profilePictureUrl?: string;
    hasNewStory?: boolean;
  }>;
  onSelectUser?: (userId: string) => void;
  onMarkAsViewed?: (userId: string) => void;
  onAllStoriesViewed?: () => void;
}

function StoriesInner({ users, onSelectUser, onMarkAsViewed, onAllStoriesViewed }: StoriesProps) {
  const { data, isLoading, error } = useQuery<Story[]>({
    queryKey: ['/api/connection-stories'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Defensive: always use array
  const stories = Array.isArray(data) ? data : (data?.data ?? []);

  console.log('[Stories] Mount', { stories, isLoading, error });

  // Deduplicate stories by user ID and filter out viewed users
  const uniqueStories = stories.reduce((acc: Story[], story) => {
    if (!acc.find(s => s.user.id === story.user.id)) {
      acc.push(story);
    }
    return acc;
  }, []);
  
  const unviewedStories = uniqueStories.filter(story => 
    !users.some(u => u.id === story.user.id.toString())
  );

  // Call callback when all stories are viewed
  useEffect(() => {
    if (unviewedStories.length === 0 && onAllStoriesViewed) {
      onAllStoriesViewed();
    }
  }, [unviewedStories.length, onAllStoriesViewed]);

  const handleStoryClick = (story: Story) => {
    onSelectUser?.(story.user.id.toString());
    onMarkAsViewed?.(story.user.id.toString());
  };

  if (isLoading) {
    console.log('[Stories] Loading...');
    return (
      <div className="bg-black border-b border-gray-700 p-4">
        <div className="flex space-x-4 overflow-x-auto scrollbar-hide stories-scroll">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-shrink-0">
              <div className="flex flex-col items-center space-y-1">
                <div className="w-16 h-16 bg-gray-800 rounded-full animate-pulse" />
                <div className="w-12 h-3 bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    console.error('[Stories] Error:', error);
    return <div className="text-red-500 p-4">Failed to load stories.</div>;
  }

  // Don't render anything if there are no unviewed stories
  if (unviewedStories.length === 0) {
    return null;
  }

  return (
    <>
      {/* Stories Bar */}
      <div className="bg-black border-b border-gray-700 p-4">
        <div className="flex space-x-4 overflow-x-auto scrollbar-hide stories-scroll">
          {unviewedStories.map((story: Story) => (
            <div
              key={story.user.id}
              className="flex-shrink-0 cursor-pointer"
              onClick={() => handleStoryClick(story)}
            >
              <div className="flex flex-col items-center space-y-1">
                <div className="p-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <AuricField profileId={story.user.id} intensity={0.3}>
                    <Avatar className="w-16 h-16 border-2 border-black">
                      <AvatarImage 
                        src={story.user.profilePictureUrl} 
                        alt={story.user.name}
                      />
                      <AvatarFallback className="bg-gray-700 text-white text-sm">
                        {story.user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </AuricField>
                </div>
                <span className="text-xs text-white text-center w-16 truncate">
                  {story.user.username}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function Stories(props: StoriesProps) {
  return (
    <ErrorBoundary>
      <StoriesInner {...props} />
    </ErrorBoundary>
  );
}