"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProduct, updateProduct, uploadProductImage, removeProductImage } from "@/app/(dashboard)/products/actions";
import {
  createProductSchema,
  type CreateProductValues,
} from "@/lib/validations/products";
import type { CategoryRow, ProductRow } from "@/lib/types";

type ImageEntry = {
  id?: string;
  url: string;
  file?: File;
};

const MAX_IMAGES = 5;

interface ProductFormProps {
  categories: CategoryRow[];
  product?: ProductRow;
  defaultCategoryId?: string;
  onSuccess: () => void;
}

export function ProductForm({ categories, product, defaultCategoryId, onSuccess }: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [priceDisplays, setPriceDisplays] = useState<Record<number, string>>(
    () => {
      const map: Record<number, string> = {};
      if (product?.modifiers) {
        product.modifiers.forEach((m, i) => {
          map[i] = String(m.price);
        });
      }
      return map;
    },
  );
  const [images, setImages] = useState<ImageEntry[]>(
    () => product?.images?.map((img) => ({ id: img.id, url: img.url })) ?? []
  );
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<ImageEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!product;

  const form = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: product?.name ?? "",
      category_id: product?.category_id ?? defaultCategoryId ?? "",
      modifiers:
        product?.modifiers?.map((m) => ({
          id: m.id,
          label: m.label,
          price: m.price,
          sort_order: m.sort_order,
        })) ?? [{ label: "", price: 0, sort_order: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "modifiers",
  });

  const totalImages = images.length + newFiles.length;

  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<File> =>
    new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality,
        );
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - totalImages;
    const toAdd = files.slice(0, remaining);
    const compressed = await Promise.all(toAdd.map((f) => compressImage(f)));
    const entries: ImageEntry[] = compressed.map((f) => ({
      url: URL.createObjectURL(f),
      file: f,
    }));
    setNewFiles((prev) => [...prev, ...entries]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveExisting = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setRemovedImageIds((prev) => [...prev, imageId]);
  };

  const handleRemoveNew = (index: number) => {
    setNewFiles((prev) => {
      const entry = prev[index];
      if (entry?.url.startsWith("blob:")) URL.revokeObjectURL(entry.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const onSubmit = (values: CreateProductValues) => {
    setFormError(null);
    startTransition(async () => {
      try {
        const result = isEditing
          ? await updateProduct(product.id, values)
          : await createProduct(values);
        if (result.error) {
          setFormError(result.error);
          return;
        }

        const productId = isEditing ? product.id : (result.data as { id: string })?.id;
        if (productId) {
          // Remove images marked for deletion
          for (const imageId of removedImageIds) {
            await removeProductImage(imageId);
          }

          // Upload new images
          for (const entry of newFiles) {
            if (entry.file) {
              const fd = new FormData();
              fd.append("file", entry.file);
              const imgResult = await uploadProductImage(productId, fd);
              if (imgResult.error) {
                toast.warning(imgResult.error);
              }
            }
          }
        }

        form.reset();
        setPriceDisplays({});
        setImages([]);
        setNewFiles([]);
        setRemovedImageIds([]);
        toast.success(isEditing ? "Product updated." : "Product created.");
        onSuccess();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Cajun Spice" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Modifiers */}
        <div className="space-y-2">
          <FormLabel>Modifiers</FormLabel>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <FormField
                  control={form.control}
                  name={`modifiers.${index}.label`}
                  render={({ field: f }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="e.g. Box 5lb" {...f} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`modifiers.${index}.price`}
                  render={({ field: f }) => (
                    <FormItem className="w-28">
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={priceDisplays[index] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".");
                            if (raw === "" || /^\d*\.?\d{0,2}$/.test(raw)) {
                              setPriceDisplays((prev) => ({
                                ...prev,
                                [index]: raw,
                              }));
                              f.onChange(
                                raw === "" || raw === "." ? 0 : Number(raw),
                              );
                            }
                          }}
                          onBlur={() => {
                            f.onBlur();
                            const num = Number(priceDisplays[index]);
                            if (!isNaN(num) && num >= 0) {
                              const rounded =
                                Math.round(num * 100) / 100;
                              f.onChange(rounded);
                              setPriceDisplays((prev) => ({
                                ...prev,
                                [index]: rounded.toFixed(2),
                              }));
                            } else {
                              setPriceDisplays((prev) => ({
                                ...prev,
                                [index]: "0.00",
                              }));
                              f.onChange(0);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-destructive hover:text-destructive shrink-0 mt-0.5"
                    onClick={() => {
                      remove(index);
                      setPriceDisplays((prev) => {
                        const next: Record<number, string> = {};
                        Object.entries(prev).forEach(([k, v]) => {
                          const ki = Number(k);
                          if (ki < index) next[ki] = v;
                          else if (ki > index) next[ki - 1] = v;
                        });
                        return next;
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              append({ label: "", price: 0, sort_order: fields.length });
              setPriceDisplays((prev) => ({
                ...prev,
                [fields.length]: "",
              }));
            }}
          >
            <Plus className="size-4 mr-1" />
            Add Modifier
          </Button>
          {form.formState.errors.modifiers?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.modifiers.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <FormLabel>Product Images</FormLabel>
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative size-20 rounded-md overflow-hidden border bg-muted shrink-0"
              >
                <Image
                  src={img.url}
                  alt="Product"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveExisting(img.id!)}
                  className="absolute top-1 right-1 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {newFiles.map((entry, i) => (
              <div
                key={`new-${i}`}
                className="relative size-20 rounded-md overflow-hidden border bg-muted shrink-0"
              >
                <Image
                  src={entry.url}
                  alt="New image"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => handleRemoveNew(i)}
                  className="absolute top-1 right-1 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {totalImages < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex size-20 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-foreground transition-colors shrink-0"
              >
                <ImagePlus className="size-5" />
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            {totalImages} / {MAX_IMAGES} images. JPEG, PNG or WebP. Max 2 MB each.
          </p>
        </div>

        {formError && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing ? "Saving..." : "Creating..."
              : isEditing ? "Save Changes" : "Create Product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
