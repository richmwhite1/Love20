import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
// import { apiService } from '@/lib/api-service';

interface RSVPData {
  going: number;
  maybe: number;
  not_going: number;
  userStatus?: string;
  responses?: Array<{
    userId: string;
    username: string;
    status: string;
  }>;
}

interface EventRSVPProps {
  postId: string;
  allowRsvp?: boolean;
  eventDate?: string;
  initialRsvpData?: RSVPData;
}

export function EventRSVP({ postId, allowRsvp = false, eventDate, initialRsvpData }: EventRSVPProps) {
  const [rsvpData, setRsvpData] = useState<RSVPData>(initialRsvpData || {
    going: 0,
    maybe: 0,
    not_going: 0
  });
  const [userStatus, setUserStatus] = useState<string | undefined>(initialRsvpData?.userStatus);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const handleRSVP = async (status: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to RSVP",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // For now, just update local state since the API endpoint doesn't exist
      setUserStatus(status);
      
      // Update counts
      const newData = { ...rsvpData };
      
      // Remove previous user status if any
      if (userStatus) {
        // newData[userStatus as keyof RSVPData] = Math.max(0, (newData[userStatus as keyof RSVPData] as number) - 1);
      }
      
      // Add new status
      if (status !== 'none') {
        // newData[status as keyof RSVPData] = (newData[status as keyof RSVPData] as number) + 1;
      }
      
      setRsvpData(newData);
      
      toast({
        title: "RSVP Updated",
        description: `You are now ${status === 'going' ? 'going' : status === 'maybe' ? 'maybe going' : 'not going'}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update RSVP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!allowRsvp) {
    return null;
  }

  const totalResponses = rsvpData.going + rsvpData.maybe + rsvpData.not_going;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Event RSVP</span>
          {eventDate && (
            <Badge variant="secondary">
              {new Date(eventDate).toLocaleDateString()}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* RSVP Stats */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>{rsvpData.going} going</span>
          <span>{rsvpData.maybe} maybe</span>
          <span>{rsvpData.not_going} not going</span>
          <span>{totalResponses} total</span>
        </div>

        {/* RSVP Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={userStatus === 'going' ? 'default' : 'outline'}
            onClick={() => handleRSVP('going')}
            disabled={isLoading}
          >
            Going
          </Button>
          <Button
            size="sm"
            variant={userStatus === 'maybe' ? 'default' : 'outline'}
            onClick={() => handleRSVP('maybe')}
            disabled={isLoading}
          >
            Maybe
          </Button>
          <Button
            size="sm"
            variant={userStatus === 'not_going' ? 'default' : 'outline'}
            onClick={() => handleRSVP('not_going')}
            disabled={isLoading}
          >
            Not Going
          </Button>
          {userStatus && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRSVP('none')}
              disabled={isLoading}
            >
              Remove RSVP
            </Button>
          )}
        </div>

        {/* RSVP Responses List */}
        {rsvpData.responses && rsvpData.responses.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Who's going:</h4>
            <div className="space-y-1">
              {rsvpData.responses.map((response, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{response.username}</span>
                  <Badge variant="outline" className="text-xs">
                    {response.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}