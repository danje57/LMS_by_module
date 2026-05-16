"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteCourseButtonProps {
  courseId: string;
  courseTitle: string;
}

export function DeleteCourseButton({ courseId, courseTitle }: DeleteCourseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/admin/courses/${courseId}`, { method: "DELETE" });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <>
      {/* Bouton poubelle */}
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-xl text-[#8E8E93] hover:bg-red-50 hover:text-red-500 transition-colors"
        title="Supprimer le cours"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Modale de confirmation */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => !loading && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-[#1D1D1F]">Supprimer le cours</h2>
                <p className="text-[13px] text-[#6E6E73]">Cette action est irréversible.</p>
              </div>
            </div>

            <p className="text-[14px] text-[#3C3C43]">
              Voulez-vous vraiment supprimer{" "}
              <span className="font-semibold">« {courseTitle} »</span> ?
              Le fichier H5P sera également supprimé du serveur.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 h-10 rounded-xl border border-[#D2D2D7] text-[14px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-medium transition-colors disabled:opacity-50"
              >
                {loading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
