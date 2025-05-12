/**
 * GitHub Blog Loader
 * This script loads blog posts from a GitHub repository.
 */

class GitHubBlogLoader {
    constructor(username, repo, path) {
        this.username = username;
        this.repo = repo;
        this.path = path;
        
        // For GitHub Pages, use direct URLs to the raw content
        if (repo.endsWith('.github.io')) {
            // This is a GitHub Pages site, use URLs relative to the current domain
            this.apiUrl = `https://${username}.github.io/${path}`;
            this.rawContentUrl = `https://${username}.github.io/${path}`;
        } else {
            // Standard GitHub repository
            this.apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;
            this.rawContentUrl = `https://raw.githubusercontent.com/${username}/${repo}/main/${path}`;
        }
        
        console.log(`GitHubBlogLoader initialized with API URL: ${this.apiUrl}`);
    }

    /**
     * Fetch all blog posts from the GitHub repository
     * @returns {Promise<Array>} Array of blog post objects
     */
    async fetchBlogPosts() {
        console.warn('fetchBlogPosts is deprecated, use fetchPosts instead');
        return this.fetchPosts();
    }

    /**
     * Process a blog file to extract metadata and content
     * @param {Object} file - The file info object
     * @returns {Promise<Object>} Blog post object with metadata and content
     */
    async processBlogFile(file) {
        try {
            // Handle both relative and absolute paths
            let filePath = file.path;
            let fullUrl;
            
            // Create GitHub Pages URL
            if (window.location.hostname.includes('github.io')) {
                // Direct fetch from GitHub raw content
                const ghUsername = 'gourikartha';
                const ghRepo = 'gourikartha.github.io';
                
                // Remove leading slash if present
                if (filePath.startsWith('/')) {
                    filePath = filePath.substring(1);
                }
                
                // Use raw.githubusercontent.com for direct content access
                fullUrl = `https://raw.githubusercontent.com/${ghUsername}/${ghRepo}/main/${filePath}`;
                console.log(`Trying to fetch from GitHub raw content: ${fullUrl}`);
            } else {
                // Local development
                if (filePath.startsWith('/')) {
                    filePath = filePath.substring(1);
                }
                fullUrl = new URL(filePath, window.location.origin).href;
                console.log(`Trying to fetch locally: ${fullUrl}`);
            }
            
            const response = await fetch(fullUrl);
            
            if (!response.ok) {
                console.error(`Failed to fetch file ${fullUrl}: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }
            
            const content = await response.text();
            const isMarkdown = file.name.endsWith('.md');
            
            // Generate a unique ID for the post
            const id = `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            // Use the date information provided in the index.json file if available
            let postDate = file.date || new Date().toLocaleDateString();
            
            try {
                if (isMarkdown) {
                    return this.processMarkdownFile({ ...file, id, date: postDate, path: fullUrl }, content);
                } else {
                    return this.processHtmlFile({ ...file, id, date: postDate, path: fullUrl }, content);
                }
            } catch (processingError) {
                console.error(`Error processing content for ${file.name || 'unknown file'}:`, processingError);
                
                // Extract name from path if needed
                let name = file.name;
                if (!name && file.path) {
                    // Extract filename from path
                    const pathParts = file.path.split('/');
                    name = pathParts[pathParts.length - 1];
                    console.log(`Extracted name from path for error fallback: ${name}`);
                }
                
                // Create a minimal blog post from the available data
                return {
                    id: id,
                    name: name || 'unknown-file',
                    title: file.title || (name ? name.replace(/\.(html|md)$/, '').replace(/-/g, ' ') : 'Untitled'),
                    date: postDate,
                    author: file.author || 'Unknown Author',
                    category: 'Uncategorized',
                    excerpt: 'Blog post excerpt...',
                    image: 'images/blog-placeholder.jpg',
                    tags: [],
                    slug: file.slug || (name ? name.replace(/\.(html|md)$/, '') : `post-${id}`),
                    path: fullUrl,
                    content: `<h2>${file.title || (name || 'Unknown Post')}</h2><p>Content could not be fully loaded.</p>`
                };
            }
            
        } catch (error) {
            console.error(`Error processing blog file ${file.name}:`, error);
            throw error;
        }
    }

    /**
     * Process an HTML blog file
     * @param {Object} file - The file info object
     * @param {string} html - The HTML content
     * @returns {Object} Blog post object
     */
    processHtmlFile(file, html) {
        // Extract metadata from HTML meta tags
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Make sure we have a name - extract from path if needed
        let name = file.name;
        if (!name && file.path) {
            // Extract filename from path
            const pathParts = file.path.split('/');
            name = pathParts[pathParts.length - 1];
            console.log(`Extracted name from path: ${name}`);
        }
        
        // Get the slug - use explicit blog-slug meta tag if available, otherwise derive from filename
        const metaSlug = this.getMetaContent(doc, 'blog-slug');
        const slug = metaSlug || (name ? name.replace(/\.html$/, '') : '');
        
        
        // Create a blog post object
        return {
            id: file.id || file.sha || `file-${Date.now()}`,
            name: name,  // Ensure name is included
            title: this.getMetaContent(doc, 'blog-title') || (name ? name.replace(/\.html$/, '').replace(/-/g, ' ') : 'Untitled'),
            date: this.getMetaContent(doc, 'blog-date') || file.date || new Date().toLocaleDateString(),
            author: this.getMetaContent(doc, 'blog-author') || 'Anonymous',
            category: this.getMetaContent(doc, 'blog-category') || 'Uncategorized',
            excerpt: this.getMetaContent(doc, 'blog-excerpt') || this.generateExcerpt(doc),
            image: this.getMetaContent(doc, 'blog-image') || 'images/blog-placeholder.jpg',
            tags: this.getMetaContent(doc, 'blog-tags') ? this.getMetaContent(doc, 'blog-tags').split(',').map(tag => tag.trim()) : [],
            slug: slug,
            path: file.path,
            content: doc.querySelector('article') ? doc.querySelector('article').innerHTML : html
        };
    }

    /**
     * Process a Markdown blog file
     * @param {Object} file - The file info object
     * @param {string} markdown - The Markdown content
     * @returns {Object} Blog post object
     */
    processMarkdownFile(file, markdown) {
        // Extract YAML frontmatter
        const frontmatter = this.extractFrontmatter(markdown);
        const content = this.removeYamlFrontmatter(markdown);
        
        // Convert markdown to HTML
        const htmlContent = `<div class="markdown-content">${this.simpleMarkdownToHtml(content)}</div>`;
        
        // Make sure we have a name - extract from path if needed
        let name = file.name;
        if (!name && file.path) {
            // Extract filename from path
            const pathParts = file.path.split('/');
            name = pathParts[pathParts.length - 1];
            console.log(`Extracted name from path: ${name}`);
        }
        
        return {
            id: file.id || file.sha || `file-${Date.now()}`,
            name: name,  // Ensure name is included
            title: frontmatter['blog-title'] || (name ? name.replace(/\.md$/, '').replace(/-/g, ' ') : 'Untitled'),
            date: frontmatter['blog-date'] || file.date || new Date().toLocaleDateString(),
            author: frontmatter['blog-author'] || 'Anonymous',
            category: frontmatter['blog-category'] || 'Uncategorized',
            excerpt: frontmatter['blog-excerpt'] || this.generateExcerptFromMarkdown(content),
            image: frontmatter['blog-image'] || 'images/blog-placeholder.jpg',
            tags: frontmatter['blog-tags'] ? frontmatter['blog-tags'].split(',').map(tag => tag.trim()) : [],
            slug: frontmatter['blog-slug'] || (name ? name.replace(/\.md$/, '') : ''),
            path: file.path,
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

    /**
     * Generate an excerpt from markdown content - added as fallback for compatibility
     * @param {string} markdown - The markdown content
     * @returns {string} Generated excerpt
     */
    generateExtractFromMarkdown(markdown) {
        console.log('Using fallback generateExtractFromMarkdown method');
        return this.generateExcerptFromMarkdown(markdown);
    }
}

/**
 * Local Blog Loader
 * This class loads blog posts directly from local directory for GitHub Pages.
 * Since the blog is hosted on GitHub Pages, the blog posts are already available
 * locally and we don't need to use the GitHub API to fetch them.
 */
class LocalBlogLoader {
    constructor(path) {
        this.path = path || 'blogs';
        this.indexFile = `${this.path}/index.json`;
    }

    /**
     * Fetch blog posts from local directory or GitHub Pages index.json
     * @returns {Promise<Array>} Array of blog posts
     */
    async fetchPosts() {
        try {
            // Determine if we're on GitHub Pages
            const isGitHubPages = window.location.hostname.includes('github.io');
            let indexUrl;

            if (isGitHubPages) {
                // On GitHub Pages, try a few different URL patterns
                const ghUsername = 'gourikartha';
                const ghRepo = 'gourikartha.github.io';
                
                // First try without /main/ since GitHub Pages serves from the root
                indexUrl = `https://${ghUsername}.github.io/${this.path}/index.json`;
                console.log(`Trying GitHub Pages URL: ${indexUrl}`);
            } else {
                // Local development
                indexUrl = new URL(`${this.path}/index.json`, window.location.origin).href;
                console.log(`Trying local URL: ${indexUrl}`);
            }

            console.log(`Fetching index from: ${indexUrl}`);
            let response = await fetch(indexUrl);
            
            // If first GitHub Pages URL fails, try raw.githubusercontent.com
            if (!response.ok && isGitHubPages) {
                const ghUsername = 'gourikartha';
                const ghRepo = 'gourikartha.github.io';
                const rawUrl = `https://raw.githubusercontent.com/${ghUsername}/${ghRepo}/main/${this.path}/index.json`;
                console.log(`First attempt failed, trying raw URL: ${rawUrl}`);
                response = await fetch(rawUrl);
            }
            
            if (!response.ok) {
                console.error(`Failed to fetch ${this.path} index: ${response.status} ${response.statusText}`);
                console.error(`URL attempted: ${indexUrl}`);
                throw new Error(`Failed to fetch ${this.path} index: ${response.status} ${response.statusText}`);
            }
            
            // Get the response text first for debugging
            const responseText = await response.text();
            console.log(`Response from ${indexUrl}:`, responseText);
            
            // Parse the JSON
            let data;
            try {
                data = JSON.parse(responseText);
                
                // Check the format - handle both array and object with "posts" property
                if (!Array.isArray(data) && data && typeof data === 'object' && Array.isArray(data.posts)) {
                    console.log('Found posts property in JSON, using that array');
                    data = data.posts;
                }
                
            } catch (parseError) {
                console.error(`Error parsing JSON from ${indexUrl}:`, parseError);
                console.error('Response text:', responseText);
                throw new Error(`Invalid JSON in ${this.path}/index.json: ${parseError.message}`);
            }
            
            // Check if the data is in the expected format (array of post metadata)
            if (!Array.isArray(data)) {
                console.error(`Invalid index.json format from ${indexUrl}: expected an array or object with posts array, got:`, data);
                throw new Error(`Invalid index.json format: expected an array of posts, got ${typeof data}`);
            }
            
            // Log the data for debugging
            console.log(`Successfully loaded ${data.length} entries from ${indexUrl}:`, data);
            
            // Process each blog post in parallel
            const posts = await Promise.all(
                data.map(post => this.processBlogFile(post))
            );
            
            // Sort posts by date (newest first)
            return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            console.error(`Error fetching ${this.path} posts:`, error);
            // Return empty array instead of throwing to prevent page break
            return [];
        }
    }

    /**
     * Process a blog file to extract metadata and content
     * @param {Object} file - The file info object
     * @returns {Promise<Object>} Blog post object with metadata and content
     */
    async processBlogFile(file) {
        try {
            // Handle both relative and absolute paths
            let filePath = file.path;
            let fullUrl;
            
            // Create GitHub Pages URL
            if (window.location.hostname.includes('github.io')) {
                // Direct fetch from GitHub raw content
                const ghUsername = 'gourikartha';
                const ghRepo = 'gourikartha.github.io';
                
                // Remove leading slash if present
                if (filePath.startsWith('/')) {
                    filePath = filePath.substring(1);
                }
                
                // Use raw.githubusercontent.com for direct content access
                fullUrl = `https://raw.githubusercontent.com/${ghUsername}/${ghRepo}/main/${filePath}`;
                console.log(`Trying to fetch from GitHub raw content: ${fullUrl}`);
            } else {
                // Local development
                if (filePath.startsWith('/')) {
                    filePath = filePath.substring(1);
                }
                fullUrl = new URL(filePath, window.location.origin).href;
                console.log(`Trying to fetch locally: ${fullUrl}`);
            }
            
            const response = await fetch(fullUrl);
            
            if (!response.ok) {
                console.error(`Failed to fetch file ${fullUrl}: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }
            
            const content = await response.text();
            const isMarkdown = file.name.endsWith('.md');
            
            // Generate a unique ID for the post
            const id = `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            // Use the date information provided in the index.json file if available
            let postDate = file.date || new Date().toLocaleDateString();
            
            try {
                if (isMarkdown) {
                    return this.processMarkdownFile({ ...file, id, date: postDate, path: fullUrl }, content);
                } else {
                    return this.processHtmlFile({ ...file, id, date: postDate, path: fullUrl }, content);
                }
            } catch (processingError) {
                console.error(`Error processing content for ${file.name || 'unknown file'}:`, processingError);
                
                // Extract name from path if needed
                let name = file.name;
                if (!name && file.path) {
                    // Extract filename from path
                    const pathParts = file.path.split('/');
                    name = pathParts[pathParts.length - 1];
                    console.log(`Extracted name from path for error fallback: ${name}`);
                }
                
                // Create a minimal blog post from the available data
                return {
                    id: id,
                    name: name || 'unknown-file',
                    title: file.title || (name ? name.replace(/\.(html|md)$/, '').replace(/-/g, ' ') : 'Untitled'),
                    date: postDate,
                    author: file.author || 'Unknown Author',
                    category: 'Uncategorized',
                    excerpt: 'Blog post excerpt...',
                    image: 'images/blog-placeholder.jpg',
                    tags: [],
                    slug: file.slug || (name ? name.replace(/\.(html|md)$/, '') : `post-${id}`),
                    path: fullUrl,
                    content: `<h2>${file.title || (name || 'Unknown Post')}</h2><p>Content could not be fully loaded.</p>`
                };
            }
            
        } catch (error) {
            console.error(`Error processing blog file ${file.name}:`, error);
            throw error;
        }
    }

    /**
     * Process an HTML blog file
     * @param {Object} file - The file info object
     * @param {string} html - The HTML content
     * @returns {Object} Blog post object
     */
    processHtmlFile(file, html) {
        // Extract metadata from HTML meta tags
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Make sure we have a name - extract from path if needed
        let name = file.name;
        if (!name && file.path) {
            // Extract filename from path
            const pathParts = file.path.split('/');
            name = pathParts[pathParts.length - 1];
            console.log(`Extracted name from path: ${name}`);
        }
        
        // Get the slug - use explicit blog-slug meta tag if available, otherwise derive from filename
        const metaSlug = this.getMetaContent(doc, 'blog-slug');
        const slug = metaSlug || (name ? name.replace(/\.html$/, '') : '');
        
        
        // Create a blog post object
        return {
            id: file.id || file.sha || `file-${Date.now()}`,
            name: name,  // Ensure name is included
            title: this.getMetaContent(doc, 'blog-title') || (name ? name.replace(/\.html$/, '').replace(/-/g, ' ') : 'Untitled'),
            date: this.getMetaContent(doc, 'blog-date') || file.date || new Date().toLocaleDateString(),
            author: this.getMetaContent(doc, 'blog-author') || 'Anonymous',
            category: this.getMetaContent(doc, 'blog-category') || 'Uncategorized',
            excerpt: this.getMetaContent(doc, 'blog-excerpt') || this.generateExcerpt(doc),
            image: this.getMetaContent(doc, 'blog-image') || 'images/blog-placeholder.jpg',
            tags: this.getMetaContent(doc, 'blog-tags') ? this.getMetaContent(doc, 'blog-tags').split(',').map(tag => tag.trim()) : [],
            slug: slug,
            path: file.path,
            content: doc.querySelector('article') ? doc.querySelector('article').innerHTML : html
        };
    }

    /**
     * Process a Markdown blog file
     * @param {Object} file - The file info object
     * @param {string} markdown - The Markdown content
     * @returns {Object} Blog post object
     */
    processMarkdownFile(file, markdown) {
        // Extract YAML frontmatter
        const frontmatter = this.extractFrontmatter(markdown);
        const content = this.removeYamlFrontmatter(markdown);
        
        // Convert markdown to HTML
        const htmlContent = `<div class="markdown-content">${this.simpleMarkdownToHtml(content)}</div>`;
        
        // Make sure we have a name - extract from path if needed
        let name = file.name;
        if (!name && file.path) {
            // Extract filename from path
            const pathParts = file.path.split('/');
            name = pathParts[pathParts.length - 1];
            console.log(`Extracted name from path: ${name}`);
        }
        
        return {
            id: file.id || file.sha || `file-${Date.now()}`,
            name: name,  // Ensure name is included
            title: frontmatter['blog-title'] || (name ? name.replace(/\.md$/, '').replace(/-/g, ' ') : 'Untitled'),
            date: frontmatter['blog-date'] || file.date || new Date().toLocaleDateString(),
            author: frontmatter['blog-author'] || 'Anonymous',
            category: frontmatter['blog-category'] || 'Uncategorized',
            excerpt: frontmatter['blog-excerpt'] || this.generateExcerptFromMarkdown(content),
            image: frontmatter['blog-image'] || 'images/blog-placeholder.jpg',
            tags: frontmatter['blog-tags'] ? frontmatter['blog-tags'].split(',').map(tag => tag.trim()) : [],
            slug: frontmatter['blog-slug'] || (name ? name.replace(/\.md$/, '') : ''),
            path: file.path,
            content: htmlContent
        };
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
     * Simple markdown to HTML converter
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
     * Backward compatibility method for fetchBlogPosts
     * @returns {Promise<Array>} Array of blog posts
     */
    async fetchBlogPosts() {
        console.warn('fetchBlogPosts is deprecated, use fetchPosts instead');
        return this.fetchPosts();
    }

    /**
     * Generate an excerpt from markdown content - added as fallback for compatibility
     * @param {string} markdown - The markdown content
     * @returns {string} Generated excerpt
     */
    generateExtractFromMarkdown(markdown) {
        console.log('Using fallback generateExtractFromMarkdown method in LocalBlogLoader');
        return this.generateExcerptFromMarkdown(markdown);
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
}

// Export both loaders
window.GitHubBlogLoader = GitHubBlogLoader;
window.LocalBlogLoader = LocalBlogLoader;
