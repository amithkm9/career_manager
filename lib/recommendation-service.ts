// lib/recommendation-service.ts
import { RoleRecommendation, defaultRecommendations } from "@/lib/azure-recommendations";
import { supabase } from "@/lib/supabase";

interface GetRecommendationsParams {
  userId: string;
  forceRefresh?: boolean;
}

interface GenerateRecommendationsParams {
  userId: string;
  resumeUrl?: string;
}

/**
 * Fetches role recommendations for a user
 * First checks if recommendations exist in Supabase, then generates new ones if needed
 */
export async function getRecommendations({
  userId,
  forceRefresh = false
}: GetRecommendationsParams): Promise<RoleRecommendation[]> {
  if (!userId) {
    console.error("No userId provided to getRecommendations");
    return defaultRecommendations;
  }

  try {
    // If not forcing refresh, try to get existing recommendations
    if (!forceRefresh) {
      const { data: existingData, error: existingError } = await supabase
        .from("role_recommendations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);
        
      // If we have existing recommendations, use them
      if (!existingError && existingData && existingData.length > 0) {
        console.log("Using existing recommendations from database");
        return existingData.map(item => ({
          role_title: item.role_title,
          description: item.description,
          why_it_fits_professionally: item.why_it_fits_professionally,
          why_it_fits_personally: item.why_it_fits_personally,
        }));
      }
    }

    // If no existing recommendations or force refresh, generate new ones
    // Get user profile to check if they have a resume
    const { data: profile } = await supabase
      .from("profiles")
      .select("resume_link")
      .eq("id", userId)
      .single();

    // Generate new recommendations
    return await generateRecommendations({
      userId,
      resumeUrl: profile?.resume_link
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return defaultRecommendations;
  }
}

/**
 * Generates new role recommendations via the API
 */
export async function generateRecommendations({
  userId,
  resumeUrl
}: GenerateRecommendationsParams): Promise<RoleRecommendation[]> {
  try {
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        userId,
        resumeUrl
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch recommendations');
    }

    const data = await response.json();
    return data.recommendations;
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return defaultRecommendations;
  }
}