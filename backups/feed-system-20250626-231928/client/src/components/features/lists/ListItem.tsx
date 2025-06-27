import React from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { 
  List, 
  Users, 
  Lock, 
  Globe, 
  MoreHorizontal,
  Edit,
  Trash2,
  Share2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../../hooks/queries/useAuth';
import { useLists } from '../../../hooks/queries/useLists';
import { LoadingSkeleton } from '../../common/LoadingSkeleton';
import { EmptyState } from '../../common/EmptyState';

interface ListItemProps {
  listId: string;
  variant?: 'default' | 'compact';
  showActions?: boolean;
  onClick?: () => void;
}

export function ListItem({ 
  listId, 
  variant = 'default', 
  showActions = true,
  onClick 
}: ListItemProps) {
  const { user } = useAuth();
  const { data: list, isLoading, error } = useLists().getList(listId);
  const { data: collaborators } = useLists().getListCollaborators(listId);
  
  const isOwnList = user?.uid === list?.userId;
  const isCollaborator = collaborators?.some(collab => collab.userId === user?.uid);

  if (isLoading) {
    return <LoadingSkeleton.ListSkeleton />;
  }

  if (error || !list) {
    return (
      <EmptyState
        title="List not found"
        description="This list could not be loaded."
      />
    );
  }

  const getPrivacyIcon = () => {
    switch (list.privacy) {
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'connections':
        return <Users className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getPrivacyLabel = () => {
    switch (list.privacy) {
      case 'private':
        return 'Private';
      case 'connections':
        return 'Connections';
      default:
        return 'Public';
    }
  };

  return (
    <Card 
      className={`${variant === 'compact' ? 'p-3' : ''} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardHeader className={`${variant === 'compact' ? 'p-0 pb-3' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <List className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold truncate">{list.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {getPrivacyIcon()}
                  <span className="ml-1">{getPrivacyLabel()}</span>
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {list.description || 'No description'}
              </p>
            </div>
          </div>
          
          {showActions && (isOwnList || isCollaborator) && (
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className={`${variant === 'compact' ? 'p-0' : ''}`}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>{list.itemCount || 0} items</span>
            {collaborators && collaborators.length > 0 && (
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{collaborators.length} collaborators</span>
              </div>
            )}
          </div>
          <span>{formatDistanceToNow(new Date(list.updatedAt), { addSuffix: true })}</span>
        </div>

        {variant !== 'compact' && collaborators && collaborators.length > 0 && (
          <div className="mt-3 flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">Collaborators:</span>
            <div className="flex -space-x-2">
              {collaborators.slice(0, 3).map((collaborator) => (
                <Avatar key={collaborator.userId} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={collaborator.profileImage} alt={collaborator.displayName} />
                  <AvatarFallback className="text-xs">
                    {collaborator.displayName?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              ))}
              {collaborators.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                  +{collaborators.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
