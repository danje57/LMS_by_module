"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

export function UploadForm() {
  const router = useRouter();
  const [hasQuiz, setHasQuiz] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (!file.name.endsWith(".h5p")) {
        setError("Seuls les fichiers .h5p sont acceptés.");
        e.target.value = "";
        setSelectedFile(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) {
      setError("Veuillez sélectionner un fichier .h5p.");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);

    const form = new FormData(e.currentTarget);

    // Upload via XHR pour suivre la progression
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable) {
          setProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error ?? "Erreur serveur"));
          } catch {
            reject(new Error("Erreur serveur"));
          }
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
      xhr.open("POST", "/api/admin/courses/upload");
      xhr.send(form);
    }).catch((err: Error) => {
      setError(err.message);
      setLoading(false);
      return;
    });

    if (!error) {
      router.push("/dashboard/courses");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau cours H5P</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Titre du cours *</Label>
            <Input id="title" name="title" required maxLength={255} placeholder="Ex : Introduction à la sécurité" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Durée (en minutes) *</Label>
            <Input id="duration" name="duration" type="number" min="1" required placeholder="Ex : 30" />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="hasQuiz"
              name="hasQuiz"
              type="checkbox"
              checked={hasQuiz}
              onChange={(e) => setHasQuiz(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="hasQuiz">Ce cours contient un quiz</Label>
          </div>

          {hasQuiz && (
            <div className="space-y-2">
              <Label htmlFor="passingScore">Score de passage (%)</Label>
              <Input
                id="passingScore"
                name="passingScore"
                type="number"
                min="0"
                max="100"
                defaultValue="70"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="file">Fichier H5P * (max 600 Mo)</Label>
            <div className="border-2 border-dashed border-input rounded-md p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                {selectedFile ? selectedFile.name : "Sélectionnez un fichier .h5p"}
              </p>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".h5p"
                className="max-w-xs mx-auto"
                onChange={handleFileChange}
                required
              />
            </div>
          </div>

          {loading && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Upload en cours…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Upload en cours…" : "Uploader"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
