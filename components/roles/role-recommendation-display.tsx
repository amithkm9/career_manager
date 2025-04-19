"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { RoleRecommendation } from "@/lib/azure-recommendations"
import { getRecommendations } from "@/lib/recommendation-service"
import { Button } from "@/components/ui/button"
import { ResumeUpload } from "@/components/discovery/resume-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, RefreshCw, Heart, Briefcase } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { trackEvent } from "@/lib/openreplay"
import { useAuth } from "@/context/auth-context"

export function RoleRecommendationsDisplay() {
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [recommendations, setRecommendations] = useState<RoleRecommendation[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleRecommendation | null>(null)
  const [activeTab, setActiveTab] = useState<string>("roles")
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    fetchRecommendations()
  }, [user])

  const fetchRecommendations = async (forceRefresh = false) => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      if (forceRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      const roleRecommendations = await getRecommendations({
        userId: user.id,
        forceRefresh
      })

      setRecommendations(roleRecommendations)
    } catch (error) {
      console.error("Error fetching recommendations:", error)
      toast({
        title: "Error",
        description: "Failed to load role recommendations. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefreshRecommendations = () => {
    fetchRecommendations(true)
  }

  const handleSelectRole = async (role: RoleRecommendation) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to select a role",
        variant: "destructive",
      })
      return
    }

    try {
      // Track role selection
      trackEvent("role_selected", { role: role.role_title })

      // Update the selected role in state
      setSelectedRole(role)

      // Update the role_selected field in the profiles table
      const { error } = await supabase
        .from("profiles")
        .update({
          role_selected: role.role_title,
        })
        .eq("id", user.id)

      if (error) {
        throw error
      }

      toast({
        title: "Role selected",
        description: `You've selected ${role.role_title} as your career path.`,
      })

      // Redirect to roadmap
      router.push("/roadmap")
    } catch (error) {
      console.error("Error in role selection:", error)
      toast({
        title: "Error",
        description: "There was a problem processing your selection. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleResumeProcessed = (resumeUrl: string) => {
    // When a resume is processed, refresh recommendations
    handleRefreshRecommendations()
    
    // Show success message
    toast({
      title: "Resume processed",
      description: "Your resume has been analyzed and recommendations updated.",
    })
    
    // Switch back to roles tab
    setActiveTab("roles")
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Analyzing your profile and generating recommendations...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Career Recommendations</h1>
        <Button 
          variant="outline" 
          onClick={handleRefreshRecommendations}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <Tabs 
        defaultValue="roles" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
          <TabsTrigger value="roles">Role Recommendations</TabsTrigger>
          <TabsTrigger value="resume">Upload Resume</TabsTrigger>
        </TabsList>
        
        <TabsContent value="roles" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendations.map((role, index) => (
              <Card key={index} className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>{role.role_title}</CardTitle>
                  <CardDescription>
                    {role.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                  <div className="space-y-4 flex-grow">
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-1 text-primary">
                        <Briefcase className="h-4 w-4" />
                        Professional Fit
                      </h4>
                      <p className="text-sm mt-1 text-gray-600">
                        {role.why_it_fits_professionally}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-1 text-primary">
                        <Heart className="h-4 w-4" />
                        Personal Fit
                      </h4>
                      <p className="text-sm mt-1 text-gray-600">
                        {role.why_it_fits_personally}
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => handleSelectRole(role)} 
                    className="w-full mt-4 bg-primary hover:bg-primary/90"
                  >
                    Select This Role
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-gray-500 mb-4">
              Want more accurate recommendations? Upload your resume for personalized role matching.
            </p>
            <Button variant="outline" onClick={() => setActiveTab("resume")}>
              Upload Your Resume
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="resume" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhance Your Recommendations</CardTitle>
              <CardDescription>
                Upload your resume to improve your role recommendations with skills and experience from your CV.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeUpload onResumeProcessed={handleResumeProcessed} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}