import { useState } from 'react';
import './AnimatedAvatar.css';

export default function AnimatedAvatar({ 
  src, 
  alt, 
  size = 'md', 
  online = false,
  typing = false,
  className = '' 
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeMap = {
    sm: 32,
    md: 50,
    lg: 60,
    xl: 80
  };

  const pixelSize = sizeMap[size] || sizeMap.md;

  // Generate initials from name
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .slice(0, 2)
      .map(s => s[0].toUpperCase())
      .join('');
  };

  const initials = getInitials(alt);
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&size=${pixelSize * 2}`;

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  return (
    <div className={`animated-avatar-wrapper ${className}`} style={{ width: pixelSize, height: pixelSize }}>
      {/* Loading skeleton */}
      {imageLoading && !imageError && (
        <div className="avatar-skeleton" style={{ width: pixelSize, height: pixelSize }}>
          <div className="skeleton-shimmer"></div>
        </div>
      )}

      {/* Avatar image */}
      <img
        src={imageError ? fallbackUrl : src}
        alt={alt}
        className={`animated-avatar ${imageLoading ? 'loading' : 'loaded'}`}
        style={{ 
          width: pixelSize, 
          height: pixelSize,
          opacity: imageLoading ? 0 : 1
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />

      {/* Online indicator */}
      {online && (
        <span className={`avatar-status-indicator online ${typing ? 'typing' : ''}`}>
          {typing && (
            <>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </>
          )}
        </span>
      )}

      {/* Pulse animation for new activity */}
      {online && <div className="avatar-pulse"></div>}
    </div>
  );
}