import { GroqService } from '../groq/groq.service';
export declare class AiService {
    private readonly groqService;
    private readonly logger;
    private ai;
    constructor(groqService: GroqService);
    generateHooks(text: string): Promise<string[]>;
    generateEmojis(segments: any[]): Promise<any[]>;
    translateSubtitles(segments: any[], targetLanguage: string): Promise<any[]>;
}
