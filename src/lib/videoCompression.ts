/**
 * Soviet Boxing Science - Visual Core Optimization Utility
 * Provides client-side video compression using native browser APIs.
 */

export interface CompressionOptions {
  maxHeight?: number;
  maxWidth?: number;
  quality?: number; // 0 to 1
  onProgress?: (progress: number) => void;
}

export async function compressVideo(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const {
    maxHeight = 480,
    maxWidth = 854,
    onProgress
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      // Calculate new dimensions maintain aspect ratio
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const stream = canvas.captureStream(24); // 24 FPS is enough for AI review and keeps longer videos lighter.
      const mimeType = 'video/webm;codecs=vp8';
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
        videoBitsPerSecond: 750000 // Keeps 60-120s clips practical without losing the key movement cues.
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        URL.revokeObjectURL(video.src);
        resolve(blob);
      };

      // Play through video to capture frames
      video.currentTime = 0;
      mediaRecorder.start();

      let lastProgress = 0;
      
      const renderFrame = () => {
        if (video.paused || video.ended) {
          mediaRecorder.stop();
          return;
        }

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        if (onProgress) {
          const progress = Math.round((video.currentTime / video.duration) * 100);
          if (progress !== lastProgress) {
            onProgress(progress);
            lastProgress = progress;
          }
        }

        requestAnimationFrame(renderFrame);
      };

      video.onplay = () => renderFrame();
      
      // Keep normal playback speed so the compressed output preserves real timing.
      video.playbackRate = 1.0;
      video.play().catch(reject);
    };

    video.onerror = (e) => reject(new Error("Erreur de chargement vidéo."));
  });
}
