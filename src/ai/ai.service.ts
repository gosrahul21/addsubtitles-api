import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';
import { GroqService } from '../groq/groq.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;

  constructor(private readonly groqService: GroqService) {
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
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: 'List of catchy hooks',
            items: {
              type: Type.STRING,
            },
          },
        },
      });

      const hooks = JSON.parse(response.text || '[]');
      return hooks;
    } catch (error) {
      this.logger.error('Error generating hooks:', error);
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
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: 'List of assigned emojis to segments',
            items: {
              type: Type.OBJECT,
              properties: {
                segmentId: {
                  type: Type.INTEGER,
                  description: 'The ID number of the segment from the prompt',
                },
                emoji: {
                  type: Type.STRING,
                  description: 'A single relevant emoji character',
                },
              },
              required: ['segmentId', 'emoji'],
            },
          },
        },
      });

      const emojiMapping = JSON.parse(response.text || '[]');
      return emojiMapping;
    } catch (error) {
      this.logger.error('Error generating emojis:', error);
      throw new InternalServerErrorException('Failed to generate emojis');
    }
  }

  /**
   * Translates subtitle segments using Groq (Llama 3.3 70B Versatile)
   * Falls back to Gemini if Groq is unavailable
   */
  async translateSubtitles(segments: any[], targetLanguage: string): Promise<any[]> {
    if (!segments || segments.length === 0) return [];

    try {
      if (this.groqService.isAvailable()) {
        this.logger.log(`Using Groq Llama 3.3 for subtitle translation to ${targetLanguage}`);
        return await this.groqService.translateSubtitles(segments, targetLanguage);
      }
    } catch (groqErr: any) {
      this.logger.warn(`Groq translation failed (${groqErr.message}). Falling back to Gemini...`);
    }

    // Fallback: Gemini translation
    try {
      this.logger.log(`Using Gemini fallback for subtitle translation to ${targetLanguage}`);
      const textRepresentation = segments
        .map((s, idx) => `[ID: ${s.id !== undefined ? s.id : idx}] ${s.text || s.label}`)
        .join('\n');

      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Translate the following video subtitle segments into "${targetLanguage}".
Keep translations concise to fit the spoken duration.
Return a JSON array of objects with structure: [{"id": number, "translatedText": string}].

Subtitles:
${textRepresentation}`,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed: Array<{ id: number; translatedText: string }> = JSON.parse(response.text || '[]');

      return segments.map((seg, idx) => {
        const segId = seg.id !== undefined ? seg.id : idx;
        const match = parsed.find((p) => p.id === segId || p.id === idx) || parsed[idx];
        const translatedText = match?.translatedText || seg.text || seg.label;

        const start = Number(seg.start ?? seg.timestampStart ?? 0);
        const end = Number(seg.end ?? seg.timestampEnd ?? start + 1);
        const duration = Math.max(0.2, end - start);
        const words = (translatedText || '').trim().split(/\s+/).filter(Boolean);
        const wordDuration = duration / Math.max(1, words.length);

        const translatedWords = words.map((word, wIdx) => ({
          word,
          start: Number((start + wIdx * wordDuration).toFixed(2)),
          end: Number((start + (wIdx + 1) * wordDuration).toFixed(2)),
          speaker: seg.speaker || 'A',
        }));

        return {
          ...seg,
          text: translatedText,
          label: translatedText,
          words: translatedWords,
          wordsJson: translatedWords,
        };
      });
    } catch (fallbackErr: any) {
      this.logger.error('Gemini fallback translation failed:', fallbackErr);
      throw new InternalServerErrorException('Failed to translate subtitles');
    }
  }
}
