import type { Readable } from 'node:stream';
export type ParsedUrl = {
    link: string;
    error?: Error;
    url?: URL;
};
export declare function getLinks(source: Readable, baseUrl: string): Promise<ParsedUrl[]>;
