// assets/js/log-worker.js

function verifyBot(ip) {
    if (!ip) return false;
    // Simple checks, not foolproof but good for a client-side tool.
    // Google
    if (ip.startsWith('66.249.')) return true;
    // Bing
    if (ip.startsWith('157.55.') || ip.startsWith('40.77.') || ip.startsWith('207.46.')) return true;
    // ... add other known bot IP ranges if needed

    // A simple heuristic to exclude common DNS resolvers mistaken for bots
    if (ip.startsWith('8.8.8.8') || ip.startsWith('1.1.1.1')) return false;

    // Default to true for known bot user agents as a fallback.
    // The real verification should be DNS lookup, which is not possible client-side.
    return true;
}

function classifyUserAgent(uaString) {
    if (!uaString || uaString === '-') return 'Other';
    const ua = uaString.toLowerCase();
    if (ua.includes('google-inspectiontool')) return 'Google-InspectionTool';
    if (ua.includes('googlebot-image')) return 'Googlebot-Image';
    if (ua.includes('googlebot-video')) return 'Googlebot-Video';
    if (ua.includes('googlebot')) {
        return ua.includes('mobile') ? 'Googlebot-Mobile' : 'Googlebot-Desktop';
    }
    if (ua.includes('bingbot')) return 'Bingbot';
    if (ua.includes('yandex')) return 'YandexBot';
    if (ua.includes('duckduckbot')) return 'DuckDuckBot';
    if (ua.includes('ahrefsbot')) return 'AhrefsBot';
    if (ua.includes('semrushbot')) return 'SemrushBot';
    if (ua.includes('bot') || ua.includes('spider') || ua.includes('crawler')) return 'bots';
    return 'Other';
}

// --- START: Export for Unit Tests ---
if (typeof self.window !== 'undefined' && typeof self.window.document !== 'undefined') {
    self.window.logAnalyzerForTests = {
        classifyUserAgent,
        verifyBot
    };
}
// --- END: Export for Unit Tests ---

if (typeof self.document === 'undefined') { // Only run this part inside the actual worker
    // A more robust regex that handles missing referrers and user agents gracefully.
    const LOG_FORMAT_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S*) ?(\S+)(?: HTTP\/\d\.\d)?" (\d{3}) \S+ "([^"]*)" "([^"]*)"/;

    self.onmessage = function(event) {
        const fileContent = event.data;
        if (!fileContent) {
            self.postMessage({
                type: 'error',
                error: "File content is empty."
            });
            return;
        }

        const lines = fileContent.split('\n');
        const totalLines = lines.length;
        let processedLines = 0;

        let lastProgressUpdate = Date.now();

        const allParsedLines = lines.map(line => {
            processedLines++;

            const now = Date.now();
            if (now - lastProgressUpdate > 100) { // Update progress every 100ms
                self.postMessage({
                    type: 'progress',
                    progress: (processedLines / totalLines) * 100
                });
                lastProgressUpdate = now;
            }

            if (line.trim() === '') return null;

            const match = line.match(LOG_FORMAT_REGEX);
            if (!match) return null;

            const ip = match[1];
            const userAgent = match[7] || "";

            return {
                ip,
                botType: classifyUserAgent(userAgent),
                isVerified: verifyBot(ip),
                date: match[2].split(':')[0],
                request: match[4],
                statusCode: parseInt(match[5], 10),
                userAgent: userAgent // Pass the full user agent string
            };
        }).filter(Boolean);

        // Ensure final progress is 100%
        self.postMessage({
            type: 'progress',
            progress: 100
        });

        self.postMessage({
            type: 'complete',
            result: {
                allParsedLines,
                totalHits: allParsedLines.length
            }
        });
    };
}
