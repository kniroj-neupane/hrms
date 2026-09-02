"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { OrganizationsTable } from "@/modules/superadmin/organizations/organizations-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/modules/superadmin/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { toast } from "sonner";

const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens",
    ),
});

export default function Organizations() {
  const [isOpen, setIsOpen] = useState(false);
  const utils = api.useUtils();

  const form = useForm<z.infer<typeof createOrganizationSchema>>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const createOrganizationMutation = api.organization.create.useMutation({
    onSuccess: async () => {
      toast.success("Organization created successfully");
      form.reset();
      setIsOpen(false);
      await utils.admin.listOrganizations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to create organization");
    },
  });

  const onSubmit = (values: z.infer<typeof createOrganizationSchema>) => {
    createOrganizationMutation.mutate({
      action: "create",
      organizationData: {
        name: values.name,
        slug: values.slug,
      },
      joinData: undefined,
    });
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Organizations"
          description="Manage organizations in your system"
          action={
            <Button type="button" onClick={() => setIsOpen(true)}>
              Add Organization
            </Button>
          }
        />
        <OrganizationsTable />
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
            <DialogDescription>
              Create a new organization for your workspace.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter organization name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="acme-team" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={createOrganizationMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createOrganizationMutation.isPending}>
                  {createOrganizationMutation.isPending
                    ? "Creating..."
                    : "Create Organization"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
