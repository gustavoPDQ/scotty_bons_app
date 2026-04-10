"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, UserX, UserCheck } from "lucide-react";
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
import { deactivateUser, reactivateUser, deleteUser } from "@/app/(dashboard)/users/actions";
import type { UserRow } from "@/lib/types";

interface UserInlineActionsProps {
  user: UserRow;
  isSelf: boolean;
  onEdit: () => void;
  onActionComplete: () => void;
}

export function UserInlineActions({ user, isSelf, onEdit, onActionComplete }: UserInlineActionsProps) {
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
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

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteUser(user.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("User deleted.");
      setShowDelete(false);
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
          {!isSelf && (
            <DropdownMenuItem
              onClick={() => setShowDelete(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete
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

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{user.name}</strong>?
              This action cannot be undone. Users with orders or audits cannot be deleted — deactivate them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
