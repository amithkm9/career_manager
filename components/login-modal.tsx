"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Mail, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { identifyUser } from "@/lib/openreplay"
import { PhoneCollectionModal } from "@/components/phone-collection-modal"

interface LoginModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginModal({ isOpen, onOpenChange }: LoginModalProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [needsPhoneNumber, setNeedsPhoneNumber] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Don't create a user if they don't exist
          shouldCreateUser: true,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      setOtpSent(true)
      toast({
        title: "OTP sent",
        description: "Check your email for the verification code",
      })
    } catch (err) {
      setError("An unexpected error occurred")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error, data } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      })

      if (error) {
        setError(error.message)
        return
      }

      // Store the user ID for later use
      if (data.user) {
        setUserId(data.user.id)
      }

      // Identify user in OpenReplay
      if (email) {
        identifyUser(email)
      }

      // Fetch user profile data to check for phone number
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("discovery_done, role_selected, phone_number")
        .eq("id", data.user?.id)
        .single()

      if (profileError) {
        console.error("Error fetching profile:", profileError)
      }

      // Check for stored questionnaire data and save it if exists
      const storedData = localStorage.getItem("questionnaire_data")
      if (storedData && data.user) {
        try {
          const { career_stage, roadmap_role } = JSON.parse(storedData)

          // Save to Supabase
          await supabase
            .from("profiles")
            .update({
              career_stage,
              roadmap_role,
            })
            .eq("id", data.user.id)

          // Clear stored data
          localStorage.removeItem("questionnaire_data")
        } catch (err) {
          console.error("Error saving questionnaire data after login:", err)
        }
      }

      // Check if phone number is missing
      if (!profileData?.phone_number) {
        setNeedsPhoneNumber(true)
        return
      }

      // If phone number exists, proceed with normal flow
      completeLogin(profileData)

    } catch (err) {
      setError("An unexpected error occurred")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError("An unexpected error occurred")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhoneNumberComplete = async () => {
    try {
      // Fetch updated profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("discovery_done, role_selected")
        .eq("id", userId)
        .single()

      if (profileError) {
        console.error("Error fetching profile after phone update:", profileError)
        router.push("/dashboard") // Default fallback
        return
      }

      // Continue with normal login flow
      completeLogin(profileData)
    } catch (error) {
      console.error("Error after phone collection:", error)
      router.push("/dashboard") // Default fallback
    }
  }

  const completeLogin = (profileData: any) => {
    toast({
      title: "Success",
      description: "You have been logged in successfully",
    })

    // Close the modal
    onOpenChange(false)

    // Conditional redirect based on profile data
    if (profileData?.role_selected) {
      router.push("/dashboard")
    } else if (profileData?.discovery_done) {
      router.push("/roles")
    } else {
      router.push("/discovery")
    }
  }

  const resetForm = () => {
    setEmail("")
    setOtp("")
    setOtpSent(false)
    setError(null)
    setUserId(null)
    setNeedsPhoneNumber(false)
  }

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) resetForm()
          onOpenChange(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login to ClassMent</DialogTitle>
            <DialogDescription>Access your personalized career roadmap and recommendations</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="email" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-4">
              {otpSent ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center mb-4">
                    <Mail className="h-12 w-12 text-primary mx-auto mb-2" />
                    <h3 className="text-lg font-medium">Check your email</h3>
                    <p className="text-muted-foreground">
                      We've sent a verification code to <strong>{email}</strong>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp">Enter verification code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      disabled={isLoading}
                      className="text-center text-lg tracking-widest"
                      maxLength={6}
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify Code"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOtpSent(false)
                        setOtp("")
                      }}
                      disabled={isLoading}
                    >
                      Use a different email
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="google" className="mt-4">
              <div className="text-center py-2">
                <p className="mb-4">Continue with your Google account</p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm mb-4">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                          <path
                            fill="#4285F4"
                            d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
                          />
                          <path
                            fill="#34A853"
                            d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
                          />
                          <path
                            fill="#EA4335"
                            d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
                          />
                        </g>
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Phone Collection Modal */}
      {userId && (
        <PhoneCollectionModal
          isOpen={needsPhoneNumber}
          onOpenChange={setNeedsPhoneNumber}
          userId={userId}
          onComplete={handlePhoneNumberComplete}
        />
      )}
    </>
  )
}