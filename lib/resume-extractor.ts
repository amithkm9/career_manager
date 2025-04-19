// lib/resume-extractor.ts

/**
 * Extracts text from a resume PDF using Mistral's OCR API
 */
export async function extractResumeText(
    documentUrl: string,
    apiKey: string
  ): Promise<string> {
    // Validate inputs
    if (!documentUrl) throw new Error('Document URL is required');
    if (!apiKey) throw new Error('Mistral API key is required');
  
    try {
      // Call Mistral OCR API
      const response = await fetch('https://api.mistral.ai/v1/ocr/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-ocr-latest',
          document: {
            type: 'document_url',
            document_url: documentUrl
          },
          include_image_base64: true
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OCR extraction failed: ${error.message || response.statusText}`);
      }
  
      const data = await response.json();
      
      // Combine all markdown pages into a single string
      let markdownContent = '';
      for (const page of data.pages) {
        markdownContent += page.markdown + '\n\n';
      }
      
      return markdownContent;
    } catch (error) {
      console.error('Error extracting resume text:', error);
      throw error;
    }
  }