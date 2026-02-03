// 🕵️‍♂️ Zepra AI - ChatGPT Smart Scraper v1.0
// This script extracts the full conversation history from the current ChatGPT page.

(function () {
    console.log("🚀 Zepra Scraper started...");

    const messages = [];

    // 1. Find all conversation turns (user & assistant messages are wrapped in <article>)
    const turns = document.querySelectorAll('article');

    if (turns.length === 0) {
        console.error("❌ No messages found! The page structure might have changed.");
        return;
    }

    turns.forEach((turn, index) => {
        // 2. Determine the role (User or Assistant)
        // We look for the element containing the 'data-message-author-role' attribute
        const roleElement = turn.querySelector('[data-message-author-role]');

        if (!roleElement) return; // Skip if structure is unexpected

        const role = roleElement.getAttribute('data-message-author-role');

        // 3. Extract Content based on role
        let content = "";

        if (role === 'user') {
            // User content is usually in a div with formatting classes
            // We specifically look for the text wrapper to avoid "Edit" buttons etc.
            const contentNode = turn.querySelector('.whitespace-pre-wrap');
            if (contentNode) {
                content = contentNode.innerText.trim();
            }
        } else if (role === 'assistant') {
            // Assistant content is in the markdown container
            // We want the innerHTML to keep formatting (bold, lists, code blocks)
            // Or innerText if we just want raw text. For "Memory Transfer", HTML/Markdown is better.
            const contentNode = turn.querySelector('.markdown');
            if (contentNode) {
                // Clone to clean it up if necessary (e.g. remove citations if they exist as separate elements)
                content = contentNode.innerHTML.trim();
                // Conversion to simplified Markdown can happen here or later.
                // For now, let's keep HTML to preserve the exact structure (tables, lists).
            }
        }

        if (content) {
            messages.push({
                index: index + 1,
                role: role,
                content: content,
                timestamp: new Date().toISOString() // Placeholder timestamp
            });
        }
    });

    // 4. Output Results
    console.log(`✅ Successfully extracted ${messages.length} messages.`);
    console.table(messages); // Show a nice table in console

    // 5. Create the "Bridge" JSON
    const bridgeData = {
        source: "ChatGPT",
        extracted_at: new Date().toISOString(),
        conversation: messages
    };

    const jsonString = JSON.stringify(bridgeData, null, 2);

    // Copy to clipboard automatically for the user
    try {
        navigator.clipboard.writeText(jsonString);
        console.log("📋 Copied to clipboard! You can now paste this into a file.");
    } catch (err) {
        console.warn("⚠️ Could not auto-copy. Please copy the object below manually.");
        console.log(jsonString);
    }

    return bridgeData;
})();
