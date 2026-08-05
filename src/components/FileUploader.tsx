import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, Trash2, FileText, Download } from "lucide-react";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface FileUploaderProps {
  entityType: "user_story" | "activity";
  entityId: string;
  teamId: string;
}

export function FileUploader({ entityType, entityId, teamId }: FileUploaderProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    const { data } = await supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    setAttachments((data as any[]) || []);
  }, [entityId, entityType]);

  useEffect(() => {
    if (entityId) fetchAttachments();
  }, [entityId, fetchAttachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 10MB)");
      return;
    }

    setUploading(true);
    const filePath = `${user.id}/${entityType}/${entityId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Erro ao fazer upload");
      setUploading(false);
      return;
    }

    await supabase.from("attachments").insert({
      team_id: teamId,
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
    });

    toast.success("Arquivo enviado!");
    setUploading(false);
    await fetchAttachments();
    e.target.value = "";
  };

  const handleDelete = async (att: Attachment) => {
    await supabase.storage.from("attachments").remove([att.file_path]);
    await supabase.from("attachments").delete().eq("id", att.id);
    toast.success("Arquivo removido");
    await fetchAttachments();
  };

  const getSignedUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(path, 3600); // 1 hour
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const handleDownload = async (att: Attachment) => {
    const url = await getSignedUrl(att.file_path);
    if (!url) { toast.error("Erro ao gerar link de download"); return; }
    window.open(url, "_blank");
  };

  const isImage = (mime: string) => mime.startsWith("image/");

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
            accept=".docx,.pdf,.png,.gif,.jpg,.jpeg,.zip"
          />
          <Button variant="outline" size="sm" asChild disabled={uploading}>
            <span>
              <Paperclip className="h-3.5 w-3.5 mr-1" />
              {uploading ? "Enviando..." : "Anexar Arquivo"}
            </span>
          </Button>
        </label>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 p-2 rounded-md border bg-muted/30 text-sm"
            >
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-xs">{att.file_name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(att.file_size)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(att)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDelete(att)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
