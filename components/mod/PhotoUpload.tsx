// components/mod/PhotoUpload.tsx
"use client";

import { useState, useRef } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

type UploadedPhoto = {
  id: string;
  url: string;
  caption: string;
  rating: "pass" | "need_improvement" | null;
  fileName?: string;
};

interface PhotoUploadProps {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
  hideRating?: boolean;
}

export default function PhotoUpload({ photos, onChange, maxPhotos = 5, disabled = false, hideRating = false }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress image using canvas
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;

          // Calculate new dimensions (max 1200px)
          let { width, height } = img;
          const maxDimension = 1200;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with quality adjustment
          const compress = (quality: number): Promise<Blob | null> => {
            return new Promise((res) => {
              canvas.toBlob(
                (blob) => res(blob),
                "image/jpeg",
                quality
              );
            });
          };

          // Try different quality levels to get under 500KB
          const tryCompress = async () => {
            let quality = 0.8;
            let blob = await compress(quality);

            while (blob && blob.size > 500 * 1024 && quality > 0.1) {
              quality -= 0.1;
              blob = await compress(quality);
            }

            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to compress image"));
            }
          };

          tryCompress();
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const validFiles = Array.from(files).filter(file => {
        if (!file.type.startsWith("image/")) {
          setError(`File ${file.name} bukan gambar`);
          return false;
        }
        return true;
      });

      if (photos.length + validFiles.length > maxPhotos) {
        setError(`Maksimal ${maxPhotos} foto`);
        setUploading(false);
        return;
      }

      const newPhotos: UploadedPhoto[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const id = uuidv4();

        try {
          // Compress image
          setProgress(((i + 0.5) / validFiles.length) * 100);
          const compressedBlob = await compressImage(file);

          // Upload to Firebase Storage
          const storageRef = ref(storage, `mod-photos/${id}`);
          await uploadBytes(storageRef, compressedBlob);
          const url = await getDownloadURL(storageRef);

          newPhotos.push({
            id,
            url,
            caption: "",
            rating: null,
            fileName: file.name
          });
        } catch (err) {
          console.error("Error uploading photo:", err);
          setError(`Gagal upload ${file.name}`);
        }

        setProgress(((i + 1) / validFiles.length) * 100);
      }

      onChange([...photos, ...newPhotos]);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Gagal upload foto");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePhoto = (id: string) => {
    onChange(photos.filter(p => p.id !== id));
  };

  const updateCaption = (id: string, caption: string) => {
    onChange(photos.map(p => p.id === id ? { ...p, caption } : p));
  };

  const updateRating = (id: string, rating: "pass" | "need_improvement" | null) => {
    onChange(photos.map(p => p.id === id ? { ...p, rating } : p));
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        disabled={disabled || uploading || photos.length >= maxPhotos}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading || photos.length >= maxPhotos}
        className={`
          w-full py-3 border-2 border-dashed rounded-xl transition-all
          ${disabled ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed" : "border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400"}
        `}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>Mengunggah... {Math.round(progress)}%</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">📷</span>
            <span className="font-medium">Tambah Foto ({photos.length}/{maxPhotos})</span>
          </div>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="space-y-3">
          {photos.map((photo, index) => (
            <div key={photo.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
              {/* Preview */}
              <div className="relative">
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-40 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  disabled={disabled}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg"
                >
                  ✕
                </button>
              </div>

              {/* Rating Buttons */}
              <div className="p-3 space-y-2">
                {!hideRating && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateRating(photo.id, photo.rating === "pass" ? null : "pass")}
                      disabled={disabled}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        photo.rating === "pass"
                          ? "bg-green-500 text-white"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      ✅ Memenuhi Standar
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRating(photo.id, photo.rating === "need_improvement" ? null : "need_improvement")}
                      disabled={disabled}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        photo.rating === "need_improvement"
                          ? "bg-amber-500 text-white"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      ⚠️ Perlu Perbaikan
                    </button>
                  </div>
                )}

                {/* Caption */}
                <input
                  type="text"
                  value={photo.caption}
                  onChange={(e) => updateCaption(photo.id, e.target.value)}
                  disabled={disabled}
                  placeholder="Keterangan foto..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">
          Belum ada foto
        </p>
      )}
    </div>
  );
}