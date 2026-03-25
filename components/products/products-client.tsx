"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ProductForm } from "@/components/products/product-form";
import { deleteProduct } from "@/app/(dashboard)/products/actions";
import { formatPrice } from "@/lib/utils";
import type { CategoryRow, ProductRow } from "@/lib/types";

interface ProductsClientProps {
  products: ProductRow[];
  categories: CategoryRow[];
  isAdmin: boolean;
}

export function ProductsClient({ products, categories, isAdmin }: ProductsClientProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const refresh = () => router.refresh();

  const handleDelete = () => {
    if (!deletingProduct) return;
    startDeleteTransition(async () => {
      const result = await deleteProduct(deletingProduct.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Product deleted.");
      setDeletingProduct(null);
      refresh();
    });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Products</CardTitle>
            <CardDescription>
              {products.length} product{products.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-2" />
                  New Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Product</DialogTitle>
                </DialogHeader>
                <ProductForm
                  categories={categories}
                  onSuccess={() => {
                    setIsCreateOpen(false);
                    refresh();
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              No products yet.{isAdmin ? " Create the first one to start building the catalog." : ""}
            </div>
          ) : (
            <div className="rounded-md border divide-y">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {product.image_url ? (
                      <div className="relative size-10 shrink-0 rounded overflow-hidden bg-muted">
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : (
                      <Package className="size-4 text-muted-foreground" />
                    )}
                    <div>
                      <span className="text-sm font-medium">{product.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(product.price)} &middot; {product.modifier} &middot; {product.category_name}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Product actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingProduct(product)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <ProductForm
              key={editingProduct.id}
              categories={categories}
              product={editingProduct}
              onSuccess={() => {
                setEditingProduct(null);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation */}
      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingProduct?.name}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
