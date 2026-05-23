import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractH5P } from "@/lib/h5p";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id, isActive: true } });
  if (!course) {
    return new NextResponse("Cours introuvable", { status: 404 });
  }

  let extractDir: string;
  try {
    extractDir = await extractH5P(course.filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Impossible d'extraire le cours H5P";
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#fff3cd;color:#856404">
        <h2>⚠️ Fichier de cours manquant</h2>
        <p>${msg}</p>
        <p>Supprimez ce cours et re-uploadez le fichier H5P.</p>
      </body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Détecter le type de contenu H5P
  let mainLibrary = "";
  try {
    const h5pJson = JSON.parse(await readFile(path.join(extractDir, "h5p.json"), "utf-8"));
    mainLibrary = h5pJson?.mainLibrary ?? "";
  } catch { /* ignore */ }

  const isInteractiveVideo = mainLibrary === "H5P.InteractiveVideo";

  // Lire le nombre de slides depuis content.json (CoursePresentation uniquement)
  let totalSlides = 0;
  if (!isInteractiveVideo) {
    try {
      const raw = await readFile(path.join(extractDir, "content", "content.json"), "utf-8");
      const content = JSON.parse(raw);
      const slides = content?.presentation?.slides;
      if (Array.isArray(slides)) totalSlides = slides.length;
    } catch { /* contenu non-CoursePresentation ou structure différente */ }
  }

  // Restaurer les slides déjà visitées (sauvegardées en session précédente)
  const visitedParam = req.nextUrl.searchParams.get("visited");
  const savedVisited: number[] = visitedParam
    ? visitedParam.split(",").map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    : [];

  const contentBase = `/api/courses/${id}/content`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${course.title.replace(/</g, "&lt;")}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: #1a1a2e; }
    #h5p-container { width: 100%; }
    .h5p-iframe-wrapper { width: 100% !important; }
  </style>
  <link rel="stylesheet" href="/h5p-standalone/styles/h5p.css">
</head>
<body>
  <div id="h5p-container"></div>
  <script src="/h5p-standalone/main.bundle.js"></script>
  <script>
    (function() {
      var totalSlides = ${totalSlides};
      var visitedSlides = new Set(${JSON.stringify(savedVisited)});
      var isInteractiveVideo = ${isInteractiveVideo ? "true" : "false"};
      var videoDuration = 0;

      function notifyCompleted() {
        window.parent.postMessage({
          type: 'h5p-completed',
          visited: Array.from(visitedSlides),
          total: totalSlides
        }, '*');
      }

      const options = {
        id: ${JSON.stringify(id)},
        frameJs: '/h5p-standalone/frame.bundle.js',
        frameCss: '/h5p-standalone/styles/h5p.css',
        h5pJsonPath: ${JSON.stringify(contentBase)},
        librariesPath: ${JSON.stringify(contentBase)},
        contentJsonPath: ${JSON.stringify(contentBase + '/content')},
      };

      const container = document.getElementById('h5p-container');

      new H5PStandalone.H5P(container, options)
        .then(function() {
          var attempts = 0;
          var interval = setInterval(function() {
            attempts++;
            if (attempts > 120) { clearInterval(interval); return; }
            if (window.H5P && window.H5P.externalDispatcher) {
              clearInterval(interval);
              // La slide 1 (index 0) est toujours la slide de départ — la marquer immédiatement
              if (totalSlides > 0) {
                visitedSlides.add(0);
                window.parent.postMessage({
                  type: 'h5p-slide-update',
                  current: 0,
                  visited: Array.from(visitedSlides),
                  total: totalSlides
                }, '*');
              }
              window.H5P.externalDispatcher.on('xAPI', function(event) {
                try {
                  var verb = event.getVerb ? event.getVerb() : '';
                  var statement = event.data && event.data.statement;

                  if (verb === 'progressed' && statement) {
                    var ext = (statement.object &&
                               statement.object.definition &&
                               statement.object.definition.extensions) || {};
                    var rawIdx = ext['http://id.tincanapi.com/extension/ending-point'];

                    if (isInteractiveVideo) {
                      // Pour Interactive Video : ending-point = temps en secondes
                      var currentTime = Number(rawIdx) || 0;
                      // Récupérer la durée depuis result.duration (ISO 8601 "PTxx.xxS")
                      var durStr = statement.result && statement.result.duration;
                      if (durStr) {
                        var m = String(durStr).match(/PT([\d.]+)S/);
                        if (m) videoDuration = Math.max(videoDuration, parseFloat(m[1]));
                      }
                      if (videoDuration > 0) {
                        window.parent.postMessage({
                          type: 'h5p-video-progress',
                          currentTime: currentTime,
                          duration: videoDuration,
                          pct: Math.min(100, Math.round((currentTime / videoDuration) * 100))
                        }, '*');
                      }
                    } else if (rawIdx !== undefined && rawIdx !== null) {
                      // Pour CoursePresentation : ending-point est 1-indexé (numéro de diapo)
                      var slideIdx = Number(rawIdx) - 1;
                      if (slideIdx >= 0) {
                        visitedSlides.add(slideIdx);
                        window.parent.postMessage({
                          type: 'h5p-slide-update',
                          current: slideIdx,
                          visited: Array.from(visitedSlides),
                          total: totalSlides
                        }, '*');
                        if (totalSlides > 0 && visitedSlides.size >= totalSlides) {
                          notifyCompleted();
                        }
                      }
                    }
                  }

                  // Fallback : si H5P fire quand même 'completed' ou 'passed'
                  if (verb === 'completed' || verb === 'passed') {
                    for (var i = 0; i < totalSlides; i++) visitedSlides.add(i);
                    notifyCompleted();
                  }
                } catch(e) {}
              });
            }
          }, 500);
        })
        .catch(function(err) {
          container.innerHTML =
            '<div style="color:#fff;padding:2rem;font-family:sans-serif;">' +
            '<h2 style="margin-bottom:1rem;">Erreur de chargement H5P</h2>' +
            '<pre style="background:#333;padding:1rem;border-radius:8px;overflow:auto;">' +
            err.toString() + '</pre></div>';
        });
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
