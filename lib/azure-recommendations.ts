// lib/azure-recommendations.ts
import { AzureKeyCredential } from '@azure/core-auth';
import { ModelClient } from '@azure-rest/ai-inference';

/**
 * Interface for role recommendation API request
 */
export interface RecommendationRequest {
  userId: string;
  discoveryData?: {
    skills: {
      selected: string[];
      additional_info: string;
    };
    interests: {
      selected: string[];
      additional_info: string;
    };
    values: {
      selected: string[];
      additional_info: string;
    };
    timestamp?: string;
    "Resume Summary"?: {
      skills: string[];
      projects: string[];
      experiences: string[];
      education: Record<string, any>;
    };
  };
  resumeText?: string;
}

/**
 * Interface for a role recommendation
 */
export interface RoleRecommendation {
  role_title: string;
  description: string;
  why_it_fits_professionally: string;
  why_it_fits_personally: string;
}

// Default recommendations to use as fallback
export const defaultRecommendations: RoleRecommendation[] = [
  {
    "role_title": "Software Developer",
    "description": "Software developers create applications and systems that run on computers and other devices. They design, code, test, and maintain software solutions for various problems and needs.",
    "why_it_fits_professionally": "Your technical skills and problem-solving abilities would make you a strong candidate for software development roles. Your experience with analytical thinking aligns well with the core competencies needed.",
    "why_it_fits_personally": "Your interest in creating solutions and solving complex problems makes software development a fulfilling career path that matches your personal interests."
  },
  {
    "role_title": "Data Analyst",
    "description": "Data analysts examine datasets to identify trends and draw conclusions. They present findings to help organizations make better business decisions.",
    "why_it_fits_professionally": "Your analytical thinking skills and attention to detail would serve you well as a data analyst. This role leverages your abilities to find patterns and insights in complex information.",
    "why_it_fits_personally": "Your curiosity and interest in uncovering insights from information makes data analysis a personally satisfying career that aligns with your values."
  },
  {
    "role_title": "Product Manager",
    "description": "Product managers oversee the development of products from conception to launch. They define product strategy, gather requirements, and coordinate with different teams to ensure successful delivery.",
    "why_it_fits_professionally": "Your combination of technical understanding and strategic planning abilities makes product management a good professional fit. This role utilizes both your analytical and communication skills.",
    "why_it_fits_personally": "Your interest in both the business and technical aspects of products, along with your desire to create meaningful solutions, aligns well with product management."
  }
];

/**
 * Generates role recommendations based on user profile and resume
 */
export async function generateRoleRecommendations(
  request: RecommendationRequest,
  azureEndpoint: string,
  azureApiKey: string,
  deploymentName: string = "Phi-4"
): Promise<RoleRecommendation[]> {
  try {
    // Initialize Azure OpenAI client
    const client = new ModelClient(
      azureEndpoint,
      new AzureKeyCredential(azureApiKey)
    );

    // Prepare discovery data for the prompt
    let formattedData = request.discoveryData || {
      skills: { selected: [], additional_info: "" },
      values: { selected: [], additional_info: "" },
      interests: { selected: [], additional_info: "" },
      timestamp: new Date().toISOString()
    };

    // If we have resume text, add it to the resume summary
    if (request.resumeText) {
      formattedData["Resume Summary"] = {
        skills: [], // Would require parsing from resume
        projects: [], // Would require parsing from resume
        experiences: [], // Would require parsing from resume
        education: {} // Would require parsing from resume
      };
    }

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
          ${request.resumeText ? `Resume Text: ${request.resumeText}` : ''}
          
          Remember, I need ONLY the JSON array with 3 career recommendations, nothing else.`
      },
    ];

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
      return defaultRecommendations;
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
      
      const roleRecommendations = JSON.parse(jsonString);
      
      // Ensure it's an array
      if (!Array.isArray(roleRecommendations)) {
        if (typeof roleRecommendations === 'object') {
          // If it's an object but not an array, try to convert it to an array
          return [roleRecommendations];
        } else {
          throw new Error("Response is not an array or object");
        }
      }

      return roleRecommendations;
    } catch (error) {
      console.error("Error parsing Azure OpenAI response:", error);
      console.error("Response content:", response.body.choices[0].message.content);
      
      // Return fallback recommendations
      return defaultRecommendations;
    }
  } catch (error) {
    console.error("Error calling Azure OpenAI:", error);
    return defaultRecommendations;
  }
}