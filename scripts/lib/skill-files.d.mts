export const ROOT: string;
export const SKILLS_DIR: string;

export function walk(dir: string, acc?: string[]): string[];
export function toPosix(path: string): string;
export function isHiddenRel(rel: string): boolean;
export function skillRoots(): string[];
export function skillMarkdownFiles(): string[];
export function skillFiles(): Array<{
  abs: string;
  rel: string;
  relRoot: string;
  hidden: boolean;
}>;
