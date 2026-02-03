// 📁 markdown_renderer.js - High Performance Rendering Engine
// Optimized for Chrome Extensions (Zero Dependencies, Safe HTML)

class ZepraMarkdownRenderer {
    constructor() {
        this.reset();
    }

    reset() {
        this.inTable = false;
        this.tableBuffer = [];
        this.inCode = false;
        this.codeBuffer = [];
        this.codeLang = '';
        this.inList = false;
    }

    /**
     * Main Parse Function
     * Converts Markdown Text -> Safe HTML
     */
    parse(text) {
        if (!text) return '';
        const lines = text.split(/\r?\n/);
        let htmlChunks = [];
        this.reset();

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmed = line.trim();

            // 1. CODE BLOCKS
            if (trimmed.startsWith('```')) {
                if (this.inCode) {
                    // End Code
                    htmlChunks.push(this.renderCode(this.codeBuffer, this.codeLang));
                    this.inCode = false;
                    this.codeBuffer = [];
                    this.codeLang = '';
                } else {
                    // Start Code
                    this.inCode = true;
                    this.codeLang = trimmed.replace(/```/, '').trim();
                }
                continue;
            }
            if (this.inCode) {
                this.codeBuffer.push(line);
                continue;
            }

            // 2. TABLES (Check for |...|)
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                this.inTable = true;
                this.tableBuffer.push(line);
                continue;
            } else if (this.inTable) {
                this.flushTable(htmlChunks);
            }

            // 3. LISTS
            const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
            if (listMatch) {
                if (!this.inList) {
                    htmlChunks.push('<ul>');
                    this.inList = true;
                }
                htmlChunks.push(`<li>${this.formatInline(listMatch[3])}</li>`);
                continue;
            } else if (this.inList) {
                this.flushList(htmlChunks);
            }

            // 4. HEADERS
            const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                htmlChunks.push(`<h${level}>${this.formatInline(headerMatch[2])}</h${level}>`);
                continue;
            }

            // 5. BLOCKQUOTES
            if (trimmed.startsWith('>')) {
                const quoteContent = trimmed.replace(/^>\s*/, '');
                htmlChunks.push(`<blockquote>${this.formatInline(quoteContent)}</blockquote>`);
                continue;
            }

            // 6. EMPTY LINES
            if (trimmed === '') continue;

            // 7. PARAGRAPHS
            htmlChunks.push(`<p>${this.formatInline(line)}</p>`);
        }

        this.flushAll(htmlChunks);
        return htmlChunks.join('\n');
    }

    flushAll(chunks) {
        this.flushTable(chunks);
        this.flushList(chunks);
        if (this.inCode) { // Auto-close code blocks if input ends
            chunks.push(this.renderCode(this.codeBuffer, this.codeLang));
        }
    }

    flushTable(chunks) {
        if (!this.inTable || this.tableBuffer.length === 0) return;
        if (this.tableBuffer.length < 2) {
            // Not a real table (needs header + separator)
            chunks.push(`<p>${this.tableBuffer.map(l => this.formatInline(l)).join('<br>')}</p>`);
        } else {
            chunks.push(this.renderTable(this.tableBuffer));
        }
        this.inTable = false;
        this.tableBuffer = [];
    }

    flushList(chunks) {
        if (this.inList) {
            chunks.push('</ul>');
            this.inList = false;
        }
    }

    /**
     * Renders a Table with header support
     */
    renderTable(rows) {
        if (rows.length === 0) return '';

        let html = '<div class="table-wrapper"><table>';

        // Header
        const headerCells = rows[0].split('|').filter(c => c.trim() !== '');
        html += '<thead><tr>';
        headerCells.forEach(cell => {
            html += `<th>${this.formatInline(cell.trim())}</th>`;
        });
        html += '</tr></thead><tbody>';

        // Body (Skip index 1 which is separator |---|)
        for (let i = 2; i < rows.length; i++) {
            const cells = rows[i].split('|').filter(c => c.trim() !== '');
            html += '<tr>';
            cells.forEach(cell => {
                html += `<td>${this.formatInline(cell.trim())}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table></div>';
        return html;
    }

    renderCode(lines, lang) {
        const content = lines.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class="language-${lang}">${content}</code></pre>`;
    }

    /**
     * Inline Formatter with Safe HTML Support
     */
    formatInline(text) {
        // 1. Protect HTML Tags (Safe Subset)
        // Allow: span (class), div (class), button (class), br
        const protectedTags = [];
        let pText = text.replace(/<(\/?)(span|div|button|br)([^>]*)>/g, (match) => {
            protectedTags.push(match);
            return `__TAG${protectedTags.length - 1}__`;
        });

        // 2. Escape Unsafe Text
        pText = pText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 3. Markdown Syntax
        pText = pText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        pText = pText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        pText = pText.replace(/`([^`]+)`/g, '<code>$1</code>');
        pText = pText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // 4. Restore Protected Tags
        pText = pText.replace(/__TAG(\d+)__/g, (m, id) => protectedTags[id]);

        return pText;
    }
}
