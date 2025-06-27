import React from 'react';
import { format } from 'date-fns';

interface EventDateOverlayProps {
  event: any;
}

export function EventDateOverlay({ event }: EventDateOverlayProps) {
  if (!event?.date) return null;

  const eventDate = new Date(event.date);
  
  return (
    <div className="text-sm">
      <div className="font-medium">
        {format(eventDate, 'EEEE, MMMM d, yyyy')}
      </div>
      <div className="text-muted-foreground">
        {format(eventDate, 'h:mm a')}
      </div>
    </div>
  );
}
