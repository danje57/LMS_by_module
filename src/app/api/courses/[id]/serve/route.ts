import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractH5P } from "@/lib/h5p";

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

  // Extraire le .h5p si pas encore fait
  try {
    await extractH5P(course.filePath);
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
    #h5p-container {
      width: 100%;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 0;
    }
    #h5p-container > div { width: 100%; }
    .h5p-iframe-wrapper { width: 100% !important; }
  </style>
  <link rel="stylesheet" href="/h5p-standalone/styles/h5p.css">
</head>
<body>
  <div id="h5p-container"></div>

  <script src="/h5p-standalone/main.bundle.js"></script>
  <script>
    (function() {
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
          // Écouter les événements xAPI pour détecter la complétion
          var attempts = 0;
          var interval = setInterval(function() {
            attempts++;
            if (attempts > 120) { clearInterval(interval); return; }
            if (window.H5P && window.H5P.externalDispatcher) {
              clearInterval(interval);
              window.H5P.externalDispatcher.on('xAPI', function(event) {
                try {
                  var verb = event.getVerb ? event.getVerb() : '';
                  if (verb === 'completed' || verb === 'passed') {
                    window.parent.postMessage({ type: 'h5p-completed' }, '*');
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
