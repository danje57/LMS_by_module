"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { BrandingSetting } from "@prisma/client";

interface BrandingFormProps {
  branding: BrandingSetting | null;
}

export function BrandingForm({ branding }: BrandingFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/admin/branding", {
      method: "POST",
      body: form,
    });

    if (res.ok) {
      setMessage({ type: "success", text: "Branding mis à jour avec succès." });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error ?? "Une erreur est survenue." });
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Personnalisez le nom, le logo et la bannière de l&apos;application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="appName">Nom de l&apos;application</Label>
            <Input
              id="appName"
              name="appName"
              defaultValue={branding?.appName ?? "LMS"}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Logo (PNG, SVG, JPG — max 2 Mo)</Label>
            <Input id="logo" name="logo" type="file" accept="image/*" />
            {branding?.logoPath && (
              <p className="text-xs text-muted-foreground">
                Fichier actuel : {branding.logoPath.split("/").pop()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="banner">Bannière de login (PNG, JPG — max 5 Mo)</Label>
            <Input id="banner" name="banner" type="file" accept="image/*" />
            {branding?.bannerPath && (
              <p className="text-xs text-muted-foreground">
                Fichier actuel : {branding.bannerPath.split("/").pop()}
              </p>
            )}
          </div>

          {message && (
            <p
              className={`text-sm px-3 py-2 rounded-md ${
                message.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
