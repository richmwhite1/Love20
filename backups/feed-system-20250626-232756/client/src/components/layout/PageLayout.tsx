import React from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  loading?: boolean;
  error?: Error | null;
  showHeader?: boolean;
  showFooter?: boolean;
}

export function PageLayout({ 
  children, 
  title, 
  description, 
  loading = false,
  error = null,
  showHeader = true,
  showFooter = true
}: PageLayoutProps) {
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <LoadingSkeleton.FeedSkeleton count={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        {showHeader && title && (
          <header className="border-b bg-card">
            <div className="container mx-auto px-4 py-6">
              <h1 className="text-3xl font-bold">{title}</h1>
              {description && (
                <p className="text-muted-foreground mt-2">{description}</p>
              )}
            </div>
          </header>
        )}
        
        <main className="flex-1">
          {children}
        </main>
        
        {showFooter && (
          <footer className="border-t bg-card mt-auto">
            <div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
              <p>&copy; 2024 Love20. All rights reserved.</p>
            </div>
          </footer>
        )}
      </div>
    </ErrorBoundary>
  );
}
