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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const genai_1 = require("@google/genai");
let AiService = class AiService {
    constructor() {
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
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: genai_1.Type.ARRAY,
                        description: "List of catchy hooks",
                        items: {
                            type: genai_1.Type.STRING,
                        },
                    },
                }
            });
            const hooks = JSON.parse(response.text || '[]');
            return hooks;
        }
        catch (error) {
            console.error('Error generating hooks:', error);
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
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: genai_1.Type.ARRAY,
                        description: "List of assigned emojis to segments",
                        items: {
                            type: genai_1.Type.OBJECT,
                            properties: {
                                segmentId: {
                                    type: genai_1.Type.INTEGER,
                                    description: "The ID number of the segment from the prompt",
                                },
                                emoji: {
                                    type: genai_1.Type.STRING,
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
        }
        catch (error) {
            console.error('Error generating emojis:', error);
            throw new common_1.InternalServerErrorException('Failed to generate emojis');
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AiService);
//# sourceMappingURL=ai.service.js.map