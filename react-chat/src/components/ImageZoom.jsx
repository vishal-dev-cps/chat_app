import Zoom from "react-medium-image-zoom";
import "./ImageZoom.css";

/**
 * ImageZoom Component
 * 
 * A wrapper around react-medium-image-zoom that provides image zoom functionality
 * with custom styling (no Tailwind CSS dependency).
 * 
 * Usage:
 * ```jsx
 * <ImageZoom>
 *   <img src="image.jpg" alt="Description" />
 * </ImageZoom>
 * ```
 * 
 * Props:
 * - className: Additional CSS classes for the wrapper
 * - backdropClassName: Additional CSS classes for the backdrop/dialog
 * - children: The image element to make zoomable
 * - ...props: Any other props are passed to the Zoom component
 */
export const ImageZoom = ({ className = "", backdropClassName = "", children, ...props }) => {
  return (
    <div className={`image-zoom-wrapper ${className}`}>
      <Zoom
        classDialog={`image-zoom-dialog ${backdropClassName}`}
        {...props}
      >
        {children}
      </Zoom>
    </div>
  );
};
