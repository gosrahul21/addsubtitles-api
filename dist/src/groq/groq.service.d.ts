import { WordEntry } from '../deepgram/deepgram.service';
export declare class GroqService {
    private readonly logger;
    private groq;
    private readonly TRANSLATE_MODEL;
    private readonly STT_MODEL;
    constructor();
    isAvailable(): boolean;
    transcribeAudio(audioBuffer: Buffer, language?: string): Promise<WordEntry[]>;
    transcribeUrl(url: string, language?: string): Promise<WordEntry[]>;
    translateSubtitles(segments: any[], targetLanguage: string): Promise<any[]>;
}
