"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderClosed,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { CategoryForm } from "@/components/products/category-form";
import { ProductForm } from "@/components/products/product-form";
import {
  deleteCategory,
  deleteProduct,
  reorderCategories,
  reorderProducts,
} from "@/app/(dashboard)/products/actions";
import { formatPrice } from "@/lib/utils";
import type { CategoryRow, ProductRow } from "@/lib/types";

interface CatalogAdminProps {
  products: ProductRow[];
  categories: CategoryRow[];
}

export function CatalogAdmin({ products, categories }: CatalogAdminProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [createProductCategoryId, setCreateProductCategoryId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryRow | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isReordering, startReorderTransition] = useTransition();

  const refresh = () => router.refresh();

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () =>
    setExpanded(new Set(categories.map((c) => c.id)));
  const collapseAll = () => setExpanded(new Set());

  const isSearching = searchQuery.trim().length > 0;

  // Filter products when searching
  const filteredProducts = useMemo(() => {
    if (!isSearching) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery, isSearching]);

  // Group filtered products by category
  const productsByCategory: Record<string, ProductRow[]> = {};
  for (const cat of categories) productsByCategory[cat.id] = [];
  for (const p of filteredProducts) {
    if (productsByCategory[p.category_id]) {
      productsByCategory[p.category_id].push(p);
    }
  }

  // Only show categories that have matching products when searching
  const visibleCategories = isSearching
    ? categories.filter((c) => (productsByCategory[c.id]?.length ?? 0) > 0)
    : categories;

  // Auto-expand matching categories when searching
  const prevSearchRef = useRef(searchQuery);
  if (prevSearchRef.current !== searchQuery) {
    prevSearchRef.current = searchQuery;
    if (isSearching && visibleCategories.length > 0) {
      setExpanded(new Set(visibleCategories.map((c) => c.id)));
    } else if (!isSearching) {
      setExpanded(new Set());
    }
  }

  const handleDeleteCategory = () => {
    if (!deletingCategory) return;
    startDeleteTransition(async () => {
      const result = await deleteCategory(deletingCategory.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Category deleted.");
      setDeletingCategory(null);
      refresh();
    });
  };

  const handleDeleteProduct = () => {
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

  const openCreateProduct = (categoryId: string) => {
    setCreateProductCategoryId(categoryId);
    setIsCreateProductOpen(true);
  };

  const handleMoveCategory = (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= categories.length) return;
    const newOrder = [...categories];
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    startReorderTransition(async () => {
      const result = await reorderCategories(newOrder.map((c) => c.id));
      if (result.error) toast.error(result.error);
      refresh();
    });
  };

  const handleMoveProduct = (categoryId: string, index: number, direction: "up" | "down") => {
    const catProducts = productsByCategory[categoryId] ?? [];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= catProducts.length) return;
    const newOrder = [...catProducts];
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    startReorderTransition(async () => {
      const result = await reorderProducts(categoryId, newOrder.map((p) => p.id));
      if (result.error) toast.error(result.error);
      refresh();
    });
  };

  const totalProducts = products.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <CardDescription>
                {categories.length} categor{categories.length !== 1 ? "ies" : "y"},{" "}
                {totalProducts} product{totalProducts !== 1 ? "s" : ""}
                {isSearching && ` · ${filteredProducts.length} matching`}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={expanded.size > 0 ? collapseAll : expandAll}>
              {expanded.size > 0 ? "Collapse All" : "Expand All"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={isCreateCategoryOpen} onOpenChange={setIsCreateCategoryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4 mr-2" />
                  New Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Category</DialogTitle>
                </DialogHeader>
                <CategoryForm
                  onSuccess={() => {
                    setIsCreateCategoryOpen(false);
                    refresh();
                  }}
                />
              </DialogContent>
            </Dialog>
            <Dialog
              open={isCreateProductOpen && !createProductCategoryId}
              onOpenChange={(open) => {
                if (!open) setIsCreateProductOpen(false);
                else {
                  setCreateProductCategoryId(null);
                  setIsCreateProductOpen(true);
                }
              }}
            >
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
                    setIsCreateProductOpen(false);
                    refresh();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="size-4" />}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              No categories yet. Create the first one to start building the catalog.
            </div>
          ) : isSearching && visibleCategories.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              No categories match &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="rounded-md border divide-y">
              {visibleCategories.map((category) => {
                const isOpen = expanded.has(category.id);
                const catProducts = productsByCategory[category.id] ?? [];
                const catIndex = categories.indexOf(category);
                return (
                  <div key={category.id}>
                    {/* Category row */}
                    <div className="flex items-center justify-between px-2 sm:px-4 py-3 hover:bg-muted/50 transition-colors">
                      <button
                        className="flex items-center gap-2 sm:gap-3 flex-1 text-left min-w-0"
                        onClick={() => toggleExpanded(category.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                        )}
                        {isOpen ? (
                          <FolderOpen className="size-4 text-primary shrink-0" />
                        ) : (
                          <FolderClosed className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="text-sm font-semibold truncate block">
                            {category.name}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {category.product_count} product
                            {category.product_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hidden sm:inline-flex"
                          title="Move up"
                          disabled={catIndex === 0 || isReordering}
                          onClick={() => handleMoveCategory(catIndex, "up")}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hidden sm:inline-flex"
                          title="Move down"
                          disabled={catIndex === categories.length - 1 || isReordering}
                          onClick={() => handleMoveCategory(catIndex, "down")}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 sm:size-8"
                          title="Add product to this category"
                          onClick={() => openCreateProduct(category.id)}
                        >
                          <Plus className="size-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7 sm:size-8">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Category actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="sm:hidden"
                              disabled={catIndex === 0 || isReordering}
                              onClick={() => handleMoveCategory(catIndex, "up")}
                            >
                              <ArrowUp className="size-4 mr-2" />
                              Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="sm:hidden"
                              disabled={catIndex === categories.length - 1 || isReordering}
                              onClick={() => handleMoveCategory(catIndex, "down")}
                            >
                              <ArrowDown className="size-4 mr-2" />
                              Move down
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingCategory(category)}>
                              <Pencil className="size-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingCategory(category)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Products inside category */}
                    {isOpen && (
                      <div className="bg-muted/30">
                        {catProducts.length === 0 ? (
                          <div className="pl-14 pr-4 py-3 text-xs text-muted-foreground italic">
                            No products in this category.
                          </div>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {catProducts.map((product, prodIndex) => (
                              <div
                                key={product.id}
                                className="flex items-center justify-between pl-6 sm:pl-14 pr-2 sm:pr-4 py-2.5"
                              >
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                  {product.image_url ? (
                                    <div className="relative size-8 shrink-0 rounded overflow-hidden bg-muted">
                                      <Image
                                        src={product.image_url}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        sizes="32px"
                                      />
                                    </div>
                                  ) : (
                                    <Package className="size-4 text-muted-foreground shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium truncate block">
                                      {product.name}
                                    </span>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {product.modifiers.map((m) =>
                                        `${m.label} ${formatPrice(m.price)}`
                                      ).join(" · ")}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 hidden sm:inline-flex"
                                  title="Move up"
                                  disabled={prodIndex === 0 || isReordering}
                                  onClick={() => handleMoveProduct(category.id, prodIndex, "up")}
                                >
                                  <ArrowUp className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 hidden sm:inline-flex"
                                  title="Move down"
                                  disabled={prodIndex === catProducts.length - 1 || isReordering}
                                  onClick={() => handleMoveProduct(category.id, prodIndex, "down")}
                                >
                                  <ArrowDown className="size-3.5" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="size-7 sm:size-8">
                                      <MoreHorizontal className="size-4" />
                                      <span className="sr-only">Product actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="sm:hidden"
                                      disabled={prodIndex === 0 || isReordering}
                                      onClick={() => handleMoveProduct(category.id, prodIndex, "up")}
                                    >
                                      <ArrowUp className="size-4 mr-2" />
                                      Move up
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="sm:hidden"
                                      disabled={prodIndex === catProducts.length - 1 || isReordering}
                                      onClick={() => handleMoveProduct(category.id, prodIndex, "down")}
                                    >
                                      <ArrowDown className="size-4 mr-2" />
                                      Move down
                                    </DropdownMenuItem>
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
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Product in specific category Dialog */}
      <Dialog
        open={isCreateProductOpen && !!createProductCategoryId}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateProductOpen(false);
            setCreateProductCategoryId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Product</DialogTitle>
          </DialogHeader>
          <ProductForm
            categories={categories}
            defaultCategoryId={createProductCategoryId ?? undefined}
            onSuccess={() => {
              setIsCreateProductOpen(false);
              setCreateProductCategoryId(null);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <CategoryForm
              key={editingCategory.id}
              category={editingCategory}
              onSuccess={() => {
                setEditingCategory(null);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingCategory?.name}&rdquo;?
              This action cannot be undone. Categories with products cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              onClick={handleDeleteProduct}
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
