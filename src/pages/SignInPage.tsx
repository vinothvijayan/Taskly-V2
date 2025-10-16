import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { OTPLoginForm } from "@/components/auth/OTPLoginForm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Mail, Phone, Chrome, CheckSquare } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

const resetSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
});

export default function SignInPage() {
  const { signIn, signInWithGoogle, resetPassword, loading } = useAuth();
  const navigate = useNavigate();
  const [showReset, setShowReset] = useState(false);
  const isMobile = useIsMobile();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await signIn(values.email, values.password);
      navigate("/");
    } catch (error) {
      // Error handled by toast in AuthContext
    }
  }

  async function handleGoogleSignIn() {
    try {
      await signInWithGoogle();
      navigate("/");
    } catch (error) {
      // Error handled by toast in AuthContext
    }
  }

  async function handlePasswordReset(values: z.infer<typeof resetSchema>) {
    try {
      await resetPassword(values.email);
      setShowReset(false);
      resetForm.reset();
    } catch (error) {
      // Error handled by toast in AuthContext
    }
  }

  if (showReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md shadow-elegant animate-scale-in">
          <CardHeader>
            <CardTitle className="text-center text-2xl flex items-center justify-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              Reset Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(handlePasswordReset)} className="space-y-4">
                <FormField
                  control={resetForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="m@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-3">
                  <Button type="submit" className="w-full" disabled={loading} variant="focus">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Reset Email"}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowReset(false)}
                  >
                    Back to Sign In
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Brand */}
        <div className="text-center space-y-2 animate-fade-in">
          <div className="flex justify-center">
            <div className="gradient-primary h-16 w-16 rounded-2xl flex items-center justify-center shadow-glow">
              <CheckSquare className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-focus bg-clip-text text-transparent">
            Taskly
          </h1>
          <p className="text-muted-foreground">
            Smart Task Management
          </p>
        </div>

        <Card className="shadow-elegant animate-scale-in">
          <CardHeader>
            <CardTitle className="text-center text-xl">Welcome Back</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" className="w-full">
              {!isMobile ? (
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </TabsTrigger>
                </TabsList>
              ) : (
                <div className="mb-6" />
              )}

              <TabsContent value="email" className="space-y-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="m@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 text-sm"
                        onClick={() => setShowReset(true)}
                      >
                        Forgot password?
                      </Button>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading} variant="focus">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              {!isMobile && (
                <TabsContent value="phone">
                  <OTPLoginForm />
                </TabsContent>
              )}
            </Tabs>

            {!isMobile && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full hover-scale"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Chrome className="mr-2 h-4 w-4" />
                  )}
                  Continue with Google
                </Button>
              </>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Sign Up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}