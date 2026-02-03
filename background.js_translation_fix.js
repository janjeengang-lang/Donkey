if (message.type === 'TRANSLATE_BATCH') {
    (async () => {
        try {
            const targetLang = message.targetLanguage || 'English';
            const sourceLang = message.sourceLanguage || 'Arabic';

            // Professional sentence-based translation prompt
            const prompt = 'You are a professional simultaneous interpreter. Translate complete sentences only.\n\nTASK: Translate to ' + targetLang + '. Rules:\n1. Translate complete sentences, not fragments\n2. Natural, fluent phrasing\n3. Preserve original tone\n4. Proper punctuation\n5. Output ONLY translation\n\nText: ' + message.text;

            const result = await callGenerativeModel(prompt, { temperature: 0.3, max_completion_tokens: 200 });
            let clean = result.replace(/^(Here is|Translation:|Answer:)/i, '').replace(/^[\'`""]+|[\'`""]+$/g, '').trim();
            if (clean.startsWith('{')) {
                try {
                    clean = JSON.parse(clean).answer || clean;
                } catch (e) {
                    console.error('JSON Parse Error:', e);
                }
            }
            sendResponse({ translated: clean });
        } catch (err) {
            console.error('[Zepra Translator] Failed:', err);
            sendResponse({ translated: null, error: err.message });
        }
    })();
    return true;
}