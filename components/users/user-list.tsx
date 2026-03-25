"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, UserX, UserCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { deactivateUser, reactivateUser } from "@/app/(dashboard)/users/actions";
import type { UserRow } from "@/lib/types";

interface UserListProps {
  users: UserRow[];
  currentUserId: string;
  onEdit: (user: UserRow) => void;
  onActionComplete: () => void;
}

const ROLE_LABELS: Record<UserRow["role"], string> = {
  admin: "Admin",
  commissary: "Commissary",
  store: "Store",
};

export function UserList({ users, currentUserId, onEdit, onActionComplete }: UserListProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        No users yet. Create the first one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden md:table-cell">Store</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {ROLE_LABELS[user.role]}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {user.store_name ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-sm">
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
                </TableCell>
                <TableCell>
                  <ActionsMenu
                    user={user}
                    isSelf={isSelf}
                    onEdit={() => onEdit(user)}
                    onActionComplete={onActionComplete}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ActionsMenu({
  user,
  isSelf,
  onEdit,
  onActionComplete,
}: {
  user: UserRow;
  isSelf: boolean;
  onEdit: () => void;
  onActionComplete: () => void;
}) {
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDeactivate = () => {
    startTransition(async () => {
      const result = await deactivateUser(user.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("User deactivated.");
      setShowDeactivate(false);
      onActionComplete();
    });
  };

  const handleReactivate = () => {
    startTransition(async () => {
      const result = await reactivateUser(user.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("User reactivated.");
      onActionComplete();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4 mr-2" />
            Edit
          </DropdownMenuItem>
          {user.is_active && !isSelf && (
            <DropdownMenuItem
              onClick={() => setShowDeactivate(true)}
              className="text-destructive focus:text-destructive"
            >
              <UserX className="size-4 mr-2" />
              Deactivate
            </DropdownMenuItem>
          )}
          {!user.is_active && (
            <DropdownMenuItem onClick={handleReactivate} disabled={isPending}>
              <UserCheck className="size-4 mr-2" />
              {isPending ? "Reactivating..." : "Reactivate"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeactivate} onOpenChange={setShowDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? They will no longer be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={isPending}>
              {isPending ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
