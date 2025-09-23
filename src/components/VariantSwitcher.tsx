import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

interface Variant {
  image: string | null;
  text: string | null;
}

interface VariantSwitcherProps {
  variants: Variant[];
  onAccept: (variant: Variant) => void;
  onCancel: () => void;
}

const VariantSwitcher: React.FC<VariantSwitcherProps> = ({ variants, onAccept, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (!variants.length) return null;
  
  const currentVariant = variants[currentIndex];
  const hasMultiple = variants.length > 1;
  
  const nextVariant = () => {
    setCurrentIndex((prev) => (prev + 1) % variants.length);
  };
  
  const prevVariant = () => {
    setCurrentIndex((prev) => (prev - 1 + variants.length) % variants.length);
  };
  
  const handleAccept = () => {
    onAccept(currentVariant);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Choose Variant</h3>
            {hasMultiple && (
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} of {variants.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Image Display */}
        <div className="relative p-4">
          <div className="relative">
            {currentVariant.image ? (
              <img
                src={currentVariant.image}
                alt={`Variant ${currentIndex + 1}`}
                className="w-full h-auto max-h-[60vh] object-contain rounded"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No image generated
              </div>
            )}
            
            {/* Navigation arrows - always show for multiple variants */}
            {hasMultiple && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                  onClick={prevVariant}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                  onClick={nextVariant}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
          
          {/* Variant dots indicator */}
          {hasMultiple && (
            <div className="flex justify-center gap-2 mt-4">
              {variants.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Text content */}
        {currentVariant.text && (
          <div className="p-4 border-t border-border">
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {currentVariant.text}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!currentVariant.image}>
            <Check className="w-4 h-4 mr-2" />
            Use This Variant
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VariantSwitcher;
