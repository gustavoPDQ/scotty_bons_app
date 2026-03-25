"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Store, Trash2 } from "lucide-react";
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
import { UserList } from "@/components/users/user-list";
import { CreateUserForm } from "@/components/users/create-user-form";
import { CreateStoreForm } from "@/components/users/create-store-form";
import { EditUserForm } from "@/components/users/edit-user-form";
import { EditStoreForm } from "@/components/users/edit-store-form";
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

  const refresh = () => router.refresh();

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

  return (
    <div className="space-y-8">
      {/* Stores section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Stores</CardTitle>
            <CardDescription>
              Create stores before adding Store Users.
            </CardDescription>
          </div>
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
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No stores yet. Create your first store to be able to add Store Users.
            </div>
          ) : (
            <div className="rounded-md border divide-y">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{store.name}</span>
                    {store.business_name && (
                      <p className="text-xs text-muted-foreground">{store.business_name}</p>
                    )}
                  </div>
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
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingStore(store)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Users</CardTitle>
            <CardDescription>
              {users.length} user{users.length !== 1 ? "s" : ""} total
            </CardDescription>
          </div>
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
        </CardHeader>
        <CardContent>
          <UserList
            users={users}
            currentUserId={currentUserId}
            onEdit={(user) => setEditingUser(user)}
            onActionComplete={refresh}
          />

          {/* Pagination */}
          {(page > 1 || hasMore) && (
            <div className="flex justify-center gap-2 pt-4">
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
        </CardContent>
      </Card>

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
              Are you sure you want to delete &ldquo;{deletingStore?.name}&rdquo;? This action cannot be undone. Stores with assigned users cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStore} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
