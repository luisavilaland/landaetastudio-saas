"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

export function CategoryNav() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        setCategories(data.categories || []);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCategories();
  }, []);

  if (isLoading || categories.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/categoria/${category.slug}`}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}