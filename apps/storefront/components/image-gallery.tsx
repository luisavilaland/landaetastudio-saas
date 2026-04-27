"use client";

import { useState } from "react";
import Image from "next/image";

export function ImageGallery({
  images,
  productName,
}: {
  images: { id: string; url: string; alt: string | null; position: number }[];
  productName: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="bg-zinc-100 rounded-lg aspect-square flex items-center justify-center text-zinc-400">
        Sin imagen
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div>
      <div className="bg-zinc-100 rounded-lg overflow-hidden aspect-square relative">
        <Image
          src={currentImage.url}
          alt={currentImage.alt || productName}
          fill
          unoptimized={true}
          className="object-cover"
        />

        {images.length > 1 && (
          <>
            <button
              onClick={() =>
                setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-colors"
              aria-label="Imagen anterior"
            >
              ‹
            </button>
            <button
              onClick={() =>
                setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-colors"
              aria-label="Imagen siguiente"
            >
              ›
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setCurrentIndex(idx)}
              className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                idx === currentIndex ? "border-zinc-900" : "border-transparent"
              }`}
            >
              <Image
                src={img.url}
                alt={img.alt || productName}
                fill
                unoptimized={true}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {images.length > 1 && (
        <p className="text-center text-xs text-zinc-500 mt-2">
          {currentIndex + 1} de {images.length}
        </p>
      )}
    </div>
  );
}
