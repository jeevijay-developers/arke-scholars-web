import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useCallback, useRef } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon,
  Palette, Highlighter,
  Undo, Redo,
} from "lucide-react";

type Props = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const COLORS = ["#1a1a1a", "#ef4444", "#c99a2e", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#f5d0fe", "#fed7aa"];

export default function RichTextEditor({ content, onChange, placeholder = "Write here…" }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "rich-editor-content min-h-[240px] p-4 outline-none text-sm text-foreground",
      },
    },
  });

  const setColor = (color: string) => editor?.chain().focus().setColor(color).run();
  const setHighlight = (color: string) => editor?.chain().focus().toggleHighlight({ color }).run();

  const addLink = useCallback(() => {
    const url = window.prompt("Enter URL");
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => editor.chain().focus().setImage({ src: reader.result as string }).run();
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!editor) return null;

  const btn = (active: boolean) =>
    `p-1.5 rounded transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;
  const divider = <div className="w-px h-5 bg-border mx-0.5" />;

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden focus-within:border-primary transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">
        {/* History */}
        <button type="button" title="Undo" onClick={() => editor.chain().focus().undo().run()} className={btn(false)} disabled={!editor.can().undo()}>
          <Undo className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Redo" onClick={() => editor.chain().focus().redo().run()} className={btn(false)} disabled={!editor.can().redo()}>
          <Redo className="h-3.5 w-3.5" />
        </button>
        {divider}

        {/* Inline marks */}
        <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))}>
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        {divider}

        {/* Headings */}
        <button type="button" title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>
          <Heading1 className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>
          <Heading2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))}>
          <Heading3 className="h-3.5 w-3.5" />
        </button>
        {divider}

        {/* Lists + blockquote */}
        <button type="button" title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>
          <Quote className="h-3.5 w-3.5" />
        </button>
        {divider}

        {/* Alignment */}
        <button type="button" title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))}>
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btn(editor.isActive({ textAlign: "center" }))}>
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))}>
          <AlignRight className="h-3.5 w-3.5" />
        </button>
        {divider}

        {/* Text color */}
        <div className="relative group">
          <button type="button" title="Text color" className={`${btn(false)} flex items-center gap-0.5`}>
            <Palette className="h-3.5 w-3.5" />
          </button>
          <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:flex gap-1 p-2 rounded-lg border border-border bg-background shadow-lg">
            {COLORS.map((c) => (
              <button key={c} type="button" title={c} onClick={() => setColor(c)}
                className="h-5 w-5 rounded-full border border-border/50 hover:scale-110 transition-transform"
                style={{ background: c }} />
            ))}
          </div>
        </div>

        {/* Highlight */}
        <div className="relative group">
          <button type="button" title="Highlight" className={`${btn(editor.isActive("highlight"))} flex items-center gap-0.5`}>
            <Highlighter className="h-3.5 w-3.5" />
          </button>
          <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:flex gap-1 p-2 rounded-lg border border-border bg-background shadow-lg">
            {HIGHLIGHTS.map((c) => (
              <button key={c} type="button" title={c} onClick={() => setHighlight(c)}
                className="h-5 w-5 rounded-full border border-border/50 hover:scale-110 transition-transform"
                style={{ background: c }} />
            ))}
          </div>
        </div>
        {divider}

        {/* Link + Image */}
        <button type="button" title="Add link" onClick={addLink} className={btn(editor.isActive("link"))}>
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Insert image" onClick={() => imageInputRef.current?.click()} className={btn(false)}>
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
