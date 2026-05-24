"use client";

import { DotLottiePlayer } from '@dotlottie/react-player';
import '@dotlottie/react-player/dist/index.css';

interface LoadingScreenProps {
  message?: string;
  size?: number;
  fullScreen?: boolean;
}

export default function LoadingScreen({
  message = "Memuat...",
  size = 200,
  fullScreen = true,
}: LoadingScreenProps) {
  const content = (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }}>
        <DotLottiePlayer
          src="/bird-flying.lottie"
          autoplay
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      {message && (
        <p className="text-slate-500 font-medium text-sm tracking-wide">
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center py-16">
      {content}
    </div>
  );
}
