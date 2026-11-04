import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useLanguage } from '@/contexts/LanguageContext';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
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

/**
 * A long-press on a word selects that word. On some mobile browsers, when the word sits
 * inside a bold / italic / underlined run the whole run gets selected instead. While a
 * touch is down, the first non-empty selection that appears is therefore narrowed back to
 * the word under the finger.
 */
const WORD_CHAR = /[\p{L}\p{N}_'’-]/u;

const WordSelection = Extension.create({
  name: 'wordSelectionOnLongPress',
  addProseMirrorPlugins() {
    // Armed for a short time after a touch begins. Android cancels the touch (touchcancel)
    // the moment a long-press starts selecting, and the selection can land after that, so
    // the window is time-based rather than tied to the touch still being down.
    let armedUntil = 0;
    const isArmed = () => Date.now() < armedUntil;
    let point: { x: number; y: number } | null = null;
    return [
      new Plugin({
        key: new PluginKey('wordSelectionOnLongPress'),
        props: {
          handleDOMEvents: {
            touchstart: (_view, event) => {
              const t = (event as TouchEvent).touches[0];
              armedUntil = Date.now() + 1800;
              point = t ? { x: t.clientX, y: t.clientY } : null;
              return false;
            },
          },
        },
        view(editorView) {
          return {
            update(v) {
              if (!isArmed() || !point) return;
              const { selection } = v.state;
              if (selection.empty || !(selection instanceof TextSelection)) return;
              if (!selection.$from.sameParent(selection.$to)) return;
              const selected = v.state.doc.textBetween(selection.from, selection.to);
              armedUntil = 0; // one correction per press
              if (!/\s/.test(selected.trim())) return; // already a single word
              const hit = editorView.posAtCoords({ left: point.x, top: point.y });
              if (!hit || hit.pos < selection.from || hit.pos > selection.to) return;
              const parent = selection.$from.parent;
              const text = parent.textBetween(0, parent.content.size, undefined, '\ufffc');
              const base = selection.$from.start();
              let i = hit.pos - base;
              if (i > 0 && (i >= text.length || !WORD_CHAR.test(text[i])) && WORD_CHAR.test(text[i - 1])) i -= 1;
              if (!WORD_CHAR.test(text[i] ?? '')) return;
              let a = i;
              let b = i + 1;
              while (a > 0 && WORD_CHAR.test(text[a - 1])) a -= 1;
              while (b < text.length && WORD_CHAR.test(text[b])) b += 1;
              const from = base + a;
              const to = base + b;
              // Dispatching from inside update() would re-enter it, so defer.
              queueMicrotask(() => {
                if (editorView.isDestroyed) return;
                editorView.dispatch(editorView.state.tr.setSelection(TextSelection.create(editorView.state.doc, from, to)));
              });
            },
          };
        },
      }),
    ];
  },
});

export interface RichTextEditorHandle {
  editor: Editor | null;
  focus: () => void;
  applyFormat: (formatType: 'h1' | 'h2' | 'normal' | 'bold' | 'italic' | 'underline' | 'clear') => void;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ content, onChange, placeholder: placeholderProp, className, onFocus }, ref) => {
  const { t } = useLanguage();
  const placeholder = placeholderProp ?? t('startWriting');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
      WordSelection,
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
