"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { PhoneCollectionModal } from "@/components/phone-collection-modal"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [needsPhoneNumber, setNeedsPhoneNumber] = useState(false)

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        // Get the current session
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          setUserId(session.user.id)

          // Fetch user profile data
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("discovery_done, role_selected, phone_number")
            .eq("id", session.user.id)
            .single()

          if (profileError) {
            console.error("Error fetching profile:", profileError)
            router.push("/dashboard") // Default fallback
            return
          }

          // Check if phone number is missing
          if (!profileData.phone_number) {
            setNeedsPhoneNumber(true)
            setIsLoading(false)
            return
          }

          // Continue with normal redirect flow
          redirectBasedOnUserStatus(profileData)
        } else {
          // If no session, redirect to home
          router.push("/")
        }
      } catch (error) {
        console.error("Error in auth callback:", error)
        router.push("/") // Default fallback on error
      } finally {
        if (!needsPhoneNumber) {
          setIsLoading(false)
        }
      }
    }

    handleRedirect()
  }, [router, needsPhoneNumber])

  const redirectBasedOnUserStatus = (profileData: any) => {
    // Conditional redirect based on profile data
    if (profileData?.role_selected) {
      router.push("/dashboard")
    } else if (profileData?.discovery_done) {
      router.push("/roles")
    } else {
      router.push("/discovery")
    }
  }

  const handlePhoneNumberComplete = async () => {
    setIsLoading(true)
    
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

      // Continue with normal redirect flow
      redirectBasedOnUserStatus(profileData)
    } catch (error) {
      console.error("Error after phone collection:", error)
      router.push("/dashboard") // Default fallback
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      {isLoading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <h2 className="text-xl font-semibold">Signing you in...</h2>
          <p className="text-muted-foreground">You'll be redirected shortly</p>
        </div>
      ) : needsPhoneNumber && userId ? (
        <PhoneCollectionModal 
          isOpen={needsPhoneNumber} 
          onOpenChange={(open) => setNeedsPhoneNumber(open)}
          userId={userId}
          onComplete={handlePhoneNumberComplete}
        />
      ) : null}
    </div>
  )
}