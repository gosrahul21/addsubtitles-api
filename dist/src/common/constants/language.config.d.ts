export declare const languageMap: Record<string, string>;
export declare function resolveLanguageCode(input: string): string;
export interface SupportedLanguage {
    label: string;
    native: string;
    code: string;
    popular?: boolean;
}
export declare const SUPPORTED_LANGUAGES: SupportedLanguage[];
