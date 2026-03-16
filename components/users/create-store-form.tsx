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
import { createStore } from "@/app/(dashboard)/users/actions";
import { createStoreSchema, type CreateStoreValues } from "@/lib/validations/users";

interface CreateStoreFormProps {
  onSuccess: () => void;
}

export function CreateStoreForm({ onSuccess }: CreateStoreFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateStoreValues>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (values: CreateStoreValues) => {
    startTransition(async () => {
      const result = await createStore(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      form.reset();
      toast.success("Store created successfully.");
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
            {isPending ? "Creating..." : "Create Store"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
