"use client";

interface H5PPlayerProps {
  courseId: string;
  filePath: string;
}

export function H5PPlayer({ courseId }: H5PPlayerProps) {
  return (
    <div className="border rounded-lg overflow-hidden bg-black" style={{ minHeight: "600px" }}>
      <iframe
        src={`/api/courses/${courseId}/serve`}
        className="w-full"
        style={{ height: "calc(100vh - 200px)", minHeight: "600px", border: "none" }}
        allow="fullscreen"
        title="Contenu H5P"
      />
    </div>
  );
}
