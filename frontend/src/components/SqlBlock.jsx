import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const KEYWORDS = new Set(
  `SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER CROSS LATERAL ON AND OR NOT IN IS NULL AS GROUP BY
   HAVING ORDER ASC DESC LIMIT WITH DISTINCT COUNT SUM AVG MIN MAX ROUND COALESCE CASE WHEN THEN ELSE
   END EXISTS FILTER OVER WINDOW LAG NULLIF TRUE FALSE NULLS LAST CALL INSERT INTO VALUES UPDATE SET
   RETURNING EXTRACT EPOCH`.split(/\s+/),
);
const TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;

// Returns React nodes (text stays escaped; no innerHTML).
function highlight(sql) {
  const nodes = [];
  let last = 0;
  for (const match of sql.matchAll(TOKEN)) {
    const [text, comment, string, num, word] = match;
    if (match.index > last) nodes.push(sql.slice(last, match.index));
    const className = comment
      ? 'text-slate-500 italic'
      : string
        ? 'text-emerald-300'
        : num
          ? 'text-amber-300'
          : KEYWORDS.has(word.toUpperCase())
            ? 'font-medium text-sky-300'
            : null;
    nodes.push(className ? <span key={match.index} className={className}>{text}</span> : text);
    last = match.index + text.length;
  }
  nodes.push(sql.slice(last));
  return nodes;
}

export default function SqlBlock({ sql, className = '' }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (insecure origin): the SQL is still selectable
    }
  }

  return (
    <div className={`overflow-hidden rounded-xl bg-slate-900 ${className}`}>
      <div className="flex items-center justify-between border-b border-white/10 py-1 pr-1.5 pl-4">
        <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">SQL</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-200">
        <code>{highlight(sql)}</code>
      </pre>
    </div>
  );
}
