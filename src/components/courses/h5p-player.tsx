"use client";

interface H5PPlayerProps {
  courseId: string;
  filePath: string;
  visitedSlides?: number[];
}

export function H5PPlayer({ courseId, visitedSlides }: H5PPlayerProps) {
  const visited = visitedSlides && visitedSlides.length > 0
    ? `?visited=${visitedSlides.join(",")}`
    : "";

  return (
    <div className="max-w-6xl mx-auto">
    <div className="rounded-2xl overflow-hidden bg-black" style={{ height: "calc(100vh - 200px)", minHeight: "420px" }}>
      <iframe
        src={`/api/courses/${courseId}/serve${visited}`}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        allow="fullscreen"
        title="Contenu H5P"
      />
    </div>
    </div>
  );
}
