"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { createUser } from "@/app/(dashboard)/users/actions";
import { createUserSchema, type CreateUserValues } from "@/lib/validations/users";
import type { StoreRow } from "@/lib/types";

interface CreateUserFormProps {
  stores: StoreRow[];
  onSuccess: () => void;
}

export function CreateUserForm({ stores, onSuccess }: CreateUserFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", role: "store", store_id: undefined },
  });

  const role = form.watch("role");

  const onSubmit = (values: CreateUserValues) => {
    startTransition(async () => {
      const result = await createUser(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      form.reset();
      toast.success(`User "${values.name}" created. They must use Forgot Password to set their password.`);
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
                  // Clear store_id when switching away from store role
                  if (value !== "store") {
                    form.setValue("store_id", undefined);
                  }
                }}
                defaultValue={field.value}
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

        <p className="text-xs text-muted-foreground">
          The user will need to use <strong>Forgot Password</strong> to set their password after account creation.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create User"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
