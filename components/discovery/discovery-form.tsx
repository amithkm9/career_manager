"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { InterestsSection } from "./interests-section"
import { SkillsSection } from "./skills-section"
import { ValuesSection } from "./values-section"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import { trackEvent } from "@/lib/openreplay"
import { ResumeUpload } from "@/components/discovery/resume-upload"

// Define the structure of our discovery data
interface DiscoveryData {
  interests: {
    selected: string[]
    additional_info: string
  }
  skills: {
    selected: string[]
    additional_info: string
  }
  values: {
    selected: string[]
    additional_info: string
  }
  timestamp: string
}

export function DiscoveryForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [resumeUrl, setResumeUrl] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const router = useRouter()
  const { user } = useAuth()

  // Collapsible state
  const [sections, setSections] = useState({
    interests: true,
    skills: false,
    values: false
  })

  // Selected items state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedValues, setSelectedValues] = useState<string[]>([])

  // Additional information state
  const [interestsInfo, setInterestsInfo] = useState("")
  const [skillsInfo, setSkillsInfo] = useState("")
  const [valuesInfo, setValuesInfo] = useState("")

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setLoadingData(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("discovery_data, resume_link")
          .eq("id", user.id)
          .single()

        if (error) {
          throw error
        }

        if (data && data.discovery_data) {
          const discoveryData = data.discovery_data as DiscoveryData
          
          // Set selected items
          setSelectedInterests(discoveryData.interests.selected || [])
          setSelectedSkills(discoveryData.skills.selected || [])
          setSelectedValues(discoveryData.values.selected || [])
          
          // Set additional info
          setInterestsInfo(discoveryData.interests.additional_info || "")
          setSkillsInfo(discoveryData.skills.additional_info || "")
          setValuesInfo(discoveryData.values.additional_info || "")
        }

        if (data && data.resume_link) {
          // Store the resume URL
          setResumeUrl(data.resume_link)
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
        toast({
          title: "Error",
          description: "Failed to load your profile data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingData(false)
      }
    }

    fetchUserData()
  }, [user])

  const toggleSection = (section: 'interests' | 'skills' | 'values') => {
    setSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleResumeProcessed = (url: string) => {
    setResumeUrl(url)
    toast({
      title: "Resume uploaded",
      description: "Your resume has been uploaded successfully and will be used to enhance your recommendations.",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate that no more than 5 items are selected in each category
    if (selectedInterests.length > 5 || selectedSkills.length > 5 || selectedValues.length > 5) {
      toast({
        title: "Too many selections",
        description: "Please select no more than 5 options in each category",
        variant: "destructive",
      })
      return
    }

    // Validate form
    if (selectedInterests.length === 0 || selectedSkills.length === 0 || selectedValues.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select at least one option in each category",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your discovery information",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Create the discovery data JSON object
      const discoveryData: DiscoveryData = {
        interests: {
          selected: selectedInterests,
          additional_info: interestsInfo,
        },
        skills: {
          selected: selectedSkills,
          additional_info: skillsInfo,
        },
        values: {
          selected: selectedValues,
          additional_info: valuesInfo,
        },
        timestamp: new Date().toISOString(),
      }

      // Create an update object for the profile
      const profileUpdate: any = {
        discovery_data: discoveryData,
        discovery_done: true,
      }

      // If we have a resume URL, add it to the profile update
      if (resumeUrl) {
        profileUpdate.resume_link = resumeUrl
      }

      // Save discovery data and resume link to Supabase
      const { error } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id)

      if (error) {
        throw error
      }

      toast({
        title: "Discovery completed",
        description: "Your information has been saved successfully",
      })

      // Track CV upload in OpenReplay if resume was uploaded
      if (resumeUrl) {
        trackEvent("discovery_completed_with_resume", {
          interests: selectedInterests,
          skills: selectedSkills,
          values: selectedValues,
        });
      } else {
        trackEvent("discovery_completed", {
          interests: selectedInterests,
          skills: selectedSkills,
          values: selectedValues,
        });
      }

      // Redirect to roles page
      router.push("/roles")
    } catch (error) {
      console.error("Error saving discovery data:", error)
      toast({
        title: "Error",
        description: "There was an error saving your information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading your profile data...</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      {/* Interests Section */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection('interests')}>
          <h2 className="text-2xl font-semibold">Interests</h2>
          <Button variant="ghost" size="sm" type="button">
            {sections.interests ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
          </Button>
        </div>
        
        {sections.interests && (
          <InterestsSection
            selectedInterests={selectedInterests}
            setSelectedInterests={setSelectedInterests}
            interestsInfo={interestsInfo}
            setInterestsInfo={setInterestsInfo}
            maxSelections={5}
          />
        )}
      </div>

      {/* Skills Section */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection('skills')}>
          <h2 className="text-2xl font-semibold">Skills</h2>
          <Button variant="ghost" size="sm" type="button">
            {sections.skills ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
          </Button>
        </div>
        
        {sections.skills && (
          <SkillsSection
            selectedSkills={selectedSkills}
            setSelectedSkills={setSelectedSkills}
            skillsInfo={skillsInfo}
            setSkillsInfo={setSkillsInfo}
            maxSelections={5}
          />
        )}
      </div>

      {/* Values Section */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection('values')}>
          <h2 className="text-2xl font-semibold">Values</h2>
          <Button variant="ghost" size="sm" type="button">
            {sections.values ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
          </Button>
        </div>
        
        {sections.values && (
          <ValuesSection
            selectedValues={selectedValues}
            setSelectedValues={setSelectedValues}
            valuesInfo={valuesInfo}
            setValuesInfo={setValuesInfo}
            maxSelections={5}
          />
        )}
      </div>

      {/* CV Upload Section - Updated to use ResumeUpload component */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Upload Your Resume/CV</h2>
        <p className="text-muted-foreground mb-6">
          Upload your resume to help us better understand your background and provide more accurate role recommendations.
        </p>

        <ResumeUpload onResumeProcessed={handleResumeProcessed} />
      </div>

      {/* Submit Button */}
      <div className="flex justify-center mt-8">
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Complete Discovery"
          )}
        </Button>
      </div>
    </form>
  )
}