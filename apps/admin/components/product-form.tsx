"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
};

type ProductVariant = {
  id?: string;
  sku: string;
  price: number;
  stock: number;
  options: Record<string, string>;
};

type Product = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  status?: string | null;
  categoryId?: string | null;
  variant?: {
    price: number;
    stock: number | null;
  } | null;
  variants?: ProductVariant[];
};

type Props = {
  initialProduct?: Product;
  categories?: Category[];
  mode?: "create" | "edit";
};

export function ProductForm({ initialProduct, categories = [], mode = "create" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: initialProduct?.name || "",
    slug: initialProduct?.slug || "",
    description: initialProduct?.description || "",
    status: initialProduct?.status || "draft",
    categoryId: initialProduct?.categoryId || "",
    price: initialProduct?.variant ? initialProduct.variant.price / 100 : "",
    stock: initialProduct?.variant?.stock ?? "",
  });

  const [attributes, setAttributes] = useState<{ name: string; values: string[] }[]>(() => {
    if (initialProduct?.variants && initialProduct.variants.length > 0) {
      const firstVariant = initialProduct.variants[0];
      if (firstVariant.options && Object.keys(firstVariant.options).length > 0) {
        return Object.entries(firstVariant.options).map(([name, value]) => ({
          name,
          values: Array.from(
            new Set(initialProduct.variants!.filter(v => v.options[name]).map(v => v.options[name]))
          ),
        }));
      }
    }
    return [];
  });

  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    if (initialProduct?.variants && initialProduct.variants.length > 0) {
      return initialProduct.variants.map(v => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        stock: v.stock,
        options: v.options || {},
      }));
    }
    return [];
  });

  const [showVariantsPanel, setShowVariantsPanel] = useState(
    () => initialProduct?.variants ? initialProduct.variants.length > 0 : false
  );

  useEffect(() => {
    if (mode === "edit" && initialProduct?.id) {
      loadImages();
    }
  }, [mode, initialProduct?.id]);

  const loadImages = async () => {
    if (!initialProduct?.id) return;
    setImagesLoading(true);
    try {
      const res = await fetch(`/api/products/${initialProduct.id}/images`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } catch (err) {
      console.error("Error loading images:", err);
    } finally {
      setImagesLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  const addAttribute = () => {
    setAttributes([...attributes, { name: "", values: [] }]);
  };

  const updateAttributeName = (index: number, name: string) => {
    const newAttrs = [...attributes];
    newAttrs[index].name = name;
    setAttributes(newAttrs);
  };

  const addAttributeValue = (attrIndex: number, value: string) => {
    if (!value.trim()) return;
    const newAttrs = [...attributes];
    if (!newAttrs[attrIndex].values.includes(value.trim())) {
      newAttrs[attrIndex].values = [...newAttrs[attrIndex].values, value.trim()];
    }
    setAttributes(newAttrs);
  };

  const removeAttributeValue = (attrIndex: number, valueIndex: number) => {
    const newAttrs = [...attributes];
    newAttrs[attrIndex].values = newAttrs[attrIndex].values.filter((_, i) => i !== valueIndex);
    setAttributes(newAttrs);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const generateCombinations = () => {
    const validAttrs = attributes.filter(a => a.name && a.values.length > 0);
    if (validAttrs.length === 0) return;

    const cartesian = (arrays: string[][]): string[][] => {
      return arrays.reduce((acc, curr) =>
        acc.flatMap(a => curr.map(b => [...a, b])), [[]] as string[][]
      );
    };

    const attrNames = validAttrs.map(a => a.name);
    const attrValues = validAttrs.map(a => a.values);
    const combinations = cartesian(attrValues);

    const newVariants: ProductVariant[] = combinations.map((combo, index) => {
      const options: Record<string, string> = {};
      attrNames.forEach((name, i) => {
        options[name] = combo[i];
      });

      return {
        sku: `${form.slug}-${combo.join("-").toLowerCase()}-${index}`,
        price: typeof form.price === "number" ? Math.round(form.price * 100) : 0,
        stock: typeof form.stock === "number" ? form.stock : 0,
        options,
      };
    });

    setVariants(newVariants);
  };

  const updateVariant = (index: number, field: string, value: number) => {
    const newVariants = [...variants];
    (newVariants[index] as any)[field] = value;
    setVariants(newVariants);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleNewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setNewImageFiles((prev) => [...prev, ...files]);

    const previews = files.map((file) => URL.createObjectURL(file));
    setNewImagePreviews((prev) => [...prev, ...previews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = async (imageId: string) => {
    if (!confirm("¿Eliminar esta imagen?")) return;
    if (!initialProduct?.id) return;

    try {
      const res = await fetch(`/api/products/${initialProduct.id}/images/${imageId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
      } else {
        setError("Error al eliminar la imagen");
      }
    } catch {
      setError("Error al eliminar la imagen");
    }
  };

  const uploadNewImages = async (productId: string) => {
    if (newImageFiles.length === 0) return;

    setUploadingImages(true);
    try {
      for (const file of newImageFiles) {
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch(`/api/products/${productId}/images`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Error uploading image");
        }
      }

      setNewImageFiles([]);
      setNewImagePreviews([]);
      await loadImages();
    } catch {
      throw new Error("Error al subir las imágenes");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const priceInCents = Math.round(Number(form.price) * 100);

    try {
      const url =
        mode === "edit" && initialProduct?.id
          ? `/api/products/${initialProduct.id}`
          : "/api/products";
      const method = mode === "edit" ? "PUT" : "POST";

      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("slug", form.slug);
      formData.append("description", form.description || "");
      formData.append("status", form.status);
      if (form.categoryId) {
        formData.append("categoryId", form.categoryId);
      }
      formData.append("price", priceInCents.toString());
      formData.append("stock", form.stock?.toString() ?? "0");

      const res = await fetch(url, {
        method,
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error saving product");
      }

      const savedProduct = await res.json();
      const productId = savedProduct.id || initialProduct?.id;

      if (mode === "create" && newImageFiles.length > 0) {
        await uploadNewImages(productId);
      }

      if (showVariantsPanel && variants.length > 0 && productId) {
        const variantsRes = await fetch(`/api/products/${productId}/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variants: variants.map(({ sku, price, stock, options }) => ({
              sku,
              price: Math.round(price),
              stock: Math.round(stock),
              options,
            })),
          }),
        });

        if (!variantsRes.ok) {
          const data = await variantsRes.json();
          throw new Error(data.error || "Error saving variants");
        }
      }

      router.push("/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6">
        {mode === "edit" ? "Editar Producto" : "Nuevo Producto"}
      </h1>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
            Nombre
          </label>
          <input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={handleNameChange}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="Mi Producto"
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-zinc-700">
            Slug
          </label>
          <input
            id="slug"
            type="text"
            required
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="mi-producto"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-zinc-700"
          >
            Descripción
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            rows={3}
            placeholder="Descripción del producto..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Imágenes del producto
          </label>

          {mode === "edit" && imagesLoading && (
            <p className="text-sm text-zinc-500">Cargando imágenes...</p>
          )}

          {mode === "edit" && !imagesLoading && images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {images.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.url}
                    alt={img.alt || "Product image"}
                    className="w-full aspect-square object-cover rounded-md border border-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(img.id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {newImagePreviews.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {newImagePreviews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img
                    src={preview}
                    alt={`New image ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-md border border-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleNewImageChange}
            className="mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
          />

          {mode === "edit" && newImageFiles.length > 0 && (
            <button
              type="button"
              onClick={() => uploadNewImages(initialProduct?.id!)}
              disabled={uploadingImages}
              className="mt-2 px-3 py-1 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50"
            >
              {uploadingImages ? "Subiendo..." : `Subir ${newImageFiles.length} imagen(es)`}
            </button>
          )}

          <p className="mt-1 text-xs text-zinc-500">
            {mode === "create"
              ? "Las imágenes se subirán después de crear el producto"
              : "Haz clic en 'Subir' para agregar las imágenes seleccionadas"}
          </p>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-zinc-700">
            Estado
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </select>
        </div>

        {categories.length > 0 && (
          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-zinc-700">
              Categoría
            </label>
            <select
              id="categoryId"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-zinc-700">
            Precio (UYU)
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="199.00"
          />
        </div>

        <div>
          <label htmlFor="stock" className="block text-sm font-medium text-zinc-700">
            Stock
          </label>
          <input
            id="stock"
            type="number"
            min="0"
            required
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="100"
          />
        </div>

        <div className="pt-4 border-t border-zinc-200">
          <button
            type="button"
            onClick={() => setShowVariantsPanel(!showVariantsPanel)}
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            {showVariantsPanel ? "− Ocultar variantes" : "+ Configurar variantes"}
          </button>
        </div>

        {showVariantsPanel && (
          <div className="space-y-4 p-4 bg-zinc-50 rounded-md border border-zinc-200">
            <h3 className="font-medium text-zinc-900">Atributos de variante</h3>

            {attributes.map((attr, attrIndex) => (
              <div key={attrIndex} className="space-y-2 p-3 bg-white rounded border">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Nombre (ej. Talle)"
                    value={attr.name}
                    onChange={(e) => updateAttributeName(attrIndex, e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-zinc-300 rounded"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(attrIndex)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Eliminar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {attr.values.map((val, valIndex) => (
                    <span
                      key={valIndex}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 rounded text-sm"
                    >
                      {val}
                      <button
                        type="button"
                        onClick={() => removeAttributeValue(attrIndex, valIndex)}
                        className="text-zinc-500 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nuevo valor"
                    className="flex-1 px-2 py-1 text-sm border border-zinc-300 rounded"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAttributeValue(attrIndex, (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      addAttributeValue(attrIndex, input.value);
                      input.value = "";
                    }}
                    className="px-2 py-1 text-sm bg-zinc-200 rounded hover:bg-zinc-300"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addAttribute}
              className="text-sm text-zinc-600 hover:text-zinc-800"
            >
              + Agregar atributo
            </button>

            {attributes.length > 0 && (
              <button
                type="button"
                onClick={generateCombinations}
                className="ml-4 px-3 py-1 text-sm bg-zinc-900 text-white rounded hover:bg-zinc-800"
              >
                Generar combinaciones
              </button>
            )}

            {variants.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-700">
                  Variantes generadas ({variants.length})
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {variants.map((variant, index) => (
                    <div key={index} className="p-2 bg-white rounded border text-sm">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {Object.entries(variant.options || {}).map(
                              ([k, v]) => `${k}: ${v}`
                            ).join(", ") || "Sin atributos"}
                          </div>
                          <div className="text-xs text-zinc-500">{variant.sku}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariant(index)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <div>
                          <label className="text-xs text-zinc-500">Precio</label>
                          <input
                            type="number"
                            step="0.01"
                            value={variant.price / 100}
                            onChange={(e) =>
                              updateVariant(index, "price", Math.round(Number(e.target.value) * 100))
                            }
                            className="w-24 px-1 py-0.5 text-sm border border-zinc-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500">Stock</label>
                          <input
                            type="number"
                            value={variant.stock}
                            onChange={(e) =>
                              updateVariant(index, "stock", Math.round(Number(e.target.value)))
                            }
                            className="w-20 px-1 py-0.5 text-sm border border-zinc-300 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="px-4 py-2 border border-zinc-300 rounded-md hover:bg-zinc-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}