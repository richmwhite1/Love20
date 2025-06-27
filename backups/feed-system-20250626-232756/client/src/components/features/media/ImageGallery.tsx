import React from 'react';
import { Card } from '../../ui/card';

interface ImageGalleryProps {
  images: string[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  if (!images || images.length === 0) return null;

  return (
    <div className="grid gap-2">
      {images.map((image, index) => (
        <Card key={index} className="overflow-hidden">
          <img 
            src={image} 
            alt={`Post image ${index + 1}`}
            className="w-full h-auto object-cover"
          />
        </Card>
      ))}
    </div>
  );
}
