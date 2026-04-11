// Apple App Site Association file for Universal Links.
// iOS uses this to decide whether to open tote.tools/invite/... links
// in the Tote app instead of Safari.
//
// Replace XXXXXXXXXX with your Apple Developer Team ID
// (10-char string from developer.apple.com → Membership).

export function GET() {
  const aasa = {
    applinks: {
      details: [
        {
          appIDs: ['XXXXXXXXXX.tools.tote.app'],
          components: [
            { '/': '/invite/*', comment: 'Accept collection invites' },
          ],
        },
      ],
    },
  };

  return new Response(JSON.stringify(aasa), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
