export declare class AiService {
    private ai;
    constructor();
    generateHooks(text: string): Promise<string[]>;
    generateEmojis(segments: any[]): Promise<any[]>;
}
