import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
      images?: Array<{
        image_url?: {
          url?: string;
        };
      }>;
    };
  }>;
}

// Resize image to fit within 1024x1024 total pixels while maintaining aspect ratio
async function resizeImageForLLM(dataUrl: string): Promise<string> {
  try {
    // Extract base64 data from data URL
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid data URL');
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image dimensions');
    }
    
    const totalPixels = 1024 * 1024; // 1,048,576 pixels total
    const aspectRatio = metadata.width / metadata.height;
    
    // Calculate dimensions to maintain aspect ratio with fixed total pixel count
    const newHeight = Math.sqrt(totalPixels / aspectRatio);
    const newWidth = newHeight * aspectRatio;
    
    // Resize image using sharp
    const resizedBuffer = await sharp(buffer)
      .resize(Math.floor(newWidth), Math.floor(newHeight), {
        fit: 'fill',
        withoutEnlargement: false
      })
      .jpeg({ quality: 90 })
      .toBuffer();
    
    // Convert back to data URL
    const resizedBase64 = resizedBuffer.toString('base64');
    return `data:image/jpeg;base64,${resizedBase64}`;
  } catch (error) {
    throw new Error(`Failed to resize image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, canvas, attachments, model, variantCount = 1, aspectRatio = '1:1' } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });
    }

    const selectedModel = model || process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image-preview';

    const rawImages: string[] = [...(Array.isArray(attachments) ? attachments : []), canvas]
      .filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('data:'));

    // Resize all images to optimize for LLM (1024x1024 total pixels)
    const images: string[] = [];
    for (const dataUrl of rawImages) {
      try {
        const resizedImage = await resizeImageForLLM(dataUrl);
        images.push(resizedImage);
      } catch (error) {
        console.warn('Failed to resize image, using original:', error);
        images.push(dataUrl); // Fallback to original
      }
    }

    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    if (typeof prompt === 'string' && prompt.trim().length > 0) {
      contentParts.push({ type: 'text', text: prompt.trim() });
    }
    for (const url of images) {
      contentParts.push({ type: 'image_url', image_url: { url } });
    }

    const body = {
      model: selectedModel,
      messages: [
        {
          role: 'user',
          content: contentParts.length > 0 ? contentParts : [{ type: 'text', text: 'Generate an image' }],
        },
      ],
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: aspectRatio,
      },
    };

    // Generate multiple variants in parallel with retry logic
    const variantCountNum = Math.min(Math.max(1, Number(variantCount) || 1), 4);
    
    const makeRequest = async (): Promise<{ response: Response; data: OpenRouterResponse }> => {
      const MAX_RETRIES = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
          const data = await response.json() as OpenRouterResponse;
          
          // Check if response has valid image data
          const hasValidImage = data?.choices?.length && 
            data.choices[0]?.message?.images?.length &&
            data.choices[0].message.images[0]?.image_url?.url;
          
          if (hasValidImage) {
            return { response, data };
          }
          
          // If no valid image, treat as error for retry
          throw new Error('No valid image in response');
          
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);
          
          if (attempt < MAX_RETRIES) {
            // Wait before retry (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw lastError || new Error('All retry attempts failed');
    };

    const requests = Array.from({ length: variantCountNum }, () => makeRequest());
    const results = await Promise.allSettled(requests);
    
    // Extract successful responses only
    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<{ response: Response; data: OpenRouterResponse }> => 
        result.status === 'fulfilled')
      .map(result => result.value);
    
    // Check if we have at least one successful result
    if (successfulResults.length === 0) {
      const failedResults = results.filter((result): result is PromiseRejectedResult => 
        result.status === 'rejected');
      const lastError = failedResults[failedResults.length - 1]?.reason;
      throw lastError || new Error('All variant generation attempts failed');
    }
    
    // Log partial success
    if (successfulResults.length < variantCountNum) {
      console.warn(`Generated ${successfulResults.length}/${variantCountNum} variants successfully`);
    }
    
    const dataResults = successfulResults.map(result => result.data);
    
    const variants: Array<{ image: string | null; text: string | null }> = [];
    let combinedText: string | null = null;

    for (const data of dataResults) {
      let image: string | null = null;
      let text: string | null = null;

      if (data?.choices?.length) {
        const msg = data.choices[0]?.message;
        text = typeof msg?.content === 'string' ? msg.content : null;
        const imgs = msg?.images;
        if (Array.isArray(imgs) && imgs.length > 0) {
          image = imgs[0]?.image_url?.url ?? null;
        }
      }

      variants.push({ image, text });
      
      // Combine text from all variants
      if (text && text.trim()) {
        if (combinedText) {
          combinedText += `\n\n--- Variant ${variants.length} ---\n${text}`;
        } else {
          combinedText = text;
        }
      }
    }

    return NextResponse.json({ 
      variants: variants.length > 1 ? variants : variants[0] ? [variants[0]] : [],
      text: combinedText,
      // For backward compatibility, also return single image
      image: variants[0]?.image || null
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 });
  }
}



