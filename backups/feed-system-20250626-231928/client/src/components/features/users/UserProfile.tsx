import React from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { 
  User, 
  MapPin, 
  Calendar, 
  Users, 
  MessageSquare,
  Heart,
  Settings,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../../hooks/queries/useAuth';
import { useConnections } from '../../../hooks/queries/useConnections';
import { LoadingSkeleton } from '../../common/LoadingSkeleton';
import { EmptyState } from '../../common/EmptyState';

interface UserProfileProps {
  userId: string;
  variant?: 'default' | 'compact';
  showActions?: boolean;
}

export function UserProfile({ userId, variant = 'default', showActions = true }: UserProfileProps) {
  const { user: currentUser } = useAuth();
  const { data: user, isLoading, error } = useConnections().getUserProfile(userId);
  const { data: connections } = useConnections().getUserConnections(userId);
  
  const isOwnProfile = currentUser?.uid === userId;
  const isConnected = connections?.some(conn => conn.userId === currentUser?.uid);

  if (isLoading) {
    return <LoadingSkeleton.UserProfileSkeleton />;
  }

  if (error || !user) {
    return (
      <EmptyState
        title="User not found"
        description="This user profile could not be loaded."
      />
    );
  }

  return (
    <Card className={variant === 'compact' ? 'p-4' : ''}>
      <CardHeader className={variant === 'compact' ? 'p-0 pb-4' : ''}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.profileImage} alt={user.displayName} />
              <AvatarFallback>
                {user.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h2 className="text-xl font-semibold">{user.displayName}</h2>
                {user.isVerified && (
                  <Badge variant="secondary">Verified</Badge>
                )}
              </div>
              {user.username && (
                <p className="text-muted-foreground">@{user.username}</p>
              )}
              {user.bio && (
                <p className="text-sm mt-2">{user.bio}</p>
              )}
            </div>
          </div>
          
          {showActions && (
            <div className="flex space-x-2">
              {isOwnProfile ? (
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                  <Button 
                    variant={isConnected ? "secondary" : "default"}
                    size="sm"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {isConnected ? 'Connected' : 'Connect'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className={variant === 'compact' ? 'p-0' : ''}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{user.postCount || 0}</div>
            <div className="text-sm text-muted-foreground">Posts</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{connections?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Connections</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{user.likeCount || 0}</div>
            <div className="text-sm text-muted-foreground">Likes</div>
          </div>
        </div>

        {variant !== 'compact' && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              {user.location && (
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{user.location}</span>
                </div>
              )}
              {user.joinedAt && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Joined {format(new Date(user.joinedAt), 'MMMM yyyy')}</span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
