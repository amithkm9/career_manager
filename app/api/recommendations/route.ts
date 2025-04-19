// app/api/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { extractResumeText } from "@/lib/resume-extractor";
import { 
  defaultRecommendations, 
  type RoleRecommendation 
} from "@/lib/azure-recommendations";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Azure OpenAI client
const azureInferenceEndpoint = process.env.AZURE_INFERENCE_SDK_ENDPOINT || "https://techc-m9gn6hvm-eastus2.services.ai.azure.com/models";
const azureInferenceKey = process.env.AZURE_INFERENCE_SDK_KEY as string;
const deploymentName = process.env.DEPLOYMENT_NAME || "Phi-4";

const client = new ModelClient(
  azureInferenceEndpoint,
  new AzureKeyCredential(azureInferenceKey)
);

// Mistral API Key for resume extraction
const mistralApiKey = process.env.MISTRAL_API_KEY as string;

export async function POST(request: NextRequest) {
  try {
    // Get request data
    const { userId, resumeUrl } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId in request" },
        { status: 400 }
      );
    }

    // Variables to store our data
    let resumeText = '';
    let discoveryData: any = null;

    // Fetch user profile data from Supabase
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("discovery_data, resume_link")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile data:", profileError);
      // Continue with default values
    } else {
      discoveryData = profileData?.discovery_data;
      
      // If no resumeUrl was provided but user has one in profile, use that
      if (!resumeUrl && profileData?.resume_link) {
        resumeUrl = profileData.resume_link;
      }
    }

    // Extract text from resume if URL is provided
    if (resumeUrl) {
      try {
        console.log("Extracting text from resume:", resumeUrl);
        resumeText = await extractResumeText(resumeUrl, mistralApiKey);
        console.log("Successfully extracted text from resume");
        
        // Store the extracted text in Supabase (optional)
        if (resumeText) {
          await supabase
            .from("profiles")
            .update({ resume_text: resumeText })
            .eq("id", userId);
        }
      } catch (error) {
        console.error("Error extracting resume text:", error);
        // Continue with empty resume text
      }
    }

    // If no discovery data and no resume, return default recommendations
    if (!discoveryData && !resumeText) {
      console.log("No discovery data or resume for user, returning default recommendations");
      return NextResponse.json({ recommendations: defaultRecommendations });
    }

    // Prepare the data for Azure OpenAI
    const formattedData = {
      skills: {
        selected: discoveryData?.skills?.selected || [],
        additional_info: discoveryData?.skills?.additional_info || ""
      },
      values: {
        selected: discoveryData?.values?.selected || [],
        additional_info: discoveryData?.values?.additional_info || ""
      },
      interests: {
        selected: discoveryData?.interests?.selected || [],
        additional_info: discoveryData?.interests?.additional_info || ""
      },
      timestamp: discoveryData?.timestamp || new Date().toISOString(),
      "Resume Summary": {
        skills: [], // If available, could parse from CV
        projects: [], // If available, could parse from CV
        experiences: [], // If available, could parse from CV
        education: {} // If available, could parse from CV
      }
    };

    // Create the prompt for Azure OpenAI
    const messages = [
      {
        role: "system",
        content: `You are a career coach and AI expert who helps individuals identify the most suitable career roles for them.
          Your task is to analyze the given information and suggest exactly 3 career roles that best fit the person's profile.
          
          Your output MUST be a valid JSON array with 3 objects representing career recommendations.
          Each object must have exactly these fields: role_title, description, why_it_fits_professionally, why_it_fits_personally.
          The response must be ONLY the JSON array with no other text, no explanation, no formatting marks like \`\`\`.
          
          Here is the exact format:
          [
            {
              "role_title": "First Job Title",
              "description": "Description of first role",
              "why_it_fits_professionally": "Professional fit for first role",
              "why_it_fits_personally": "Personal fit for first role"
            },
            {
              "role_title": "Second Job Title",
              "description": "Description of second role",
              "why_it_fits_professionally": "Professional fit for second role",
              "why_it_fits_personally": "Personal fit for second role"
            },
            {
              "role_title": "Third Job Title",
              "description": "Description of third role",
              "why_it_fits_professionally": "Professional fit for third role",
              "why_it_fits_personally": "Personal fit for third role"
            }
          ]
          
          Important: DO NOT include any text outside the JSON array. The response must be parseable by JSON.parse().`
      },
      {
        role: "user",
        content: `Please analyze this profile and provide exactly 3 career recommendations in JSON format:
          
          Skills: ${JSON.stringify(formattedData.skills)}
          Interests: ${JSON.stringify(formattedData.interests)}
          Values: ${JSON.stringify(formattedData.values)}
          ${resumeText ? `Resume Text: ${resumeText}` : ''}
          
          Remember, I need ONLY the JSON array with 3 career recommendations, nothing else.`
      },
    ];

    // Generate role recommendations
    let roleRecommendations: RoleRecommendation[] = defaultRecommendations;
    
    try {
      // Make the API call to Azure OpenAI
      const response = await client.path("chat/completions").post({
        body: {
          messages: messages,
          max_tokens: 1500,
          model: deploymentName,
        },
      });

      if (!response.body) {
        console.error("No response from Azure OpenAI");
        return NextResponse.json({ recommendations: defaultRecommendations });
      }

      // Parse the response
      try {
        const responseContent = response.body.choices[0].message.content;
        console.log("Raw response from Azure OpenAI:", responseContent);
        
        // Try to clean the response if it's not valid JSON
        let jsonString = responseContent.trim();
        
        // Sometimes the AI adds markdown code blocks, remove them
        if (jsonString.startsWith("```json")) {
          jsonString = jsonString.replace(/```json\n/, "").replace(/\n```$/, "");
        } else if (jsonString.startsWith("```")) {
          jsonString = jsonString.replace(/```\n/, "").replace(/\n```$/, "");
        }
        
        // Sometimes AI adds explanatory text before or after the JSON
        // Try to extract just the JSON array part
        const jsonArrayMatch = jsonString.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonArrayMatch) {
          jsonString = jsonArrayMatch[0];
        }
        
        roleRecommendations = JSON.parse(jsonString);
        
        // Ensure it's an array
        if (!Array.isArray(roleRecommendations)) {
          if (typeof roleRecommendations === 'object') {
            // If it's an object but not an array, try to convert it to an array
            roleRecommendations = [roleRecommendations];
          } else {
            throw new Error("Response is not an array or object");
          }
        }
        
        // Store recommendations in Supabase
        for (const rec of roleRecommendations) {
          await supabase.from("role_recommendations").insert({
            user_id: userId,
            role_title: rec.role_title,
            description: rec.description,
            why_it_fits_professionally: rec.why_it_fits_professionally,
            why_it_fits_personally: rec.why_it_fits_personally
          });
        }
        
      } catch (error) {
        console.error("Error parsing Azure OpenAI response:", error);
        console.error("Response content:", response.body.choices[0].message.content);
        
        // Return fallback recommendations
        roleRecommendations = defaultRecommendations;
      }
      
    } catch (error) {
      console.error("Error calling Azure OpenAI:", error);
      roleRecommendations = defaultRecommendations;
    }

    // Return the recommendations
    return NextResponse.json({ recommendations: roleRecommendations });
      
  } catch (error) {
    console.error("Error in API route:", error);
    return NextResponse.json(
      { error: "Server error", recommendations: defaultRecommendations },
      { status: 500 }
    );
  }
}