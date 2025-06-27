import React from 'react';
import { Badge } from '../../ui/badge';
import { Zap } from 'lucide-react';

interface EnergyRatingProps {
  rating: number;
}

export function EnergyRating({ rating }: EnergyRatingProps) {
  const getEnergyColor = (rating: number) => {
    if (rating >= 8) return 'bg-red-500';
    if (rating >= 6) return 'bg-orange-500';
    if (rating >= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex items-center space-x-2">
      <Zap className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Energy:</span>
      <Badge 
        variant="secondary" 
        className={`text-xs ${getEnergyColor(rating)} text-white`}
      >
        {rating}/10
      </Badge>
    </div>
  );
}
