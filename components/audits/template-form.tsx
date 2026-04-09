"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getRatingStyle } from "@/lib/constants/audit-status";
import {
  createTemplateSchema,
  type CreateTemplateValues,
} from "@/lib/validations/audit-templates";

interface TemplateFormProps {
  defaultValues?: CreateTemplateValues;
  onSubmit: (values: CreateTemplateValues) => void | Promise<void>;
  onCancel: () => void;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || `rating-${Date.now()}`;
}

const DEFAULT_RATING_OPTIONS = [
  { key: "poor", label: "Poor", weight: 0 },
  { key: "satisfactory", label: "Satisfactory", weight: 0.5 },
  { key: "good", label: "Good", weight: 1 },
];

export function TemplateForm({ defaultValues, onSubmit, onCancel }: TemplateFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<CreateTemplateValues>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: defaultValues ?? {
      name: "",
      description: "",
      rating_options: DEFAULT_RATING_OPTIONS,
      categories: [{ name: "", items: [{ label: "" }] }],
    },
  });

  const {
    fields: categoryFields,
    append: appendCategory,
    remove: removeCategory,
    swap: swapCategory,
  } = useFieldArray({ control, name: "categories" });

  const {
    fields: ratingFields,
    append: appendRating,
    remove: removeRating,
    swap: swapRating,
  } = useFieldArray({ control, name: "rating_options" });

  const [collapsedCategories, setCollapsedCategories] = useState<Record<number, boolean>>({});

  function toggleCollapse(index: number) {
    setCollapsedCategories((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const ratingOptionsWatch = watch("rating_options");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input id="name" {...register("name")} placeholder="e.g. Monthly Store Audit" />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Brief description of this template"
          rows={2}
        />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Rating Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Rating Scale</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define the rating options and their weights (0 = worst, 1 = best).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendRating({ key: `rating-${Date.now()}`, label: "", weight: 0 })}
          >
            <Plus className="size-4 mr-1" />
            Add Rating
          </Button>
        </div>

        {errors.rating_options?.root && (
          <p className="text-sm text-red-600">{errors.rating_options.root.message}</p>
        )}
        {errors.rating_options?.message && (
          <p className="text-sm text-red-600">{errors.rating_options.message}</p>
        )}

        <div className="space-y-2">
          {ratingFields.map((field, index) => {
            const weight = ratingOptionsWatch?.[index]?.weight ?? 0;
            const style = getRatingStyle(weight);
            return (
              <div key={field.id} className="flex items-center gap-2">
                <div
                  className="w-2 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: style.backgroundColor as string }}
                />
                <Input
                  {...register(`rating_options.${index}.label`)}
                  placeholder="Label (e.g. Good)"
                  className="flex-1"
                  onBlur={(e) => {
                    // Auto-generate key from label if key matches default pattern
                    const currentKey = ratingOptionsWatch?.[index]?.key ?? "";
                    if (!currentKey || currentKey.startsWith("rating-")) {
                      setValue(`rating_options.${index}.key`, slugify(e.target.value));
                    }
                  }}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  {...register(`rating_options.${index}.weight`, { valueAsNumber: true })}
                  placeholder="Weight"
                  className="w-20"
                />
                <input type="hidden" {...register(`rating_options.${index}.key`)} />
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === 0} onClick={() => swapRating(index, index - 1)}>
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === ratingFields.length - 1} onClick={() => swapRating(index, index + 1)}>
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled={ratingFields.length <= 2} onClick={() => removeRating(index)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                {errors.rating_options?.[index]?.label && (
                  <p className="text-xs text-red-600">{errors.rating_options[index].label.message}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Categories &amp; Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendCategory({ name: "", items: [{ label: "" }] })}
          >
            <Plus className="size-4 mr-1" />
            Add Category
          </Button>
        </div>

        {errors.categories?.root && (
          <p className="text-sm text-red-600">{errors.categories.root.message}</p>
        )}
        {errors.categories?.message && (
          <p className="text-sm text-red-600">{errors.categories.message}</p>
        )}

        <div className="space-y-4">
          {categoryFields.map((catField, catIndex) => (
            <CategorySection
              key={catField.id}
              catIndex={catIndex}
              totalCategories={categoryFields.length}
              control={control}
              register={register}
              errors={errors}
              collapsed={!!collapsedCategories[catIndex]}
              onToggleCollapse={() => toggleCollapse(catIndex)}
              onMoveUp={() => swapCategory(catIndex, catIndex - 1)}
              onMoveDown={() => swapCategory(catIndex, catIndex + 1)}
              onRemove={() => removeCategory(catIndex)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : defaultValues ? "Update Template" : "Create Template"}
        </Button>
      </div>
    </form>
  );
}

function CategorySection({
  catIndex,
  totalCategories,
  control,
  register,
  errors,
  collapsed,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  catIndex: number;
  totalCategories: number;
  control: any;
  register: any;
  errors: any;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: `categories.${catIndex}.items`,
  });

  const categoryName = useWatch({ control, name: `categories.${catIndex}.name` });
  const catErrors = errors.categories?.[catIndex];

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      {/* Category header */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>

        <div className="flex-1">
          <Input
            {...register(`categories.${catIndex}.name`)}
            placeholder="Category name (e.g. Food Safety)"
            className="font-medium"
          />
          {catErrors?.name && (
            <p className="text-xs text-red-600 mt-1">{catErrors.name.message}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={catIndex === 0} onClick={onMoveUp}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={catIndex === totalCategories - 1} onClick={onMoveDown}>
            <ArrowDown className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={totalCategories <= 1} onClick={onRemove}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Items — collapsible */}
      {!collapsed && (
        <div className="pl-9 space-y-2">
          {catErrors?.items?.root && (
            <p className="text-xs text-red-600">{catErrors.items.root.message}</p>
          )}
          {catErrors?.items?.message && (
            <p className="text-xs text-red-600">{catErrors.items.message}</p>
          )}

          <div className="text-xs text-muted-foreground">
            {fields.length} {fields.length === 1 ? "item" : "items"}
            {categoryName ? ` in "${categoryName}"` : ""}
          </div>

          {fields.map((field, itemIndex) => (
            <div key={field.id} className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground mt-2.5 w-6 text-right shrink-0">
                {itemIndex + 1}.
              </span>
              <div className="flex-1 space-y-1">
                <Input
                  {...register(`categories.${catIndex}.items.${itemIndex}.label`)}
                  placeholder="Checklist item label"
                />
                {catErrors?.items?.[itemIndex]?.label && (
                  <p className="text-xs text-red-600">
                    {catErrors.items[itemIndex].label.message}
                  </p>
                )}
                <Textarea
                  {...register(`categories.${catIndex}.items.${itemIndex}.description`)}
                  placeholder="Detailed description (optional)"
                  rows={1}
                  className="text-xs resize-none"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" className="size-7" disabled={itemIndex === 0} onClick={() => swap(itemIndex, itemIndex - 1)}>
                  <ArrowUp className="size-3" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" disabled={itemIndex === fields.length - 1} onClick={() => swap(itemIndex, itemIndex + 1)}>
                  <ArrowDown className="size-3" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7" disabled={fields.length <= 1} onClick={() => remove(itemIndex)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ label: "" })}
          >
            <Plus className="size-3.5 mr-1" />
            Add Item
          </Button>
        </div>
      )}
    </div>
  );
}
