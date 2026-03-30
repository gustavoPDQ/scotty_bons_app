"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AuditTemplateRow, AuditTemplateCategoryRow, AuditTemplateItemRow } from "@/lib/types";
import { TemplateForm } from "@/components/audits/template-form";
import {
  createTemplate,
  updateTemplate,
  toggleTemplateActive,
  deleteTemplate,
} from "@/app/(dashboard)/audits/templates/actions";
import type { CreateTemplateValues } from "@/lib/validations/audit-templates";

interface TemplatesClientProps {
  templates: AuditTemplateRow[];
  allCategories: AuditTemplateCategoryRow[];
  allItems: AuditTemplateItemRow[];
}

export function TemplatesClient({ templates, allCategories, allItems }: TemplatesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AuditTemplateRow | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<AuditTemplateRow | null>(null);

  function getCategoriesForTemplate(templateId: string) {
    const cats = allCategories
      .filter((c) => c.template_id === templateId)
      .sort((a, b) => a.sort_order - b.sort_order);

    return cats.map((cat) => ({
      name: cat.name,
      items: allItems
        .filter((i) => i.category_id === cat.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({ label: i.label, description: i.description ?? undefined })),
    }));
  }

  function handleCreate() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  function handleEdit(template: AuditTemplateRow) {
    setEditingTemplate(template);
    setDialogOpen(true);
  }

  function handleSubmit(values: CreateTemplateValues) {
    startTransition(async () => {
      if (editingTemplate) {
        const result = await updateTemplate(editingTemplate.id, values);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Template updated successfully.");
      } else {
        const result = await createTemplate(values);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Template created successfully.");
      }
      setDialogOpen(false);
      router.refresh();
    });
  }

  function handleToggle(template: AuditTemplateRow, checked: boolean) {
    startTransition(async () => {
      const result = await toggleTemplateActive(template.id, checked);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(checked ? "Template activated." : "Template deactivated.");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deletingTemplate) return;
    startTransition(async () => {
      const result = await deleteTemplate(deletingTemplate!.id);
      if (result.error) {
        toast.error(result.error);
        setDeletingTemplate(null);
        return;
      }
      toast.success("Template deleted.");
      setDeletingTemplate(null);
      router.refresh();
    });
  }

  return (
    <>
      <nav className="text-sm flex items-center gap-1.5">
        <Link
          href="/audits"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          Audits
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Templates</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Templates</h1>
        <Button onClick={handleCreate}>
          <Plus className="size-4 mr-2" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first audit checklist template.
            </p>
            <Button onClick={handleCreate}>New Template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id} className={!template.is_active ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{template.name}</p>
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {template.item_count} {template.item_count === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={(checked) => handleToggle(template, checked)}
                        disabled={isPending}
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        disabled={isPending}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeletingTemplate(template)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "New Template"}
            </DialogTitle>
          </DialogHeader>
          <TemplateForm
            defaultValues={
              editingTemplate
                ? {
                    name: editingTemplate.name,
                    description: editingTemplate.description ?? undefined,
                    categories: getCategoriesForTemplate(editingTemplate.id),
                  }
                : undefined
            }
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingTemplate}
        onOpenChange={(open) => !open && setDeletingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
