"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useEffect } from 'react';

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg items-center">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`px-3 py-1 text-sm rounded transition-colors ${editor.isActive('bold') ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'} border border-slate-300 font-bold`}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`px-3 py-1 text-sm rounded transition-colors ${editor.isActive('italic') ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'} border border-slate-300 italic`}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`px-3 py-1 text-sm rounded transition-colors ${editor.isActive('strike') ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'} border border-slate-300 line-through`}
      >
        S
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`px-3 py-1 text-sm rounded transition-colors ${editor.isActive('bulletList') ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'} border border-slate-300`}
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`px-3 py-1 text-sm rounded transition-colors ${editor.isActive('orderedList') ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'} border border-slate-300`}
      >
        1. List
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      <button
        type="button"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className="px-3 py-1 text-sm rounded bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-300 font-medium"
      >
        + Tabel Baru
      </button>
      
      <button
        type="button"
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        disabled={!editor.can().addColumnBefore()}
        className="px-3 py-1 text-sm rounded bg-white text-slate-700 hover:bg-slate-200 border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Kolom
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().addRowAfter().run()}
        disabled={!editor.can().addRowAfter()}
        className="px-3 py-1 text-sm rounded bg-white text-slate-700 hover:bg-slate-200 border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Baris
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteColumn().run()}
        disabled={!editor.can().deleteColumn()}
        className="px-3 py-1 text-sm rounded bg-white text-red-600 hover:bg-red-50 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        - Kolom
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteRow().run()}
        disabled={!editor.can().deleteRow()}
        className="px-3 py-1 text-sm rounded bg-white text-red-600 hover:bg-red-50 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        - Baris
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteTable().run()}
        disabled={!editor.can().deleteTable()}
        className="px-3 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        Hapus Tabel
      </button>
    </div>
  );
};

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'w-full border-collapse border border-slate-300 my-4 table-auto',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-slate-200',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-slate-300 bg-slate-100 p-2 text-left font-bold text-slate-700',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-slate-300 p-2 text-slate-800',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-base max-w-none focus:outline-none min-h-[300px] p-4 bg-white',
      },
    },
  });

  // Ensure initial content sync
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="border border-slate-300 rounded-lg shadow-sm flex flex-col bg-white">
      <MenuBar editor={editor} />
      <div className="resize-y overflow-auto min-h-[300px] max-h-[800px]">
        <EditorContent editor={editor} />
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Custom Table Styles for Tiptap */
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
        }
        .ProseMirror table td, .ProseMirror table th {
          min-width: 1em;
          border: 1px solid #cbd5e1;
          padding: 8px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror table th {
          background-color: #f1f5f9;
          font-weight: bold;
          text-align: left;
        }
        .ProseMirror table p {
          margin: 0;
        }
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
        .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: #adf;
          pointer-events: none;
        }
        .ProseMirror.resize-cursor {
          cursor: ew-resize;
          cursor: col-resize;
        }
      `}} />
    </div>
  );
}
