import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { TextNode } from '../flyer/flyerStore';

interface InlineEditWidgetProps {
  node: TextNode;
  scale: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export const InlineEditWidget: React.FC<InlineEditWidgetProps> = ({
  node,
  scale,
  onCommit,
  onCancel,
}) => {
  const [value, setValue] = useState(node.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Focus and select all text on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !window.visualViewport) return;

    const keepEditorVisible = () => {
      window.requestAnimationFrame(() => {
        shell.scrollIntoView({ block: 'center', inline: 'nearest' });
      });
    };

    window.visualViewport.addEventListener('resize', keepEditorVisible);
    window.visualViewport.addEventListener('scroll', keepEditorVisible);
    keepEditorVisible();

    return () => {
      window.visualViewport?.removeEventListener('resize', keepEditorVisible);
      window.visualViewport?.removeEventListener('scroll', keepEditorVisible);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onCommit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    onCommit(value);
  };

  // We calculate the textarea height dynamically based on content scrollHeight
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to get correct scrollHeight
    textarea.style.height = 'auto';
    const newHeight = textarea.scrollHeight;
    setHeight(newHeight);
  }, [value]);

  const minHeight = node.fontSize * 1.2 * scale;
  const editorHeight = Math.max(minHeight, height);

  const shellStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: `${node.x * scale}px`,
    top: `${node.y * scale}px`,
    width: `${node.width * scale}px`,
    minHeight: `${minHeight}px`,
    zIndex: 100,
  }), [minHeight, node.width, node.x, node.y, scale]);

  const style: React.CSSProperties = {
    width: '100%',
    height: `${editorHeight}px`,
    fontSize: `${node.fontSize * scale}px`,
    fontFamily: node.fontFamily,
    color: node.fill,
    caretColor: '#2D2D2A',
    textAlign: node.align || 'left',
    lineHeight: '1.2',
    background: 'rgba(250, 247, 240, 0.08)',
    border: '0',
    borderRadius: '2px',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    boxShadow: '0 0 0 1px rgba(127, 168, 216, 0.72), 0 0 0 4px rgba(127, 168, 216, 0.14)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: '0px',
    margin: '0px',
    boxSizing: 'border-box',
    transition: 'box-shadow 160ms ease, background-color 160ms ease, opacity 120ms ease',
  };

  return (
    <div ref={shellRef} style={shellStyle} className="inline-edit-shell">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={style}
        className="inline-edit-textarea"
        aria-label="Edit text"
        spellCheck={false}
      />
      <button
        type="button"
        className="inline-edit-done"
        aria-label="Done editing text"
        onPointerDown={(event) => {
          event.preventDefault();
          onCommit(value);
        }}
      >
        <Check aria-hidden="true" size={16} strokeWidth={2.25} />
      </button>
    </div>
  );
};
