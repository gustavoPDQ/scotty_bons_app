"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url ?? null);
  const [removeImage, setRemoveImage] = useState(false);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          if (imageFile) {
            const fd = new FormData();
            fd.append("file", imageFile);
            const imgResult = await uploadProductImage(productId, fd);
            if (imgResult.error) {
              toast.warning(imgResult.error);
            }
          } else if (removeImage && isEditing) {
            await removeProductImage(productId);
          }
        }

        form.reset();
        setPriceDisplays({});
        setImageFile(null);
        setImagePreview(null);
        setRemoveImage(false);
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
          <FormLabel>Product Image</FormLabel>
          {imagePreview ? (
            <div className="relative w-full aspect-[3/1] max-h-40 rounded-md overflow-hidden border bg-muted">
              <Image
                src={imagePreview}
                alt="Product preview"
                fill
                className="object-contain"
                unoptimized={imagePreview.startsWith("blob:")}
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-sm hover:bg-destructive/90"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
            >
              <ImagePlus className="size-5" />
              Click to upload an image
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WebP. Max 2 MB.
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
