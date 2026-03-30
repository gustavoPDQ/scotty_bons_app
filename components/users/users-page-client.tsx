"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FolderClosed,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Shield,
  Store,
  Trash2,
  Truck,
  User,
} from "lucide-react";
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
import { CreateUserForm } from "@/components/users/create-user-form";
import { CreateStoreForm } from "@/components/users/create-store-form";
import { EditUserForm } from "@/components/users/edit-user-form";
import { EditStoreForm } from "@/components/users/edit-store-form";
import { UserInlineActions } from "@/components/users/user-inline-actions";
import { deleteStore } from "@/app/(dashboard)/users/actions";
import type { UserRow, StoreRow } from "@/lib/types";

interface UsersPageClientProps {
  users: UserRow[];
  stores: StoreRow[];
  page: number;
  hasMore: boolean;
  currentUserId: string;
}

export function UsersPageClient({
  users,
  stores,
  page,
  hasMore,
  currentUserId,
}: UsersPageClientProps) {
  const router = useRouter();
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isCreateStoreOpen, setIsCreateStoreOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editingStore, setEditingStore] = useState<StoreRow | null>(null);
  const [deletingStore, setDeletingStore] = useState<StoreRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const allSectionIds = [
    ...stores.map((s) => s.id),
    "_admins",
    "_commissaries",
    ...(users.some((u) => u.role === "store" && (!u.store_id || !stores.some((s) => s.id === u.store_id))) ? ["_unassigned"] : []),
  ];
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  const refresh = () => router.refresh();

  const toggleStore = (storeId: string) => {
    setExpandedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const handleDeleteStore = () => {
    if (!deletingStore) return;
    startDeleteTransition(async () => {
      const result = await deleteStore(deletingStore.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Store deleted successfully.");
      setDeletingStore(null);
      refresh();
    });
  };

  const admins = users.filter((u) => u.role === "admin");
  const commissaries = users.filter((u) => u.role === "commissary");
  const storeUsers = users.filter((u) => u.role === "store");

  const getUsersForStore = (storeId: string) =>
    storeUsers.filter((u) => u.store_id === storeId);

  const unassignedStoreUsers = storeUsers.filter(
    (u) => !u.store_id || !stores.some((s) => s.id === u.store_id)
  );

  const expandAll = () => setExpandedStores(new Set(allSectionIds));
  const collapseAll = () => setExpandedStores(new Set());

  // Helper to render a collapsible folder section
  const renderFolder = (
    id: string,
    icon: React.ReactNode,
    label: string,
    subtitle: string,
    members: UserRow[],
    actions?: React.ReactNode,
  ) => {
    const isOpen = expandedStores.has(id);
    return (
      <div key={id}>
        {/* Folder row */}
        <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
          <button
            type="button"
            className="flex items-center gap-3 flex-1 text-left"
            onClick={() => toggleStore(id)}
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
            <div>
              <span className="text-sm font-semibold">{label}</span>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            {icon}
            {actions}
          </div>
        </div>

        {/* Members inside folder */}
        {isOpen && (
          <div className="bg-muted/30">
            {members.length === 0 ? (
              <div className="pl-14 pr-4 py-3 text-xs text-muted-foreground italic">
                No users in this group.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {members.map((u) => (
                  <UserRowItem
                    key={u.id}
                    user={u}
                    currentUserId={currentUserId}
                    onEdit={() => setEditingUser(u)}
                    onActionComplete={refresh}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Users & Stores</CardTitle>
            <CardDescription>
              {stores.length} store{stores.length !== 1 ? "s" : ""},{" "}
              {users.length} user{users.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={expandedStores.size > 0 ? collapseAll : expandAll}
            >
              {expandedStores.size > 0 ? "Collapse All" : "Expand All"}
            </Button>
            <Dialog open={isCreateStoreOpen} onOpenChange={setIsCreateStoreOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Store className="size-4 mr-2" />
                  New Store
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Store</DialogTitle>
                </DialogHeader>
                <CreateStoreForm
                  onSuccess={() => {
                    setIsCreateStoreOpen(false);
                    refresh();
                  }}
                />
              </DialogContent>
            </Dialog>
            <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-2" />
                  New User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create User</DialogTitle>
                </DialogHeader>
                <CreateUserForm
                  stores={stores}
                  onSuccess={() => {
                    setIsCreateUserOpen(false);
                    refresh();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border divide-y">
            {/* Store folders */}
            {stores.map((store) => {
              const members = getUsersForStore(store.id);
              return renderFolder(
                store.id,
                null,
                store.name + (store.business_name ? ` — ${store.business_name}` : ""),
                `${members.length} user${members.length !== 1 ? "s" : ""}`,
                members,
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Store actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingStore(store)}>
                        <Pencil className="size-4 mr-2" />
                        Edit Store
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingStore(store)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete Store
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>,
              );
            })}

            {/* Unassigned store users */}
            {unassignedStoreUsers.length > 0 &&
              renderFolder(
                "_unassigned",
                null,
                "Unassigned",
                `${unassignedStoreUsers.length} user${unassignedStoreUsers.length !== 1 ? "s" : ""} without a store`,
                unassignedStoreUsers,
              )}

            {/* Admins folder */}
            {renderFolder(
              "_admins",
              null,
              "Admins",
              `${admins.length} admin${admins.length !== 1 ? "s" : ""}`,
              admins,
            )}

            {/* Commissaries folder */}
            {renderFolder(
              "_commissaries",
              null,
              "Commissaries",
              `${commissaries.length} commissar${commissaries.length !== 1 ? "ies" : "y"}`,
              commissaries,
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => router.push(`/users?page=${page - 1}`)}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => router.push(`/users?page=${page + 1}`)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <EditUserForm
              key={editingUser.id}
              user={editingUser}
              stores={stores}
              currentUserId={currentUserId}
              onSuccess={() => {
                setEditingUser(null);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Store Dialog */}
      <Dialog open={!!editingStore} onOpenChange={(open) => !open && setEditingStore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Store</DialogTitle>
          </DialogHeader>
          {editingStore && (
            <EditStoreForm
              key={editingStore.id}
              store={editingStore}
              onSuccess={() => {
                setEditingStore(null);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Store Confirmation */}
      <AlertDialog open={!!deletingStore} onOpenChange={(open) => !open && setDeletingStore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingStore?.name}&rdquo;?
              This will also delete all orders, invoices, and audits associated with this store.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStore}
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

/* ── Inline user row ─────────────────────────────────────────────────────── */

function UserRowItem({
  user,
  currentUserId,
  onEdit,
  onActionComplete,
}: {
  user: UserRow;
  currentUserId: string;
  onEdit: () => void;
  onActionComplete: () => void;
}) {
  return (
    <div className="flex items-center justify-between pl-14 pr-4 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <User className="size-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-medium">{user.name}</span>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={
              user.is_active
                ? "size-2 rounded-full bg-emerald-500"
                : "size-2 rounded-full bg-muted-foreground/40"
            }
          />
          <span className="text-muted-foreground">
            {user.is_active ? "Active" : "Inactive"}
          </span>
        </span>
        <UserInlineActions
          user={user}
          isSelf={user.id === currentUserId}
          onEdit={onEdit}
          onActionComplete={onActionComplete}
        />
      </div>
    </div>
  );
}
