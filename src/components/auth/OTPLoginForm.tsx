import { useState } from "react";
import { ConfirmationResult } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Phone, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const phoneSchema = z.object({
  phoneNumber: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number with country code"),
});

const otpSchema = z.object({
  otp: z.string().min(6, "OTP must be 6 digits").max(6, "OTP must be 6 digits"),
});

interface OTPLoginFormProps {
  onBack?: () => void;
  className?: string;
}

export function OTPLoginForm({ onBack, className }: OTPLoginFormProps) {
  const { signInWithPhone, verifyPhoneOTP, loading } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phoneNumber: "",
    },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: "",
    },
  });

  const handleSendOTP = async (values: z.infer<typeof phoneSchema>) => {
    try {
      const formattedPhone = values.phoneNumber.startsWith('+') 
        ? values.phoneNumber 
        : `+${values.phoneNumber}`;
      
      const result = await signInWithPhone(formattedPhone);
      setConfirmationResult(result);
      setPhoneNumber(formattedPhone);
      setStep('otp');
    } catch (error) {
      console.error('Error sending OTP:', error);
    }
  };

  const handleVerifyOTP = async (values: z.infer<typeof otpSchema>) => {
    if (!confirmationResult) return;
    
    try {
      await verifyPhoneOTP(confirmationResult, values.otp);
    } catch (error) {
      console.error('Error verifying OTP:', error);
      otpForm.setError('otp', { message: 'Invalid OTP. Please try again.' });
    }
  };

  const handleResendOTP = async () => {
    if (!phoneNumber) return;
    
    try {
      const result = await signInWithPhone(phoneNumber);
      setConfirmationResult(result);
    } catch (error) {
      console.error('Error resending OTP:', error);
    }
  };

  const goBackToPhone = () => {
    setStep('phone');
    setConfirmationResult(null);
    otpForm.reset();
  };

  return (
    <Card className={cn("w-full max-w-md animate-fade-in", className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          {(step === 'otp' || onBack) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={step === 'otp' ? goBackToPhone : onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">
              {step === 'phone' ? 'Sign in with Phone' : 'Enter Verification Code'}
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === 'phone' ? (
          <>
            <div id="recaptcha-container" className="flex justify-center"></div>
            
            <Form {...phoneForm}>
              <form onSubmit={phoneForm.handleSubmit(handleSendOTP)} className="space-y-4">
                <FormField
                  control={phoneForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+1234567890"
                          {...field}
                          className="text-center font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Include country code (e.g., +1 for US, +91 for India)
                      </p>
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                  variant="focus"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    'Send OTP'
                  )}
                </Button>
              </form>
            </Form>
          </>
        ) : (
          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(handleVerifyOTP)} className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  We've sent a 6-digit code to
                </p>
                <p className="font-medium">{phoneNumber}</p>
              </div>

              <FormField
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Verification Code</FormLabel>
                    <FormControl>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={field.value}
                          onChange={field.onChange}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || otpForm.watch('otp').length !== 6}
                  variant="focus"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Sign In'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleResendOTP}
                  disabled={loading}
                >
                  Resend OTP
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}