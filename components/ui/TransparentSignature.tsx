"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function TransparentSignature({ src, alt = "Signature", className = "", style = {} }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;

    // If it's already a relative path or doesn't look like a base64/external, try fetching it
    // But mostly signatures are data: URLs or external URLs. 
    // To prevent CORS issues, if it's external, we might need crossOrigin="anonymous".
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      ctx.drawImage(img, 0, 0);
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Remove white background (make it transparent)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // If pixel is white or very close to white, make it transparent
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; // alpha = 0
          } else {
            // Optional: convert remaining non-white pixels to pure black or dark gray for better signature visibility
            data[i] = 20;
            data[i+1] = 20;
            data[i+2] = 20;
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        setProcessedUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Canvas pixel manipulation failed (likely CORS)", err);
        // Fallback to original image if CORS fails
        setProcessedUrl(src);
      }
    };
    
    img.onerror = () => {
      setProcessedUrl(src);
    };
    
    // For Next.js image proxy URLs, we need to extract the actual URL or use it as is if it supports CORS
    img.src = src;
    
  }, [src]);

  if (!processedUrl) {
    // Render hidden original image while processing
    return <img src={src} className={className} style={{ ...style, opacity: 0 }} alt={alt} />;
  }

  return (
    <img src={processedUrl} alt={alt} className={className} style={style} />
  );
}
