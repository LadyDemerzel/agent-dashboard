import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SyntaxLanguage = 'xml' | 'json' | 'text';

interface SyntaxHighlightedCodeProps {
  content: string;
  language: SyntaxLanguage;
  className?: string;
}

const baseClassName = 'overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background/70 p-4 font-mono text-xs leading-6 text-foreground';
const tokenClassNames = {
  xmlTag: 'text-sky-300',
  xmlBracket: 'text-muted-foreground',
  xmlAttribute: 'text-violet-300',
  string: 'text-emerald-300',
  number: 'text-amber-300',
  literal: 'text-pink-300',
  punctuation: 'text-muted-foreground',
  comment: 'text-muted-foreground italic',
  plain: 'text-foreground',
} as const;

const jsonTokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|[{}\[\],:]/g;
const xmlTokenPattern = /(<!--[\s\S]*?-->)|(<\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?>)/g;
const xmlAttributePattern = /(\s+)([A-Za-z_:][\w:.-]*)(\s*=\s*)?("(?:\\.|[^"])*"|'(?:\\.|[^'])*')?/g;

function Token({ className, children }: { className: string; children: ReactNode }) {
  return <span className={className}>{children}</span>;
}

function renderPlainText(content: string) {
  return <Token className={tokenClassNames.plain}>{content}</Token>;
}

function renderJson(content: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of content.matchAll(jsonTokenPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(<Fragment key={`plain-${key++}`}>{content.slice(lastIndex, index)}</Fragment>);
    }

    const value = match[0];
    if (match[1]) {
      const isKey = Boolean(match[2]);
      nodes.push(
        <Token key={`json-${key++}`} className={isKey ? tokenClassNames.xmlAttribute : tokenClassNames.string}>
          {match[1]}
        </Token>
      );
      if (match[2]) {
        nodes.push(
          <Token key={`json-colon-${key++}`} className={tokenClassNames.punctuation}>
            {match[2]}
          </Token>
        );
      }
    } else if (/^(true|false|null)$/.test(value)) {
      nodes.push(
        <Token key={`json-${key++}`} className={tokenClassNames.literal}>
          {value}
        </Token>
      );
    } else if (/^-?\d/.test(value)) {
      nodes.push(
        <Token key={`json-${key++}`} className={tokenClassNames.number}>
          {value}
        </Token>
      );
    } else {
      nodes.push(
        <Token key={`json-${key++}`} className={tokenClassNames.punctuation}>
          {value}
        </Token>
      );
    }

    lastIndex = index + value.length;
  }

  if (lastIndex < content.length) {
    nodes.push(<Fragment key={`plain-${key++}`}>{content.slice(lastIndex)}</Fragment>);
  }

  return nodes;
}

function renderXmlAttributes(content: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of content.matchAll(xmlAttributePattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(<Fragment key={`${keyPrefix}-plain-${key++}`}>{content.slice(lastIndex, index)}</Fragment>);
    }

    const whitespace = match[1] ?? '';
    const attribute = match[2] ?? '';
    const equals = match[3] ?? '';
    const value = match[4] ?? '';

    if (whitespace) {
      nodes.push(<Fragment key={`${keyPrefix}-ws-${key++}`}>{whitespace}</Fragment>);
    }
    if (attribute) {
      nodes.push(
        <Token key={`${keyPrefix}-attr-${key++}`} className={tokenClassNames.xmlAttribute}>
          {attribute}
        </Token>
      );
    }
    if (equals) {
      nodes.push(
        <Token key={`${keyPrefix}-eq-${key++}`} className={tokenClassNames.punctuation}>
          {equals}
        </Token>
      );
    }
    if (value) {
      nodes.push(
        <Token key={`${keyPrefix}-value-${key++}`} className={tokenClassNames.string}>
          {value}
        </Token>
      );
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) {
    nodes.push(<Fragment key={`${keyPrefix}-tail-${key++}`}>{content.slice(lastIndex)}</Fragment>);
  }

  return nodes;
}

function renderXml(content: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of content.matchAll(xmlTokenPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(<Fragment key={`xml-plain-${key++}`}>{content.slice(lastIndex, index)}</Fragment>);
    }

    if (match[1]) {
      nodes.push(
        <Token key={`xml-comment-${key++}`} className={tokenClassNames.comment}>
          {match[1]}
        </Token>
      );
    } else {
      const opening = match[2] ?? '';
      const tagName = match[3] ?? '';
      const attributes = match[4] ?? '';
      const closing = match[5] ?? '';

      nodes.push(
        <Token key={`xml-open-${key++}`} className={tokenClassNames.xmlBracket}>
          {opening}
        </Token>
      );
      nodes.push(
        <Token key={`xml-tag-${key++}`} className={tokenClassNames.xmlTag}>
          {tagName}
        </Token>
      );
      nodes.push(...renderXmlAttributes(attributes, `xml-attrs-${key++}`));
      nodes.push(
        <Token key={`xml-close-${key++}`} className={tokenClassNames.xmlBracket}>
          {closing}
        </Token>
      );
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) {
    nodes.push(<Fragment key={`xml-tail-${key++}`}>{content.slice(lastIndex)}</Fragment>);
  }

  return nodes;
}

export function SyntaxHighlightedCode({ content, language, className }: SyntaxHighlightedCodeProps) {
  const rendered = language === 'xml'
    ? renderXml(content)
    : language === 'json'
      ? renderJson(content)
      : renderPlainText(content);

  return (
    <pre className={cn(baseClassName, className)}>
      <code>{rendered}</code>
    </pre>
  );
}
