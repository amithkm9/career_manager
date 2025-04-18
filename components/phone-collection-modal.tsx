"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

interface PhoneCollectionModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onComplete: () => void
}

export function PhoneCollectionModal({ isOpen, onOpenChange, userId, onComplete }: PhoneCollectionModalProps) {
  const [phone, setPhone] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Simple validation
    if (!phone || phone.trim().length < 10) {
      setError("Please enter a valid phone number")
      setIsLoading(false)
      return
    }

    try {
      // Update the user's profile with the phone number
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ phone_number: phone })
        .eq("id", userId)

      if (updateError) {
        throw updateError
      }

      toast({
        title: "Phone number saved",
        description: "Thank you for providing your contact information.",
      })

      // Close modal and call the completion callback
      onOpenChange(false)
      onComplete()
    } catch (err) {
      console.error("Error saving phone number:", err)
      setError("There was a problem saving your phone number. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Provide your contact number</DialogTitle>
          <DialogDescription>
            As part of our beta program, we need your phone number to provide personalized support and collect feedback.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {error && (
              <div className="flex items-center text-sm text-red-500 mt-1">
                <AlertCircle className="h-4 w-4 mr-1" />
                {error}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              We'll use this for communication about your account and to provide you with updates.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}