import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI, Type, Schema } from '@google/genai';

@Injectable()
export class AiService {
  private ai: GoogleGenAI;

  constructor() {
    // Ensure you have GEMINI_API_KEY set in your environment
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }

  async generateHooks(text: string): Promise<string[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `You are an expert social media manager. Generate 3 short, engaging, viral video hooks (max 1 sentence each) based on the following transcript:
"${text}"
Return them as a JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "List of catchy hooks",
            items: {
              type: Type.STRING,
            },
          },
        }
      });
      
      const hooks = JSON.parse(response.text || '[]');
      return hooks;
    } catch (error) {
      console.error('Error generating hooks:', error);
      throw new InternalServerErrorException('Failed to generate hooks');
    }
  }

  async generateEmojis(segments: any[]): Promise<any[]> {
    try {
      const textRepresentation = segments.map((s, idx) => `[ID: ${idx}] ${s.label}`).join('\n');
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `You are a video editing AI. Given the following numbered list of subtitle segments, assign a relevant emoji to the segments that represent a strong emotion or key concept. Do not assign emojis to every segment, only the most impactful ones. 

Transcript:
${textRepresentation}

Return a JSON array of objects with the structure: [{ "segmentId": number, "emoji": string }].`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "List of assigned emojis to segments",
            items: {
              type: Type.OBJECT,
              properties: {
                segmentId: {
                  type: Type.INTEGER,
                  description: "The ID number of the segment from the prompt",
                },
                emoji: {
                  type: Type.STRING,
                  description: "A single relevant emoji character",
                },
              },
              required: ["segmentId", "emoji"],
            },
          },
        }
      });
      
      const emojiMapping = JSON.parse(response.text || '[]');
      return emojiMapping;
    } catch (error) {
      console.error('Error generating emojis:', error);
      throw new InternalServerErrorException('Failed to generate emojis');
    }
  }
}
