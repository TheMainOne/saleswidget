import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  company: z.string().max(100).optional(),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(1000),
  request_type: z.enum(["demo_request", "general_inquiry", "sales_question", "signup"]),
  // Honeypot field - should always be empty (bots fill this)
  website: z.string().max(0).optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "demo_request" | "general_inquiry" | "sales_question" | "signup";
}

const ContactDialog = ({ isOpen, onOpenChange, defaultType = "general_inquiry" }: ContactDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      message: "",
      request_type: defaultType,
      website: "", // Honeypot - always empty
    },
  });

  const getDialogTitle = () => {
    switch (defaultType) {
      case "demo_request":
        return "Schedule a Demo";
      case "sales_question":
        return "Talk to Sales";
      case "signup":
        return "Get Started";
      default:
        return "Get in Touch";
    }
  };

  const getDialogDescription = () => {
    switch (defaultType) {
      case "demo_request":
        return "See how our AI Sales Advisor can transform your business";
      case "sales_question":
        return "Our team is ready to answer your questions";
      case "signup":
        return "Start your free trial today";
      default:
        return "We're here to help";
    }
  };

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      // Honeypot check - if website field is filled, it's a bot
      if (data.website && data.website.length > 0) {
        // Silently reject bot submission (fake success)
        toast({
          title: "Message sent!",
          description: "We'll get back to you within 24 hours.",
        });
        form.reset();
        setTimeout(() => onOpenChange(false), 1500);
        setIsSubmitting(false);
        return;
      }

      const subject = encodeURIComponent(
        `[Website contact] ${data.request_type} from ${data.name}`,
      );
      const body = encodeURIComponent(
        `Name: ${data.name}\nEmail: ${data.email}\nCompany: ${data.company || "-"}\nRequest type: ${data.request_type}\n\nMessage:\n${data.message}`,
      );
      window.open(`mailto:larinoko@gmail.com?subject=${subject}&body=${body}`, "_blank");

      toast({
        title: "Message sent!",
        description: "We'll get back to you within 24 hours.",
      });

      form.reset();
      
      // Close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error: any) {
      console.error("Contact form error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Honeypot field - hidden from users, visible to bots */}
            <div className="absolute -left-[9999px] opacity-0 pointer-events-none" aria-hidden="true">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        placeholder="Your website" 
                        tabIndex={-1}
                        autoComplete="off"
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
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
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="request_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Request Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a request type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="demo_request">Demo Request</SelectItem>
                      <SelectItem value="general_inquiry">General Inquiry</SelectItem>
                      <SelectItem value="sales_question">Sales Question</SelectItem>
                      <SelectItem value="signup">Sign Up</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about your needs..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </Form>

        <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
          <p className="mb-2">Prefer direct contact?</p>
          <div className="flex flex-col gap-1">
            <a
              href="mailto:larinoko@gmail.com"
              className="text-primary hover:underline"
            >
              📧 larinoko@gmail.com
            </a>
            <a
              href="https://t.me/mudaist"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              💬 t.me/mudaist
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactDialog;
