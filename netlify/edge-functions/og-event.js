// Runs at Netlify's edge before the SPA is served. Social media crawlers
// (Facebook, Twitter, WhatsApp, etc.) don't execute JavaScript, so a plain
// React SPA shows a bare/generic preview when a link is shared. This
// intercepts ONLY requests from known crawler user-agents on /events/:id
// and returns a small HTML page with real Open Graph tags pulled from
// Supabase. Everyone else (regular browsers) passes through untouched.

const BOT_PATTERN = /facebookexternalhit|Twitterbot|WhatsApp|Slackbot|Discordbot|LinkedInBot|TelegramBot|Pinterest|Googlebot|SkypeUriPreview|Line\//i;

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export default async (request, context) => {
  const userAgent = request.headers.get("user-agent") || "";
  if (!BOT_PATTERN.test(userAgent)) {
    return context.next();
  }

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/events\/([a-f0-9-]+)/i);
  if (!match) return context.next();

  const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return context.next();

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/events?id=eq.${match[1]}&select=title,description,banner_url,event_date,city,venue`,
      { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` } }
    );
    const [event] = await res.json();
    if (!event) return context.next();

    const title = escapeHtml(event.title);
    const dateStr = new Date(event.event_date).toLocaleDateString("en-PH", {
      dateStyle: "medium",
    });
    const description = escapeHtml(
      event.description?.slice(0, 160) || `${dateStr} · ${event.venue}, ${event.city}`
    );
    const image = event.banner_url || `${url.origin}/icon-512.png`;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title} — Fandomly</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(url.href)}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>${title}</body>
</html>`;

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return context.next();
  }
};

export const config = { path: "/events/*" };
