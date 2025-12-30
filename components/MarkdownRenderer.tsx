import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
  className?: string;
}

const MarkdownRenderer: React.FC<Props> = ({ children, className = "" }) => {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 覆盖默认标签样式，适配 Snaplex 的 Tailwind 风格
          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
          li: ({node, ...props}) => <li className="pl-1" {...props} />,
          h1: ({node, ...props}) => <h1 className="text-xl font-black mb-2 mt-4" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 mt-3" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-base font-bold mb-1 mt-2" {...props} />,
          strong: ({node, ...props}) => <strong className="font-bold text-stone-900" {...props} />,
          code: ({node, ...props}) => <code className="bg-stone-200/50 px-1.5 py-0.5 rounded text-sm font-mono text-softblue" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-stone-300 pl-4 italic text-stone-500 my-2" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;