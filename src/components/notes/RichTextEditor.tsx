import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { markdownToHtml, htmlToMarkdown } from '@/lib/markdownConverter';
import './RichTextEditor.css';

interface RichTextEditorProps {
  content: string; // markdown format
  onChange: (content: string) => void; // returns markdown format
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}

export interface RichTextEditorHandle {
  editor: Editor | null;
  focus: () => void;
  applyFormat: (formatType: 'h1' | 'h2' | 'normal' | 'bold' | 'italic' | 'underline' | 'clear') => void;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ content, onChange, placeholder = 'Start writing...', className, onFocus }, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder: ({ editor }) => {
          return editor.isFocused ? '' : placeholder;
        },
      }),
    ],
    content: markdownToHtml(content || ''),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: cn(
          'focus:outline-none',
          'text-sm leading-relaxed p-0 m-0',
          className
        ),
      },
    },
  }, [placeholder, className]);

  // Update editor content when prop changes (but not from user typing)
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentMarkdown = htmlToMarkdown(editor.getHTML());
      if (content !== currentMarkdown) {
        editor.commands.setContent(markdownToHtml(content || ''));
      }
    }
  }, [content, editor]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      editor,
      focus: () => {
        editor?.commands.focus('end');
      },
      applyFormat: (formatType: 'h1' | 'h2' | 'normal' | 'bold' | 'italic' | 'underline' | 'clear') => {
        if (!editor) return;

        switch (formatType) {
          case 'h1':
            editor.chain().focus().toggleHeading({ level: 1 }).run();
            break;
          case 'h2':
            editor.chain().focus().toggleHeading({ level: 2 }).run();
            break;
          case 'normal':
            editor.chain().focus().setParagraph().run();
            break;
          case 'bold':
            editor.chain().focus().toggleBold().run();
            break;
          case 'italic':
            editor.chain().focus().toggleItalic().run();
            break;
          case 'underline':
            editor.chain().focus().toggleUnderline().run();
            break;
          case 'clear':
            editor.chain().focus().clearNodes().unsetAllMarks().run();
            break;
        }
      },
    }));

  return (
    <div 
      className="w-full min-h-[2rem] cursor-text"
      onClick={() => {
        editor?.commands.focus();
        onFocus?.();
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
  }
);

RichTextEditor.displayName = 'RichTextEditor';
