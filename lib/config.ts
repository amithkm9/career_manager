// lib/config.ts

/**
 * Configuration values for the API services.
 * These can be loaded from environment variables.
 */

// Mistral API Configuration
export const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';

// Azure OpenAI Configuration
export const AZURE_INFERENCE_ENDPOINT = process.env.AZURE_INFERENCE_SDK_ENDPOINT || 'https://techc-m9gn6hvm-eastus2.services.ai.azure.com/models';
export const AZURE_INFERENCE_KEY = process.env.AZURE_INFERENCE_SDK_KEY || '';
export const AZURE_DEPLOYMENT_NAME = process.env.DEPLOYMENT_NAME || 'Phi-4';

// Supabase Configuration (for storing user data and recommendations)
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';