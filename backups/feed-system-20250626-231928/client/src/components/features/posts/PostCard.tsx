import React from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  MoreHorizontal,
  Calendar,
  MapPin,
  Users
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePostActions } from '../../../hooks/features/usePostActions';
import { useAuth } from '../../../hooks/queries/useAuth';
import { Post } from '../../../types/post';
import { PostActionsMenu } from './PostActionsMenu';
import { ImageGallery } from '../media/ImageGallery';
import { EventDateOverlay } from '../events/EventDateOverlay';
import { TagFriendsContent } from '../social/TagFriendsContent';
import { EnergyRating } from '../ratings/EnergyRating';

interface PostCardProps {
  post: Post;
  onPostUpdate?: (updatedPost: Post) => void;
  showActions?: boolean;
  variant?: 'default' | 'compact';
}

export function PostCard({ 
  post, 
  onPostUpdate, 
  showActions = true,
  variant = 'default' 
}: PostCardProps) {
  const { user } = useAuth();
  const {
    isLiked,
    isSaved,
    likeCount,
    commentCount,
    shareCount,
    handleLike,
    handleSave,
    handleShare,
    isLoading
  } = usePostActions(post.id, post);

  const isOwnPost = user?.uid === post.userId;
  const isEvent = post.type === 'event';
  const hasLocation = post.location && post.location.trim() !== '';

  const handlePostUpdate = (updatedPost: Post) => {
    onPostUpdate?.(updatedPost);
  };

  return (
    <Card className={`${variant === 'compact' ? 'p-3' : ''}`}>
      <CardHeader className={`${variant === 'compact' ? 'p-0 pb-3' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.user?.profileImage} alt={post.user?.displayName} />
              <AvatarFallback>
                {post.user?.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="font-semibold text-sm truncate">
                  {post.user?.displayName || 'Unknown User'}
                </p>
                {post.user?.isVerified && (
                  <Badge variant="secondary" className="text-xs">Verified</Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                {post.privacy && (
                  <span>• {post.privacy}</span>
                )}
              </div>
            </div>
          </div>
          
          {showActions && (
            <PostActionsMenu 
              post={post} 
              isOwnPost={isOwnPost}
              onPostUpdate={handlePostUpdate}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className={`${variant === 'compact' ? 'p-0' : ''}`}>
        {/* Post Content */}
        {post.content && (
          <div className="mb-4">
            <p className="text-sm whitespace-pre-wrap">{post.content}</p>
          </div>
        )}

        {/* Event Details */}
        {isEvent && post.eventDetails && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Event Details</span>
            </div>
            <EventDateOverlay event={post.eventDetails} />
            {hasLocation && (
              <div className="flex items-center space-x-2 mt-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{post.location}</span>
              </div>
            )}
            {post.eventDetails.maxAttendees && (
              <div className="flex items-center space-x-2 mt-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {post.eventDetails.attendees?.length || 0} / {post.eventDetails.maxAttendees} attending
                </span>
              </div>
            )}
          </div>
        )}

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className="mb-4">
            <ImageGallery images={post.media} />
          </div>
        )}

        {/* Tagged Friends */}
        {post.taggedFriends && post.taggedFriends.length > 0 && (
          <div className="mb-4">
            <TagFriendsContent taggedFriends={post.taggedFriends} />
          </div>
        )}

        {/* Energy Rating */}
        {post.energyRating && (
          <div className="mb-4">
            <EnergyRating rating={post.energyRating} />
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {post.hashtags.map((hashtag) => (
              <Badge key={hashtag} variant="outline" className="text-xs">
                #{hashtag}
              </Badge>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {showActions && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={isLoading}
                className={`flex items-center space-x-1 ${
                  isLiked ? 'text-red-500' : 'text-muted-foreground'
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>{likeCount}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-1 text-muted-foreground"
              >
                <MessageSquare className="h-4 w-4" />
                <span>{commentCount}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                disabled={isLoading}
                className="flex items-center space-x-1 text-muted-foreground"
              >
                <Share2 className="h-4 w-4" />
                <span>{shareCount}</span>
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isLoading}
              className={`${isSaved ? 'text-blue-500' : 'text-muted-foreground'}`}
            >
              {isSaved ? 'Saved' : 'Save'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 