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
var GroqService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqService = void 0;
const common_1 = require("@nestjs/common");
const groq_sdk_1 = require("groq-sdk");
let GroqService = GroqService_1 = class GroqService {
    constructor() {
        this.logger = new common_1.Logger(GroqService_1.name);
        this.groq = null;
        this.TRANSLATE_MODEL = 'qwen/qwen3.8-27b';
        this.STT_MODEL = 'whisper-large-v3-turbo';
        const apiKey = process.env.GROQ_API_KEY;
        if (apiKey && apiKey.trim() !== '') {
            this.groq = new groq_sdk_1.default({ apiKey: apiKey.trim() });
            this.logger.log('Groq SDK initialized successfully');
        }
        else {
            this.logger.warn('GROQ_API_KEY is not configured in environment. Groq requests will fallback to Deepgram.');
        }
    }
    isAvailable() {
        return !!this.groq;
    }
    async transcribeAudio(audioBuffer, language) {
        if (!this.groq) {
            throw new Error('Groq client is not initialized (GROQ_API_KEY missing)');
        }
        this.logger.log(`Calling Groq Whisper API (${this.STT_MODEL}, lang: ${language || 'auto'})...`);
        const file = await (0, groq_sdk_1.toFile)(audioBuffer, 'audio.wav', { type: 'audio/wav' });
        const options = {
            file,
            model: this.STT_MODEL,
            response_format: 'verbose_json',
            timestamp_granularities: ['word'],
        };
        if (language && language !== 'multi' && language !== 'auto') {
            options.language = language.split('-')[0].toLowerCase();
        }
        const response = await this.groq.audio.transcriptions.create(options);
        const words = (response?.words || [])
            .map((w) => ({
            word: (w.word || '').trim(),
            start: Number(w.start),
            end: Number(w.end),
            speaker: 'A',
        }))
            .filter((w) => w.word && w.word.length > 0);
        this.logger.log(`Groq Whisper returned ${words.length} words`);
        return words;
    }
    async transcribeUrl(url, language) {
        this.logger.log(`Fetching audio from URL for Groq Whisper: ${url}`);
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to download audio from URL (${res.status}): ${res.statusText}`);
        }
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const maxBytes = 25 * 1024 * 1024;
        if (buffer.byteLength > maxBytes) {
            throw new Error(`Audio file size (${(buffer.byteLength / (1024 * 1024)).toFixed(2)}MB) exceeds Groq 25MB limit. Falling back to Deepgram.`);
        }
        return this.transcribeAudio(buffer, language);
    }
    async translateSubtitles(segments, targetLanguage) {
        if (!this.groq) {
            throw new Error('Groq client is not initialized (GROQ_API_KEY missing)');
        }
        if (!segments || segments.length === 0) {
            return [];
        }
        this.logger.log(`Translating ${segments.length} subtitle segments into "${targetLanguage}" using Groq (${this.TRANSLATE_MODEL})...`);
        const inputData = segments.map((s, idx) => ({
            id: s.id !== undefined ? s.id : idx,
            start: Number(s.start ?? s.timestampStart ?? 0),
            end: Number(s.end ?? s.timestampEnd ?? 0),
            text: s.text ?? s.label ?? '',
        }));
        const systemPrompt = `You are an expert multilingual subtitle translator for video content.
You will receive an array of subtitle segments. Translate each segment's "text" accurately and naturally into "${targetLanguage}".
CRITICAL GUIDELINES:
1. Preserve the meaning, punchiness, and emotional tone of the original speech.
2. Keep translations concise so they fit the duration between start and end.
3. Return ONLY a valid JSON object with the property "translations": an array of objects matching:
   {
     "translations": [
       { "id": <same id>, "translatedText": "<translated text in ${targetLanguage}>" }
     ]
   }
4. DO NOT change the IDs or order.`;
        const completion = await this.groq.chat.completions.create({
            model: this.TRANSLATE_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(inputData) },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });
        const content = completion.choices[0]?.message?.content || '{}';
        let translations = [];
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                translations = parsed;
            }
            else if (Array.isArray(parsed.translations)) {
                translations = parsed.translations;
            }
            else if (Array.isArray(parsed.segments)) {
                translations = parsed.segments;
            }
            else {
                const foundArray = Object.values(parsed).find((val) => Array.isArray(val));
                translations = foundArray || [];
            }
        }
        catch (parseErr) {
            this.logger.error(`Failed to parse Groq translation output: ${parseErr.message}`);
            throw new Error('Failed to parse translated subtitles from Groq');
        }
        return segments.map((seg, idx) => {
            const segId = seg.id !== undefined ? seg.id : idx;
            const match = translations.find((t) => t.id === segId || t.id === idx) || translations[idx];
            const translatedText = match?.translatedText || match?.['text'] || seg.text || seg.label;
            const start = Number(seg.start ?? seg.timestampStart ?? 0);
            const end = Number(seg.end ?? seg.timestampEnd ?? start + 1);
            const duration = Math.max(0.2, end - start);
            const splitWords = (translatedText || '').trim().split(/\s+/).filter(Boolean);
            const wordDuration = duration / Math.max(1, splitWords.length);
            const translatedWords = splitWords.map((word, wIdx) => ({
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
};
exports.GroqService = GroqService;
exports.GroqService = GroqService = GroqService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], GroqService);
//# sourceMappingURL=groq.service.js.map