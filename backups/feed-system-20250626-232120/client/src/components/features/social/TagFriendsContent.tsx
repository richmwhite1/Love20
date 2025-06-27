import React from 'react';
import { Badge } from '../../ui/badge';
import { Users } from 'lucide-react';

interface TagFriendsContentProps {
  taggedFriends: any[];
}

export function TagFriendsContent({ taggedFriends }: TagFriendsContentProps) {
  if (!taggedFriends || taggedFriends.length === 0) return null;

  return (
    <div className="flex items-center space-x-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Tagged:</span>
      <div className="flex flex-wrap gap-1">
        {taggedFriends.map((friend) => (
          <Badge key={friend.id} variant="secondary" className="text-xs">
            {friend.displayName || friend.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
