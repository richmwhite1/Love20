import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { MoreHorizontal, Edit, Trash2, Flag, Share2, Copy } from 'lucide-react';
import { useToast } from '../../../hooks/use-toast';

interface PostActionsMenuProps {
  post: any;
  isOwnPost: boolean;
  onPostUpdate?: (updatedPost: any) => void;
}

export function PostActionsMenu({ post, isOwnPost, onPostUpdate }: PostActionsMenuProps) {
  const { toast } = useToast();

  const handleEdit = () => {
    // TODO: Navigate to edit page or open edit modal
    console.log('Edit post:', post.id);
  };

  const handleDelete = () => {
    // TODO: Implement delete functionality
    console.log('Delete post:', post.id);
  };

  const handleReport = () => {
    // TODO: Implement report functionality
    console.log('Report post:', post.id);
    toast({
      title: "Post reported",
      description: "Thank you for your report. We'll review it shortly.",
    });
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log('Share post:', post.id);
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    toast({
      title: "Link copied",
      description: "Post link has been copied to clipboard.",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isOwnPost ? (
          <>
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : (
          <DropdownMenuItem onClick={handleReport}>
            <Flag className="mr-2 h-4 w-4" />
            Report
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleCopyLink}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 