import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** Kártya-előnézetekhez: minden elemet inline-ra kényszerít, hogy a
   * line-clamp szépen levágja a szöveget cím/lista-tördelés nélkül. */
  inline?: boolean;
}

export function MarkdownContent({ content, className, inline }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-semibold prose-p:leading-relaxed",
        "prose-pre:bg-muted prose-pre:text-foreground prose-code:text-foreground",
        "prose-a:text-primary",
        inline && "[&_*]:inline [&_*]:m-0 [&_*]:p-0",
        className
      )}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}
