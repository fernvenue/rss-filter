export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);
            const path = url.pathname.split('/-/');
            if (path.length !== 2 || !path[1]) {
                return new Response(JSON.stringify({ code: 404, message: "Source not found." }), {
                    status: 404,
                    headers: { "Content-Type": "application/json; charset=utf-8" }
                });
            }

            const rawTargetUrl = path[1];
            const targetUrl = new URL(rawTargetUrl.startsWith('http') ? rawTargetUrl : `https://${rawTargetUrl}`).toString();
            const regexPattern = await env.RSS_FILTER_RULES.get(targetUrl);

            if (!regexPattern) {
                return new Response(JSON.stringify({ code: 404, message: "Source not found." }), {
                    status: 404,
                    headers: { "Content-Type": "application/json; charset=utf-8" }
                });
            }

            let response;
            try {
                response = await fetch(targetUrl);
            } catch {
                return new Response(JSON.stringify({ code: 504, message: "The target did not respond." }), {
                    status: 504,
                    headers: { "Content-Type": "application/json; charset=utf-8" }
                });
            }

            if (!response.ok) {
                return new Response(JSON.stringify({ code: 400, message: "The target returned an error.", data: response.status }), {
                    status: 400,
                    headers: { "Content-Type": "application/json; charset=utf-8" }
                });
            }

            const rssContent = await response.text();
            const filteredContent = processRSSContent(rssContent, regexPattern);

            if (!filteredContent || filteredContent.trim() === "") {
                return new Response(JSON.stringify({ code: 204, message: "No content matched the filter." }), {
                    status: 204,
                    headers: { "Content-Type": "application/json; charset=utf-8" }
                });
            }

            return new Response(filteredContent, {
                headers: { "Content-Type": "application/xml; charset=utf-8" }
            });
        } catch {
            return new Response(JSON.stringify({ code: 500, message: "Internal server error." }), {
                status: 500,
                headers: { "Content-Type": "application/json; charset=utf-8" }
            });
        }
    }
};

function processRSSContent(content, regexPattern) {
    if (content.includes('<rss') && content.includes('<channel>')) {
        return filterRSS2(content, regexPattern);
    } else if (content.includes('<feed') && content.includes('xmlns="http://www.w3.org/2005/Atom"')) {
        return filterAtom(content, regexPattern);
    } else {
        return "<?xml version='1.0' encoding='UTF-8'?><error>Unsupported RSS format</error>";
    }
}

function filterRSS2(content, regexPattern) {
    try {
        const regex = new RegExp(regexPattern, "i");
        const [header, body] = splitRSS2(content);
        const items = parseRSS2Items(body);
        const filteredItems = items.filter(item => regex.test(item.title));
        if (filteredItems.length === 0) return "";
        return `${header}${buildRSS2(filteredItems)}</channel></rss>`;
    } catch {
        return "<?xml version='1.0' encoding='UTF-8'?><error>Processing error occurred</error>";
    }
}

function splitRSS2(content) {
    const headerEnd = content.indexOf("<item");
    const header = content.substring(0, headerEnd);
    const body = content.substring(headerEnd);
    return [header, body];
}

function parseRSS2Items(body) {
    const items = [];
    const itemRegex = /<item.*?>(.*?)<\/item>/gs;
    let match;

    while ((match = itemRegex.exec(body)) !== null) {
        const itemContent = match[1];
        const titleMatch = /<title>(.*?)<\/title>/i.exec(itemContent);
        const linkMatch = /<link>(.*?)<\/link>/i.exec(itemContent);
        const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/i.exec(itemContent);
        const descriptionMatch = /<description>(.*?)<\/description>/i.exec(itemContent);

        items.push({
            title: titleMatch ? titleMatch[1] : "",
            link: linkMatch ? linkMatch[1] : "",
            pubDate: pubDateMatch ? pubDateMatch[1] : "",
            description: descriptionMatch ? descriptionMatch[1] : ""
        });
    }

    return items;
}

function buildRSS2(items) {
    return items.map(item => `
        <item>
            <title>${escapeXML(item.title)}</title>
            <link>${escapeXML(item.link)}</link>
            <pubDate>${escapeXML(item.pubDate)}</pubDate>
            <description>${escapeXML(item.description)}</description>
        </item>
    `).join("");
}

function filterAtom(content, regexPattern) {
    try {
        const regex = new RegExp(regexPattern, "i");
        const [header, body] = splitAtom(content);
        const entries = parseAtomEntries(body);
        const filteredEntries = entries.filter(entry => regex.test(entry.title));
        if (filteredEntries.length === 0) return "";
        return `${header}${buildAtom(filteredEntries)}</feed>`;
    } catch {
        return "<?xml version='1.0' encoding='UTF-8'?><error>Processing error occurred</error>";
    }
}

function splitAtom(content) {
    const headerEnd = content.indexOf("<entry");
    const header = content.substring(0, headerEnd);
    const body = content.substring(headerEnd);
    return [header, body];
}

function parseAtomEntries(body) {
    const entries = [];
    const entryRegex = /<entry.*?>(.*?)<\/entry>/gs;
    let match;

    while ((match = entryRegex.exec(body)) !== null) {
        const entryContent = match[1];
        const titleMatch = /<title.*?>(.*?)<\/title>/i.exec(entryContent);
        const linkMatch = /<link.*?href=["'](.*?)["']/i.exec(entryContent);
        const updatedMatch = /<updated>(.*?)<\/updated>/i.exec(entryContent);
        const contentMatch = /<content.*?>(.*?)<\/content>/is.exec(entryContent);

        entries.push({
            title: titleMatch ? titleMatch[1] : "",
            link: linkMatch ? linkMatch[1] : "",
            updated: updatedMatch ? updatedMatch[1] : "",
            content: contentMatch ? contentMatch[1] : ""
        });
    }

    return entries;
}

function buildAtom(entries) {
    return entries.map(entry => `
        <entry>
            <title>${escapeXML(entry.title)}</title>
            <link href="${escapeXML(entry.link)}"/>
            <updated>${escapeXML(entry.updated)}</updated>
            <content type="html">${escapeXML(entry.content)}</content>
        </entry>
    `).join("");
}

function escapeXML(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&apos;");
}

