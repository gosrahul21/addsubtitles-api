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
var DeepgramService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepgramService = void 0;
const common_1 = require("@nestjs/common");
const sdk_1 = require("@deepgram/sdk");
const language_config_1 = require("../common/constants/language.config");
let DeepgramService = DeepgramService_1 = class DeepgramService {
    constructor() {
        this.logger = new common_1.Logger(DeepgramService_1.name);
        this.DG_MODEL = 'nova-3';
        this.MAX_WORDS_PER_LINE = 8;
        this.MAX_BLOCK_DURATION = 5;
    }
    async transcribeAudio(audioBuffer, language = 'en') {
        const rawLang = (language || 'en').toLowerCase().trim();
        const mappedLanguage = language_config_1.languageMap[rawLang] || rawLang;
        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            throw new Error('DEEPGRAM_API_KEY is not set in environment');
        }
        const client = new sdk_1.DeepgramClient({ apiKey });
        this.logger.log(`Calling Deepgram API (model: ${this.DG_MODEL}, lang: ${mappedLanguage})...`);
        const standaloneArrayBuffer = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength);
        const audioBlob = new Blob([standaloneArrayBuffer], { type: 'audio/wav' });
        const response = await client.listen.v1.media.transcribeFile(audioBlob, {
            model: this.DG_MODEL,
            language: mappedLanguage,
            smart_format: true,
            punctuate: true,
            utterances: true,
            words: true,
        });
        const words = response?.results?.channels?.[0]?.alternatives?.[0]?.words?.map((w) => ({
            word: w.punctuated_word ?? w.word,
            start: w.start,
            end: w.end,
            speaker: 'A',
        })) ?? [];
        this.logger.log(`Deepgram returned ${words.length} words`);
        return words;
    }
    async transcribeUrl(url, language = 'en') {
        const rawLang = (language || 'en').toLowerCase().trim();
        const mappedLanguage = language_config_1.languageMap[rawLang] || rawLang;
        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            throw new Error('DEEPGRAM_API_KEY is not set in environment');
        }
        const client = new sdk_1.DeepgramClient({ apiKey });
        this.logger.log(`Calling Deepgram API with URL (model: ${this.DG_MODEL}, lang: ${mappedLanguage})...`);
        const response = await client.listen.v1.media.transcribeUrl({ url }, {
            model: this.DG_MODEL,
            language: mappedLanguage,
            smart_format: true,
            punctuate: true,
            utterances: true,
            words: true,
        });
        const words = response?.results?.channels?.[0]?.alternatives?.[0]?.words?.map((w) => ({
            word: w.punctuated_word ?? w.word,
            start: w.start,
            end: w.end,
            speaker: 'A',
        })) ?? [];
        this.logger.log(`Deepgram returned ${words.length} words from URL transcription`);
        return words;
    }
    groupIntoBlocks(words) {
        const blocks = [];
        if (words.length === 0)
            return blocks;
        let current = [words[0]];
        for (let i = 1; i < words.length; i++) {
            const prev = words[i - 1];
            const curr = words[i];
            const gapSec = curr.start - prev.end;
            const blockDur = prev.end - current[0].start;
            const tooManyWords = current.length >= this.MAX_WORDS_PER_LINE;
            const tooLong = blockDur >= this.MAX_BLOCK_DURATION;
            const naturalPause = gapSec > 0.5;
            if (naturalPause || tooManyWords || tooLong) {
                blocks.push({
                    start: current[0].start,
                    end: current[current.length - 1].end,
                    words: current,
                });
                current = [curr];
            }
            else {
                current.push(curr);
            }
        }
        if (current.length > 0) {
            blocks.push({
                start: current[0].start,
                end: current[current.length - 1].end,
                words: current,
            });
        }
        return blocks;
    }
};
exports.DeepgramService = DeepgramService;
exports.DeepgramService = DeepgramService = DeepgramService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], DeepgramService);
//# sourceMappingURL=deepgram.service.js.map