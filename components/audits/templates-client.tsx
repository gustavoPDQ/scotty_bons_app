"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import type { AuditTemplateRow, AuditTemplateItemRow } from "@/lib/types";
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
  allItems: AuditTemplateItemRow[];
}

export function TemplatesClient({ templates, allItems }: TemplatesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AuditTemplateRow | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<AuditTemplateRow | null>(null);

  function getItemsForTemplate(templateId: string): AuditTemplateItemRow[] {
    return allItems
      .filter((i) => i.template_id === templateId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function handleCreate() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  function handleEdit(template: AuditTemplateRow) {
    setEditingTemplate(template);
    setDialogOpen(true);
  }

  async function handleSubmit(values: CreateTemplateValues) {
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
    startTransition(() => router.refresh());
  }

  async function handleToggle(template: AuditTemplateRow, checked: boolean) {
    const result = await toggleTemplateActive(template.id, checked);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(checked ? "Template activated." : "Template deactivated.");
    startTransition(() => router.refresh());
  }

  async function handleDelete() {
    if (!deletingTemplate) return;
    const result = await deleteTemplate(deletingTemplate.id);
    if (result.error) {
      toast.error(result.error);
      setDeletingTemplate(null);
      return;
    }
    toast.success("Template deleted.");
    setDeletingTemplate(null);
    startTransition(() => router.refresh());
  }

  return (
    <>
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
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={(checked) => handleToggle(template, checked)}
                        disabled={isPending}
                      />
                    </div>
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
                    items: getItemsForTemplate(editingTemplate.id).map((i) => ({
                      label: i.label,
                    })),
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
