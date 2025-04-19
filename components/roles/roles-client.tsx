"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"
import { Loader2, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { RoleRecommendationsDisplay } from "@/components/roles/role-recommendations-display"
import { RoleRecommendation, defaultRecommendations } from "@/lib/azure-recommendations"
import { getRecommendations } from "@/lib/recommendation-service"

export function RolesClient() {
  const [isLoading, setIsLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<RoleRecommendation[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleRecommendation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { user } = useAuth()

  // Fetch recommendations when component mounts
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user) {
        setIsLoading(false)
        setError("You need to be logged in to view recommendations")
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const roleRecommendations = await getRecommendations({
          userId: user.id
        })
        
        setRecommendations(roleRecommendations)
      } catch (error) {
        console.error("Error fetching recommendations:", error)
        setError("Failed to load recommendations")
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecommendations()
  }, [user])

  // If not logged in, show login prompt
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-2xl font-bold mb-4">Login Required</h2>
        <p className="text-center mb-6">
          Please log in to view your personalized role recommendations.
        </p>
        <Button onClick={() => router.push("/")}>
          Return to Home
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Analyzing your profile and generating recommendations...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 flex items-start max-w-md">
          <AlertCircle className="h-5 w-5 text-red-500 mr-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-700 font-medium">Error loading recommendations</p>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        </div>
        <Button onClick={() => router.push("/discovery")}>
          Return to Discovery
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          onClick={() => router.push("/discovery")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m12 19-7-7 7-7"></path>
            <path d="M19 12H5"></path>
          </svg>
          Back to Discovery
        </Button>
      </div>

      <RoleRecommendationsDisplay />
    </div>
  )
}