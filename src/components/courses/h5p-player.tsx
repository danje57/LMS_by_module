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
    <div className="border rounded-lg overflow-hidden bg-black" style={{ minHeight: "600px" }}>
      <iframe
        src={`/api/courses/${courseId}/serve${visited}`}
        className="w-full"
        style={{ height: "calc(100vh - 200px)", minHeight: "600px", border: "none" }}
        allow="fullscreen"
        title="Contenu H5P"
      />
    </div>
  );
}
