import { GoogleGenAI, Modality } from "@google/genai";

// Ensure the API key is available from environment variables
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const defaultAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface ImageInput {
  data: string; // Base64 encoded string without the data URL prefix
  mimeType: string;
}

const getAiClient = (apiKey?: string): GoogleGenAI => {
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }
  return defaultAi;
};

/**
 * Generates an image using the Gemini API based on a text prompt and selected model.
 * @param prompt The text prompt to generate an image from.
 * @param aspectRatio The desired aspect ratio for the image (for supported models).
 * @param model The selected model for image generation.
 * @param image Optional image data for editing.
 * @param apiKey Optional custom API key to override the default.
 * @returns A promise that resolves to the base64 encoded image string.
 */
export const generateImage = async (
  prompt: string,
  aspectRatio: string,
  model: string,
  image?: ImageInput,
  apiKey?: string,
): Promise<string> => {
  const ai = getAiClient(apiKey);
  try {
    if (model === 'imagen-4.0-generate-001') {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png', // Generate high-quality PNG
          aspectRatio: aspectRatio,
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages[0].image.imageBytes;
      }
    } else if (model === 'gemini-2.5-flash-image-preview') {
      const parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = [];

      if (image) {
        parts.push({
          inlineData: {
            data: image.data,
            mimeType: image.mimeType,
          },
        });
      }

      if (prompt.trim()) {
        parts.push({ text: prompt });
      }

      if (parts.length === 0) {
        throw new Error('error_prompt_or_image_required_for_edit');
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData) {
          return part.inlineData.data;
        }
      }
    }
    
    throw new Error('error_no_images_returned');

  } catch (error) {
    console.error('Error generating image with Gemini API:', error);

    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('resource_exhausted')) {
            throw new Error('error_quota');
        }
        if (errorMessage.includes('api') && errorMessage.includes('key')) {
             throw new Error('error_api_key');
        }
    }
    
    throw new Error('error_generic');
  }
};