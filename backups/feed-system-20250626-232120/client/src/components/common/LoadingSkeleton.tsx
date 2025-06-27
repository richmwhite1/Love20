import { Skeleton } from '../ui/skeleton';

// Post skeleton
export function PostSkeleton() {
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-48 w-full rounded-md" />
      <div className="flex space-x-4">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

// User profile skeleton
export function UserProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// List skeleton
export function ListSkeleton() {
  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

// Feed skeleton
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

// Grid skeleton
export function GridSkeleton({ 
  rows = 3, 
  cols = 3, 
  className = "h-32" 
}: { 
  rows?: number; 
  cols?: number; 
  className?: string;
}) {
  return (
    <div className="grid gap-4" style={{ 
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` 
    }}>
      {Array.from({ length: rows * cols }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
} 