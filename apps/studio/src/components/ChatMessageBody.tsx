import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

export function ChatMessageBody({
  content,
  streaming,
  reasoning
}: {
  content: string;
  streaming: boolean;
  reasoning?: string;
}) {
  return (
    <div className={`studio-agent__markdown${streaming ? " studio-agent__markdown--streaming" : ""}`}>
      {reasoning?.trim() ? (
        <details className="studio-agent__reasoning">
          <summary>Reasoning</summary>
          <p>{reasoning}</p>
        </details>
      ) : null}
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={{ code: CodeBlock }}>
        {content || (streaming ? "Waiting for the first token…" : "")}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ className, children }: { className?: string | undefined; children?: React.ReactNode }) {
  const text = String(children ?? "").replace(/\n$/, "");
  const isBlock = Boolean(className) || text.includes("\n");
  const [copied, setCopied] = useState(false);
  if (!isBlock) return <code>{text}</code>;
  return (
    <div className="studio-agent__code">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}
