"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  changeEmailSchema,
  type ChangeEmailValues,
} from "@/lib/validations/settings";
import { changeEmail } from "@/app/(dashboard)/settings/actions";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ChangeEmailForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      newEmail: "",
    },
  });

  const onSubmit = (values: ChangeEmailValues) => {
    startTransition(async () => {
      const result = await changeEmail(values.newEmail);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      form.reset();
      toast.success(
        "Confirmation email sent. Check your new email address to confirm the change."
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Email Address</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Updating..." : "Update Email"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
