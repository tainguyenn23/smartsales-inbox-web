"use client";

import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`b-${key++}`} className="font-semibold text-on-surface">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`c-${key++}`}
          className="rounded bg-surface-container-high px-1 py-0.5 font-mono text-xs text-primary"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={`i-${key++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function isTableSeparator(line: string): boolean {
  return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

export function ChatMarkdown({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Markdown table block
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={`tbl-${i}`} className="my-2 overflow-x-auto rounded-lg border border-outline-variant">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface">
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="border-b border-outline-variant px-2.5 py-1.5 font-bold">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="odd:bg-surface even:bg-surface-container-lowest">
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="border-b border-outline-variant/40 px-2.5 py-1.5">
                      {renderInline(row[cIdx] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list block
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list block
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Heading or standard paragraph
    if (/^#{1,3}\s+/.test(trimmed)) {
      blocks.push(
        <p key={`h-${i}`} className="mt-2 text-sm font-bold text-on-surface">
          {renderInline(trimmed.replace(/^#{1,3}\s+/, ""))}
        </p>
      );
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed whitespace-pre-wrap">
        {renderInline(line)}
      </p>
    );
    i += 1;
  }

  return (
    <div className="space-y-1.5">
      {blocks}
      {isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
      )}
    </div>
  );
}
