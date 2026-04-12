import React from 'react';

const SkeletonLoader: React.FC<{ type: 'card' | 'text' | 'map' | 'list', count?: number }> = ({ type, count = 1 }) => {
  const renderItem = (i: number) => {
    switch(type) {
      case 'card':
        return <div key={i} className="card h-32 skeleton rounded-xl w-full" />;
      case 'text':
        return <div key={i} className="h-4 skeleton rounded w-3/4 mb-2" />;
      case 'map':
        return <div key={i} className="w-full aspect-[4/3] skeleton rounded-xl" />;
      case 'list':
        return (
          <div key={i} className="flex gap-4 p-4 border-b border-border">
            <div className="w-12 h-12 skeleton rounded-lg shrink-0" />
            <div className="flex-1">
              <div className="h-4 skeleton rounded w-1/2 mb-2" />
              <div className="h-3 skeleton rounded w-1/3" />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {Array.from({ length: count }).map((_, i) => renderItem(i))}
    </div>
  );
};

export default SkeletonLoader;
