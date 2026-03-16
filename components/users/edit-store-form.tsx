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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateStore } from "@/app/(dashboard)/users/actions";
import { updateStoreSchema, type UpdateStoreValues } from "@/lib/validations/users";
import type { StoreRow } from "@/lib/types";

interface EditStoreFormProps {
  store: StoreRow;
  onSuccess: () => void;
}

export function EditStoreForm({ store, onSuccess }: EditStoreFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateStoreValues>({
    resolver: zodResolver(updateStoreSchema),
    defaultValues: { name: store.name },
  });

  const onSubmit = (values: UpdateStoreValues) => {
    startTransition(async () => {
      const result = await updateStore(store.id, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Store updated successfully.");
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
              <FormLabel>Store Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Scotty Bons — Downtown" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
