import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
}

export function MarkdownRenderer({ content, streaming }: MarkdownRendererProps) {
  return (
    <div className="prose-chat text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !node?.position?.start.line;
            const code = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-muted/60 text-[0.85em] font-mono text-foreground/90"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock code={code} language={match?.[1]} />;
          },
          p({ children }) {
            return <p className="my-2 last:mb-0">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-semibold mt-3 mb-1.5 text-foreground">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold mt-2.5 mb-1 text-foreground">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-sm">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 pl-3 border-l-2 border-border/70 text-muted-foreground italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5B7FA6] hover:underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-2 overflow-x-auto">
                <table className="min-w-full border-collapse border border-border/50 text-sm">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border/50 px-3 py-1.5 bg-muted/30 text-left font-medium">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border border-border/50 px-3 py-1.5">{children}</td>;
          },
          hr() {
            return <hr className="my-4 border-border/50" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-foreground">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-0.5 h-4 ml-0.5 bg-muted-foreground/50 align-[-3px] animate-pulse" />
      )}
    </div>
  );
}
