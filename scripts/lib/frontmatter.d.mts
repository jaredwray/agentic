export function parseFrontmatter(content: string): {
  data?: Record<string, string | boolean | string[]>;
  error?: string;
};

export function stripFrontmatter(content: string): string;
