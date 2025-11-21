// src/components/TiptapEditor.jsx
import React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import "../../styles/tiptap.css";

export default function TiptapEditor({ value, onChange, placeholder = "Nhập mô tả chi tiết sản phẩm..." }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    editorProps: {
      attributes: {
        class: "tt-editor",
        "aria-label": "Mô tả sản phẩm",

        // ✅ TẮT gạch đỏ & tự sửa chính tả
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",

        // ✅ Vô hiệu hoá Grammarly / LanguageTool nếu có
        "data-gramm": "false",
        "data-lt-active": "false",
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  React.useEffect(() => {
    if (!editor) return;
    const html = editor.getHTML();
    if (value != null && value !== html) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  const Btn = ({ active, onClick, disabled, title, children }) => (
    <button type="button" className={`tt-btn ${active ? "is-active" : ""}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );

  return (
    <div className="tt-wrap">
      <div className="tt-toolbar">
        <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1">H1</Btn>
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">H2</Btn>
        <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3">H3</Btn>
        <span className="tt-sep" />
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Đậm">B</Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Nghiêng">I</Btn>
        <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Gạch ngang">S</Btn>
        <span className="tt-sep" />
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Danh sách chấm">• List</Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Danh sách số">1. List</Btn>
        <span className="tt-sep" />
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">❝ ❞</Btn>
        <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code">{'</>'}</Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Đường kẻ">―</Btn>
        <span className="tt-flex" />
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Hoàn tác">⎌</Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Làm lại">↻</Btn>
        <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Xoá định dạng">✕ Clear</Btn>
      </div>
      {/* EditorContent sẽ nhận các attributes ở trên và áp vào div contentEditable */}
      <EditorContent editor={editor} />
    </div>
  );
}
