"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const genai_1 = require("@google/genai");
const groq_service_1 = require("../groq/groq.service");
let AiService = AiService_1 = class AiService {
    constructor(groqService) {
        this.groqService = groqService;
        this.logger = new common_1.Logger(AiService_1.name);
        this.ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }
    async generateHooks(text) {
        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: `You are an expert social media manager. Generate 3 short, engaging, viral video hooks (max 1 sentence each) based on the following transcript:
"${text}"
Return them as a JSON array of strings.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: genai_1.Type.ARRAY,
                        description: 'List of catchy hooks',
                        items: {
                            type: genai_1.Type.STRING,
                        },
                    },
                },
            });
            const hooks = JSON.parse(response.text || '[]');
            return hooks;
        }
        catch (error) {
            this.logger.error('Error generating hooks:', error);
            throw new common_1.InternalServerErrorException('Failed to generate hooks');
        }
    }
    async generateEmojis(segments) {
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
                        type: genai_1.Type.ARRAY,
                        description: 'List of assigned emojis to segments',
                        items: {
                            type: genai_1.Type.OBJECT,
                            properties: {
                                segmentId: {
                                    type: genai_1.Type.INTEGER,
                                    description: 'The ID number of the segment from the prompt',
                                },
                                emoji: {
                                    type: genai_1.Type.STRING,
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
        }
        catch (error) {
            this.logger.error('Error generating emojis:', error);
            throw new common_1.InternalServerErrorException('Failed to generate emojis');
        }
    }
    async translateSubtitles(segments, targetLanguage) {
        if (!segments || segments.length === 0)
            return [];
        try {
            if (this.groqService.isAvailable()) {
                this.logger.log(`Using Groq Llama 3.3 for subtitle translation to ${targetLanguage}`);
                return await this.groqService.translateSubtitles(segments, targetLanguage);
            }
        }
        catch (groqErr) {
            this.logger.warn(`Groq translation failed (${groqErr.message}). Falling back to Gemini...`);
        }
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
            const parsed = JSON.parse(response.text || '[]');
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
        }
        catch (fallbackErr) {
            this.logger.error('Gemini fallback translation failed:', fallbackErr);
            throw new common_1.InternalServerErrorException('Failed to translate subtitles');
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [groq_service_1.GroqService])
], AiService);
//# sourceMappingURL=ai.service.js.map