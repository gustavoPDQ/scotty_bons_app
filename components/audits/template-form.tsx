"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  createTemplateSchema,
  type CreateTemplateValues,
} from "@/lib/validations/audit-templates";

interface TemplateFormProps {
  defaultValues?: CreateTemplateValues;
  onSubmit: (values: CreateTemplateValues) => Promise<void>;
  onCancel: () => void;
}

export function TemplateForm({ defaultValues, onSubmit, onCancel }: TemplateFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTemplateValues>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: defaultValues ?? {
      name: "",
      description: "",
      items: [{ label: "" }],
    },
  });

  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: "items",
  });

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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Checklist Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ label: "" })}
          >
            <Plus className="size-4 mr-1" />
            Add Item
          </Button>
        </div>

        {errors.items?.root && (
          <p className="text-sm text-red-600">{errors.items.root.message}</p>
        )}
        {errors.items?.message && (
          <p className="text-sm text-red-600">{errors.items.message}</p>
        )}

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground mt-2.5 w-6 text-right shrink-0">
                {index + 1}.
              </span>
              <div className="flex-1">
                <Input
                  {...register(`items.${index}.label`)}
                  placeholder="Checklist item description"
                />
                {errors.items?.[index]?.label && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.items[index].label.message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => swap(index, index - 1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === fields.length - 1}
                  onClick={() => swap(index, index + 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={fields.length <= 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
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
