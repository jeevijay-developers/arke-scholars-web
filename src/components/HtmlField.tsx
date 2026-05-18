import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import LatexRenderer from "@/components/LatexRenderer";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function uploadQuestionImage(file: File, folder = "bank"): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error("Image is larger than 10 MB");
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const contentType =
    file.type ||
    (ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "svg"
            ? "image/svg+xml"
            : "image/png");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("question-images")
    .upload(path, file, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("question-images").getPublicUrl(path);
  return data.publicUrl;
}

type Props = {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  preview?: boolean;
  folder?: string;
};

const HtmlField = ({ value, onChange, rows = 3, placeholder, preview = true, folder = "bank" }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadQuestionImage(f, folder);
      const sep = value && !value.endsWith("\n") && !value.endsWith(" ") ? " " : "";
      onChange(value + `${sep}<img src="${url}" />`);
    } catch (err) {
      toast.error(`Image upload failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 pr-24 text-sm font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload image"
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
          {uploading ? "Uploading…" : "Image"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {preview && value && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <LatexRenderer html={value} />
        </div>
      )}
    </div>
  );
};

export default HtmlField;
