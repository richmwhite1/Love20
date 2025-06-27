import { Button } from "../ui/button";
import { 
  Inbox, 
  Search, 
  Users, 
  List, 
  MessageSquare, 
  Heart,
  Plus,
  RefreshCw
} from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export function EmptyState({ 
  title, 
  description, 
  icon, 
  action, 
  secondaryAction 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
      <div className="flex gap-3">
        {action && (
          <Button onClick={action.onClick}>
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="outline" onClick={secondaryAction.onClick}>
            {secondaryAction.icon && <span className="mr-2">{secondaryAction.icon}</span>}
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// Predefined empty states
export function EmptyPosts() {
  return (
    <EmptyState
      title="No posts yet"
      description="Start sharing your thoughts, photos, and experiences with your community."
      icon={<MessageSquare className="h-12 w-12" />}
      action={{
        label: "Create your first post",
        onClick: () => window.location.href = '/create-post',
        icon: <Plus className="h-4 w-4" />
      }}
    />
  );
}

export function EmptyFeed() {
  return (
    <EmptyState
      title="Your feed is empty"
      description="Follow some users or create posts to see content here."
      icon={<Inbox className="h-12 w-12" />}
      action={{
        label: "Discover people",
        onClick: () => window.location.href = '/discover',
        icon: <Users className="h-4 w-4" />
      }}
      secondaryAction={{
        label: "Create a post",
        onClick: () => window.location.href = '/create-post',
        icon: <Plus className="h-4 w-4" />
      }}
    />
  );
}

export function EmptySearch() {
  return (
    <EmptyState
      title="No results found"
      description="Try adjusting your search terms or browse different categories."
      icon={<Search className="h-12 w-12" />}
      action={{
        label: "Clear search",
        onClick: () => window.location.reload(),
        icon: <RefreshCw className="h-4 w-4" />
      }}
    />
  );
}

export function EmptyLists() {
  return (
    <EmptyState
      title="No lists yet"
      description="Create lists to organize your content and share with others."
      icon={<List className="h-12 w-12" />}
      action={{
        label: "Create a list",
        onClick: () => window.location.href = '/create-list',
        icon: <Plus className="h-4 w-4" />
      }}
    />
  );
}

export function EmptyConnections() {
  return (
    <EmptyState
      title="No connections yet"
      description="Connect with friends and family to see their posts and share yours."
      icon={<Users className="h-12 w-12" />}
      action={{
        label: "Find friends",
        onClick: () => window.location.href = '/discover',
        icon: <Search className="h-4 w-4" />
      }}
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      title="All caught up!"
      description="You're up to date with all your notifications."
      icon={<Inbox className="h-12 w-12" />}
    />
  );
}

export function EmptyLikes() {
  return (
    <EmptyState
      title="No likes yet"
      description="Posts you like will appear here."
      icon={<Heart className="h-12 w-12" />}
      action={{
        label: "Explore posts",
        onClick: () => window.location.href = '/feed',
        icon: <Search className="h-4 w-4" />
      }}
    />
  );
}

export function EmptyComments() {
  return (
    <EmptyState
      title="No comments yet"
      description="Be the first to share your thoughts!"
      icon={<MessageSquare className="h-12 w-12" />}
    />
  );
}
