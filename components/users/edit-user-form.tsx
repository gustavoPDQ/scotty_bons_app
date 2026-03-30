"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateUser, resetUserPassword } from "@/app/(dashboard)/users/actions";
import { updateUserSchema, type UpdateUserValues } from "@/lib/validations/users";
import type { StoreRow, UserRow } from "@/lib/types";

interface EditUserFormProps {
  user: UserRow;
  stores: StoreRow[];
  currentUserId: string;
  onSuccess: () => void;
}

export function EditUserForm({ user, stores, currentUserId, onSuccess }: EditUserFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isEditingSelf = user.id === currentUserId;

  const form = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
      store_id: user.store_id ?? undefined,
    },
  });

  const role = form.watch("role");

  const onSubmit = (values: UpdateUserValues) => {
    startTransition(async () => {
      const result = await updateUser(user.id, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("User updated.");
      onSuccess();
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Sandra Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="user@scottybons.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  if (value !== "store") {
                    form.setValue("store_id", undefined);
                  }
                }}
                value={field.value}
                disabled={isEditingSelf}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="commissary">Commissary User</SelectItem>
                  <SelectItem value="store">Store User</SelectItem>
                </SelectContent>
              </Select>
              {isEditingSelf && (
                <p className="text-xs text-muted-foreground">
                  You cannot change your own role.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {role === "store" && (
          <FormField
            control={form.control}
            name="store_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Store</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a store" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {stores.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No stores yet — create one first.
                      </div>
                    ) : (
                      stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Reset Password section */}
      {!isEditingSelf && (
        <div className="border-t pt-4 mt-2 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-muted-foreground" />
            Reset Password
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="New password (min 6)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="default"
              disabled={isResetting || newPassword.length < 6}
              onClick={() => {
                startResetTransition(async () => {
                  const result = await resetUserPassword(user.id, newPassword);
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Password reset successfully.");
                  setNewPassword("");
                });
              }}
            >
              {isResetting ? "Resetting..." : "Reset"}
            </Button>
          </div>
        </div>
      )}
    </Form>
  );
}
