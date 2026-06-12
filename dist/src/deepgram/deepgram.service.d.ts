export interface WordEntry {
    word: string;
    start: number;
    end: number;
    speaker?: string;
}
export interface SubtitleBlock {
    start: number;
    end: number;
    words: WordEntry[];
}
export declare class DeepgramService {
    private readonly logger;
    private readonly DG_MODEL;
    private readonly MAX_WORDS_PER_LINE;
    private readonly MAX_BLOCK_DURATION;
    constructor();
    transcribeAudio(audioBuffer: Buffer, language?: string): Promise<WordEntry[]>;
    transcribeUrl(url: string, language?: string): Promise<WordEntry[]>;
    groupIntoBlocks(words: WordEntry[]): SubtitleBlock[];
}
