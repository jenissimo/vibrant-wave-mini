'use client';

import React from 'react';

interface LoadingIndicatorProps {
  isVisible: boolean;
  progress?: number; // 0-100
  message?: string;
}

export default function LoadingIndicator({ isVisible, progress, message = 'Generating...' }: LoadingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-background border border-border rounded-xl shadow-2xl p-8 max-w-sm w-[90%] mx-4">
        {/* Main spinner */}
        <div className="flex flex-col items-center space-y-6">
          {/* Animated spinner */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-muted-foreground/20"></div>
            <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
          </div>
          
          {/* Progress bar */}
          {progress !== undefined && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-muted-foreground/20 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, progress || 0))}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Message */}
          <div className="text-center">
            <div className="text-sm font-medium text-foreground mb-1">{message}</div>
            <div className="text-xs text-muted-foreground">
              {progress !== undefined ? 'Please wait...' : 'This may take a moment'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
