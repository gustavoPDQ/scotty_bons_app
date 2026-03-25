"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  generalSettingsSchema,
  type GeneralSettingsValues,
} from "@/lib/validations/settings";
import { saveGeneralSettings } from "@/app/(dashboard)/settings/actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FinancialSettingsFormProps {
  initialValues: Record<string, string>;
}

export function FinancialSettingsForm({
  initialValues,
}: FinancialSettingsFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<GeneralSettingsValues>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      hst_rate: initialValues.hst_rate ? Number(initialValues.hst_rate) : 0,
      ad_royalties_fee: initialValues.ad_royalties_fee
        ? Number(initialValues.ad_royalties_fee)
        : 0,
      commissary_name: initialValues.commissary_name || "",
      commissary_address: initialValues.commissary_address || "",
      commissary_postal_code: initialValues.commissary_postal_code || "",
      commissary_phone: initialValues.commissary_phone || "",
    },
  });

  const onSubmit = (values: GeneralSettingsValues) => {
    startTransition(async () => {
      const result = await saveGeneralSettings(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Settings saved.");
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tax & Fees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="hst_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HST Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ad_royalties_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ad & Royalties Fee ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commissary Billing Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="commissary_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Commissary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="commissary_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="501 Rogers rd Toronto, Ontario"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="commissary_postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl>
                      <Input placeholder="M6M1B4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="commissary_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="416-657-8977" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </Form>
  );
}
