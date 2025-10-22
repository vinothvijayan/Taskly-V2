import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Opportunity } from "@/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  contact: z.string().min(2, "Contact name is required."),
  value: z.coerce.number().min(0, "Value must be a positive number."),
  closeDate: z.date({ required_error: "A close date is required." }),
  stage: z.enum(['Interested Lead', 'Meeting', 'Follow-ups', 'Negotiation', 'Closed Won', 'Closed Lost']).default('Interested Lead'),
});

type OpportunityFormData = z.infer<typeof formSchema>;

interface OpportunityFormProps {
  opportunity?: Opportunity;
  onSubmit: (data: Omit<Opportunity, "id" | "teamId" | "createdBy" | "createdAt">) => void;
  onCancel: () => void;
}

export function OpportunityForm({ opportunity, onSubmit, onCancel }: OpportunityFormProps) {
  const form = useForm<OpportunityFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: opportunity?.title || "",
      contact: opportunity?.contact || "",
      value: opportunity?.value || 0,
      closeDate: opportunity?.closeDate ? new Date(opportunity.closeDate) : new Date(),
      stage: opportunity?.stage || 'Interested Lead',
    },
  });

  const handleSubmit = (values: OpportunityFormData) => {
    onSubmit({
      ...values,
      closeDate: values.closeDate.toISOString(),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Opportunity Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., New website for Acme Inc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter contact name..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Value (₹)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="25000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="closeDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Expected Close Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date("1900-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Opportunity</Button>
        </div>
      </form>
    </Form>
  );
}