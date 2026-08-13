'use client'

import { useState } from 'react'
import Image from 'next/image'

export function ImageGallery({
  images,
  productName,
}: {
  images: { id: string; url: string; alt: string | null; position: number }[]
  productName: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
        Sin imagen
      </div>
    )
  }

  const currentImage = images[currentIndex]

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100">
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
                setCurrentIndex((prev) =>
                  prev === 0 ? images.length - 1 : prev - 1,
                )
              }
              className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-colors hover:bg-white"
              aria-label="Imagen anterior"
            >
              ‹
            </button>
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev === images.length - 1 ? 0 : prev + 1,
                )
              }
              className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-colors hover:bg-white"
              aria-label="Imagen siguiente"
            >
              ›
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setCurrentIndex(idx)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition-colors ${
                idx === currentIndex ? 'border-zinc-900' : 'border-transparent'
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
        <p className="mt-2 text-center text-xs text-zinc-500">
          {currentIndex + 1} de {images.length}
        </p>
      )}
    </div>
  )
}
