/**
 * GitHub Blog Loader
 * This script loads blog posts from a GitHub repository.
 */

class GitHubBlogLoader {
    constructor(username, repo, path) {
        this.username = username;
        this.repo = repo;
        this.path = path;
        this.apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;
        this.rawContentUrl = `https://raw.githubusercontent.com/${username}/${repo}/main/${path}`;
    }

    /**
     * Fetch all blog posts from the GitHub repository
     * @returns {Promise<Array>} Array of blog post objects
     */
    async fetchBlogPosts() {
        try {
            const response = await fetch(this.apiUrl);
            
            if (!response.ok) {
                throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
            }
            
            const files = await response.json();
            
            // Filter for HTML and Markdown files
            const blogFiles = files.filter(file => file.name.endsWith('.html') || file.name.endsWith('.md'));
            
            // Process each file to extract blog post information
            const blogPosts = await Promise.all(
                blogFiles.map(file => this.processBlogFile(file))
            );
            
            // Sort by date (most recent first)
            return blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
            
        } catch (error) {
            console.error('Error fetching blog posts from GitHub:', error);
            throw error;
        }
    }

    /**
     * Process a blog file to extract metadata and content
     * @param {Object} file - The file object from GitHub API
     * @returns {Promise<Object>} Blog post object with metadata and content
     */
    async processBlogFile(file) {
        try {
            const response = await fetch(file.download_url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch file content: ${response.status} ${response.statusText}`);
            }
            
            const content = await response.text();
            const isMarkdown = file.name.endsWith('.md');
            
            if (isMarkdown) {
                return this.processMarkdownFile(file, content);
            } else {
                return this.processHtmlFile(file, content);
            }
            
        } catch (error) {
            console.error(`Error processing blog file ${file.name}:`, error);
            
            // Return a minimal blog post object if there's an error
            return {
                id: file.sha,
                title: file.name.replace(/\.html$|\.md$/, '').replace(/-/g, ' '),
                date: new Date().toLocaleDateString(),
                author: 'Anonymous',
                category: 'Uncategorized',
                excerpt: 'Failed to load blog post content.',
                image: 'images/blog-placeholder.jpg',
                tags: [],
                slug: file.name.replace(/\.html$|\.md$/, ''),
                path: file.path,
                url: file.download_url,
                content: '<p>Failed to load blog post content.</p>'
            };
        }
    }

    /**
     * Process an HTML blog file
     * @param {Object} file - The file object from GitHub API
     * @param {string} html - The HTML content
     * @returns {Object} Blog post object
     */
    processHtmlFile(file, html) {
        // Extract metadata from HTML meta tags
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Create a blog post object
        return {
            id: file.sha,
            title: this.getMetaContent(doc, 'blog-title') || file.name.replace(/\.html$/, '').replace(/-/g, ' '),
            date: this.getMetaContent(doc, 'blog-date') || new Date().toLocaleDateString(),
            author: this.getMetaContent(doc, 'blog-author') || 'Anonymous',
            category: this.getMetaContent(doc, 'blog-category') || 'Uncategorized',
            excerpt: this.getMetaContent(doc, 'blog-excerpt') || this.generateExcerpt(doc),
            image: this.getMetaContent(doc, 'blog-image') || 'images/blog-placeholder.jpg',
            tags: this.getMetaContent(doc, 'blog-tags') ? this.getMetaContent(doc, 'blog-tags').split(',').map(tag => tag.trim()) : [],
            slug: file.name.replace(/\.html$/, ''),
            path: file.path,
            url: file.download_url,
            content: doc.querySelector('article') ? doc.querySelector('article').innerHTML : html
        };
    }

    /**
     * Process a Markdown blog file
     * @param {Object} file - The file object from GitHub API
     * @param {string} markdown - The Markdown content
     * @returns {Object} Blog post object
     */
    processMarkdownFile(file, markdown) {
        // Extract YAML frontmatter
        const frontmatter = this.extractFrontmatter(markdown);
        const content = this.removeYamlFrontmatter(markdown);
        
        // For now, just use the raw markdown - in a production site, 
        // you would convert markdown to HTML using a library like marked or showdown
        const htmlContent = `<div class="markdown-content">${this.simpleMarkdownToHtml(content)}</div>`;
        
        return {
            id: file.sha,
            title: frontmatter['blog-title'] || file.name.replace(/\.md$/, '').replace(/-/g, ' '),
            date: frontmatter['blog-date'] || new Date().toLocaleDateString(),
            author: frontmatter['blog-author'] || 'Anonymous',
            category: frontmatter['blog-category'] || 'Uncategorized',
            excerpt: frontmatter['blog-excerpt'] || this.generateExcerptFromMarkdown(content),
            image: frontmatter['blog-image'] || 'images/blog-placeholder.jpg',
            tags: frontmatter['blog-tags'] ? frontmatter['blog-tags'].split(',').map(tag => tag.trim()) : [],
            slug: file.name.replace(/\.md$/, ''),
            path: file.path,
            url: file.download_url,
            content: htmlContent
        };
    }

    /**
     * Extract YAML frontmatter from markdown content
     * @param {string} markdown - The markdown content
     * @returns {Object} Frontmatter as key-value pairs
     */
    extractFrontmatter(markdown) {
        const frontmatter = {};
        
        if (markdown.startsWith('---')) {
            const parts = markdown.split('---');
            if (parts.length >= 3) {
                const yamlContent = parts[1].trim();
                const lines = yamlContent.split('\n');
                
                lines.forEach(line => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex !== -1) {
                        const key = line.slice(0, colonIndex).trim();
                        const value = line.slice(colonIndex + 1).trim();
                        frontmatter[key] = value;
                    }
                });
            }
        }
        
        return frontmatter;
    }

    /**
     * Remove YAML frontmatter from markdown content
     * @param {string} markdown - The markdown content
     * @returns {string} Markdown content without frontmatter
     */
    removeYamlFrontmatter(markdown) {
        if (markdown.startsWith('---')) {
            const parts = markdown.split('---');
            if (parts.length >= 3) {
                // Return everything after the second ---
                return parts.slice(2).join('---').trim();
            }
        }
        return markdown;
    }

    /**
     * Very simple markdown to HTML converter
     * Note: This is a basic implementation. For production, use a proper markdown library
     * @param {string} markdown - The markdown content
     * @returns {string} HTML content
     */
    simpleMarkdownToHtml(markdown) {
        let html = markdown;
        
        // Handle headers - h1, h2, h3
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        
        // Handle bold and italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Handle links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
        
        // Handle code blocks
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Handle inline code
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Handle unordered lists
        html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)(?!\s*<li>)/gs, '<ul>$1</ul>');
        
        // Handle ordered lists - very basic
        html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
        
        // Handle paragraphs
        // This split-join approach ensures that code blocks and lists aren't affected
        const paragraphs = html.split('\n\n').map(p => {
            if (
                !p.startsWith('<h') && 
                !p.startsWith('<ul') && 
                !p.startsWith('<li') && 
                !p.startsWith('<pre') &&
                !p.startsWith('<code') &&
                !p.trim().endsWith('</li>') &&
                !p.trim().endsWith('</ul>') &&
                !p.trim().endsWith('</pre>') &&
                !p.trim().endsWith('</code>')
            ) {
                return `<p>${p}</p>`;
            }
            return p;
        });
        
        return paragraphs.join('\n\n');
    }

    /**
     * Generate an excerpt from markdown content
     * @param {string} markdown - The markdown content
     * @returns {string} Generated excerpt
     */
    generateExcerptFromMarkdown(markdown) {
        // Remove code blocks, headers, etc.
        const cleanText = markdown
            .replace(/```[\s\S]*?```/g, '')
            .replace(/^#+\s.*$/gm, '')
            .replace(/!\[.*?\]\(.*?\)/g, '');
        
        // Find the first paragraph-like text
        const match = cleanText.match(/^[^#\n].+/m);
        if (match) {
            return match[0].substring(0, 150) + '...';
        }
        
        // Fallback: just take the first 150 characters
        return cleanText.trim().substring(0, 150) + '...';
    }

    /**
     * Extract content from a meta tag
     * @param {Document} doc - The parsed HTML document
     * @param {string} name - The name of the meta tag
     * @returns {string|null} The content of the meta tag or null if not found
     */
    getMetaContent(doc, name) {
        const meta = doc.querySelector(`meta[name="${name}"]`);
        return meta ? meta.getAttribute('content') : null;
    }

    /**
     * Generate an excerpt from the blog post content
     * @param {Document} doc - The parsed HTML document
     * @returns {string} The generated excerpt
     */
    generateExcerpt(doc) {
        const article = doc.querySelector('article');
        
        if (!article) {
            const paragraphs = doc.querySelectorAll('p');
            if (paragraphs.length > 0) {
                // Use the first paragraph as excerpt
                return paragraphs[0].textContent.trim().substring(0, 150) + '...';
            }
            return 'No excerpt available.';
        }
        
        const paragraphs = article.querySelectorAll('p');
        if (paragraphs.length > 0) {
            // Use the first paragraph as excerpt
            return paragraphs[0].textContent.trim().substring(0, 150) + '...';
        }
        
        return article.textContent.trim().substring(0, 150) + '...';
    }
}

// Example usage:
// const blogLoader = new GitHubBlogLoader('yourusername', 'yourrepo', 'blogs');
// blogLoader.fetchBlogPosts().then(posts => console.log(posts)); 