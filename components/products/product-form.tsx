"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
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
  onSuccess: () => void;
}

export function ProductForm({ categories, product, onSuccess }: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [priceDisplay, setPriceDisplay] = useState(
    product?.price ? String(product.price) : ""
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
      price: product?.price ?? 0,
      modifier: product?.modifier ?? "",
      category_id: product?.category_id ?? "",
    },
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
      const result = isEditing
        ? await updateProduct(product.id, values)
        : await createProduct(values);
      if (result.error) {
        setFormError(result.error);
        return;
      }

      // Handle image upload/removal after product is saved
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
      setPriceDisplay("");
      setImageFile(null);
      setImagePreview(null);
      setRemoveImage(false);
      toast.success(isEditing ? "Product updated." : "Product created.");
      onSuccess();
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
                <Input placeholder="e.g. Orange Juice 1L" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priceDisplay}
                  onChange={(e) => {
                    // Replace comma with dot (PT-BR numpad sends comma for decimal)
                    const raw = e.target.value.replace(",", ".");
                    if (raw === "" || /^\d*\.?\d{0,2}$/.test(raw)) {
                      setPriceDisplay(raw);
                      field.onChange(raw === "" || raw === "." ? 0 : Number(raw));
                    }
                  }}
                  onBlur={() => {
                    field.onBlur();
                    const num = Number(priceDisplay);
                    if (!isNaN(num) && num > 0) {
                      const rounded = Math.round(num * 100) / 100;
                      field.onChange(rounded);
                      setPriceDisplay(rounded.toFixed(2));
                    } else {
                      setPriceDisplay("");
                      field.onChange(0);
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="modifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modifier</FormLabel>
              <FormControl>
                <Input placeholder="e.g. box, unit, kg" {...field} />
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
