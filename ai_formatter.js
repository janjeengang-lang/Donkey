// 🧙‍♂️ Zepra AI - Conversation Transformer (Bridge)
// This script cleans raw scraped data and formats it for AI context transfer.

function cleanHTML(html) {
    // 1. Create a temporary DOM element to handle HTML parsing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // 2. Remove noise attributes (data-start, data-end, class, style)
    const elements = tempDiv.querySelectorAll('*');
    elements.forEach(el => {
        el.removeAttribute('data-start');
        el.removeAttribute('data-end');
        el.removeAttribute('class');
        el.removeAttribute('style');
        // Unwarp unnecessary spans if needed, but keeping structure is safer for now.
    });

    // 3. Convert basic HTML to pseudo-Markdown for better AI readability
    // (This is a simplified approach, a full library like TurndownService is better for production)

    let text = tempDiv.innerHTML;

    // Replace Headers
    text = text.replace(/<h1>(.*?)<\/h1>/g, '# $1\n');
    text = text.replace(/<h2>(.*?)<\/h2>/g, '## $1\n');
    text = text.replace(/<h3>(.*?)<\/h3>/g, '### $1\n');

    // Replace Quotes
    text = text.replace(/<blockquote>/g, '> ');
    text = text.replace(/<\/blockquote>/g, '\n');

    // Replace Lists
    text = text.replace(/<ul>/g, '');
    text = text.replace(/<\/ul>/g, '\n');
    text = text.replace(/<ol>/g, '');
    text = text.replace(/<\/ol>/g, '\n');
    text = text.replace(/<li>/g, '- ');
    text = text.replace(/<\/li>/g, '\n');

    // Replace Paragraphs and Line Breaks
    text = text.replace(/<p>/g, '');
    text = text.replace(/<\/p>/g, '\n\n');
    text = text.replace(/<br\s*\/?>/g, '\n');
    text = text.replace(/<hr\s*\/?>/g, '---\n');

    // Clean up remaining tags (bold, italic remain readable in HTML or MD)
    text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    text = text.replace(/<em>(.*?)<\/em>/g, '*$1*');

    // Remove any remaining tags
    text = text.replace(/<\/?[^>]+(>|$)/g, "");

    // Decode HTML entities
    const decoder = document.createElement('textarea');
    decoder.innerHTML = text;
    return decoder.value.trim();
}

function generateBridgePrompt(data) {
    let conversationHistory = "";

    data.conversation.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant (Previous AI)';
        const content = role === 'User' ? msg.content : cleanHTML(msg.content);

        conversationHistory += `\n---\n**Role:** ${role}\n**Content:**\n${content}\n`;
    });

    const bridgePrompt = `
*** SYSTEM INSTRUCTION: CONTEXT TRANSFER ***
You are continuing a conversation that started with another AI model.
Below is the full detailed history of that conversation.

**Your Goal:**
1. Read the history carefully to understand the user's specific request, tone (Egyptian Slang/Bargaining), and the previous AI's persona.
2. CONTINUE from where the last message ended. Do not summarize unless asked.
3. ADAPT your personality to match the helpful, witty, and 'street-smart' tone established in the history.

**Conversation History:**
${conversationHistory}
\n\n*** END OF HISTORY ***\n(Please wait for my next input or continue naturally if the last turn requires a response.)
`;

    return bridgePrompt;
}

// Example Usage (You can run this in console with the data you scraped)
// const prompt = generateBridgePrompt(PASTE_JSON_HERE);
// console.log(prompt);
