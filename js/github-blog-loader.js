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
     * @param {Object} file - The file info object
     * @returns {Promise<Object>} Blog post object with metadata and content
     */
    async processBlogFile(file) {
        try {
            const response = await fetch(file.path);
            
            if (!response.ok) {
                console.error(`Failed to fetch file ${file.path}: ${response.status} ${response.statusText}`);
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
                    return this.processMarkdownFile({ ...file, id, date: postDate }, content);
                } else {
                    return this.processHtmlFile({ ...file, id, date: postDate }, content);
                }
            } catch (processingError) {
                console.error(`Error processing content for ${file.name}:`, processingError);
                
                // Create a minimal blog post from the available data
                return {
                    id: id,
                    title: file.title || file.name.replace(/\.(html|md)$/, '').replace(/-/g, ' '),
                    date: postDate,
                    author: file.author || 'Unknown Author',
                    category: 'Uncategorized',
                    excerpt: 'Blog post excerpt...',
                    image: 'images/blog-placeholder.jpg',
                    tags: [],
                    slug: file.name.replace(/\.(html|md)$/, ''),
                    path: file.path,
                    content: `<h2>${file.title || file.name}</h2><p>Content could not be fully loaded.</p>`
                };
            }
        } catch (error) {
            console.error(`Error processing blog file ${file.name}:`, error);
            throw error;
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
        
        // Get the slug - use explicit blog-slug meta tag if available, otherwise derive from filename
        const metaSlug = this.getMetaContent(doc, 'blog-slug');
        const slug = metaSlug || file.name.replace(/\.html$/, '');
        
        
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
            slug: slug,
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
        
        // Convert markdown to HTML
        const htmlContent = `<div class="markdown-content">${this.simpleMarkdownToHtml(content)}</div>`;
        
        const result = {
            id: file.sha,
            title: frontmatter['blog-title'] || file.name.replace(/\.md$/, '').replace(/-/g, ' '),
            date: frontmatter['blog-date'] || new Date().toLocaleDateString(),
            author: frontmatter['blog-author'] || 'Anonymous',
            category: frontmatter['blog-category'] || 'Uncategorized',
            excerpt: frontmatter['blog-excerpt'] || this.generateExcerptFromMarkdown(content),
            image: frontmatter['blog-image'] || 'images/blog-placeholder.jpg',
            tags: frontmatter['blog-tags'] ? frontmatter['blog-tags'].split(',').map(tag => tag.trim()) : [],
            slug: frontmatter['blog-slug'] || file.name.replace(/\.md$/, ''),
            path: file.path,
            url: file.download_url,
            content: htmlContent
        };
        
        return result;
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
     * Fetch all blog posts from the local blogs directory
     * @returns {Promise<Array>} Array of blog post objects
     */
    async fetchBlogPosts() {
        try {
            
            // First try to load the index file which should list all blog posts
            try {
                const indexResponse = await fetch(this.indexFile);
                if (!indexResponse.ok) {
                    console.error(`Failed to load blog index file: ${indexResponse.status} ${indexResponse.statusText}`);
                    throw new Error(`Index file not found: ${this.indexFile}`);
                }
                
                // Parse the index file to get the list of blog posts
                const blogIndex = await indexResponse.json();
                
                if (!blogIndex.posts || !Array.isArray(blogIndex.posts) || blogIndex.posts.length === 0) {
                    console.warn('Blog index file contains no posts or is malformed');
                    throw new Error('Blog index file contains no posts');
                }
                
                
                // Ensure file extensions are captured correctly
                blogIndex.posts.forEach(post => {
                    // Make sure we can detect if it's a markdown file
                    post.isMarkdown = post.name.endsWith('.md');
                });
                
                // Process each blog file
                const blogPosts = await Promise.all(
                    blogIndex.posts.map(async (file) => {
                        try {
                            return await this.processBlogFile(file);
                        } catch (error) {
                            console.warn(`Skipping file ${file.name} - not found or error:`, error);
                            return null;
                        }
                    })
                );
                
                // Filter out any null entries (files that weren't found) and sort by date
                const posts = blogPosts
                    .filter(post => post !== null)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
                
                console.log(`Successfully processed ${posts.length} posts`);
                posts.forEach(post => {
                    console.log(`- ${post.title} (${post.date}) - Path: ${post.path}`);
                });
                
                if (posts.length > 0) {
                    return posts;
                }
                
                console.warn('No valid posts could be loaded from index file');
            } catch (indexError) {
                console.warn('Error with index file, trying hardcoded posts:', indexError);
            }
            
            // If we get here, either the index file failed or no posts were loaded
            // Fall back to loading sample posts
            return this.createSamplePosts();
            
        } catch (error) {
            console.error('Error fetching blog posts from local directory:', error);
            return this.createSamplePosts();
        }
    }
    
    /**
     * Create sample blog posts as a fallback when loading fails
     * @returns {Array} Array of sample blog post objects
     */
    createSamplePosts() {
        return [
            {
                id: 'sample-post-1',
                title: 'Sample Blog Post',
                date: new Date().toLocaleDateString(),
                author: 'Demo Author',
                category: 'Samples',
                excerpt: 'This is a sample blog post that appears when actual posts cannot be loaded.',
                image: 'images/blog-placeholder.jpg',
                tags: ['sample', 'demo'],
                slug: 'sample-blog-post',
                path: '#',
                content: `
                    <h2>Sample Blog Post</h2>
                    <p>This is a sample blog post that appears when actual blog posts cannot be loaded from your server.</p>
                    <p>Possible reasons your blog posts aren't loading:</p>
                    <ul>
                        <li>The blog posts files don't exist in the expected location</li>
                        <li>There's a path issue in how files are being referenced</li>
                        <li>The server is blocking access to the files</li>
                        <li>There might be CORS issues if testing locally</li>
                    </ul>
                    <p>Check the browser console for more specific error messages.</p>
                `
            },
            {
                id: 'sample-post-2',
                title: 'Getting Started With Blogging',
                date: new Date(Date.now() - 86400000).toLocaleDateString(),
                author: 'Demo Author',
                category: 'Tutorials',
                excerpt: 'Learn how to set up your blog and create your first posts.',
                image: 'images/blog-placeholder.jpg',
                tags: ['tutorial', 'blogging'],
                slug: 'getting-started',
                path: '#',
                content: `
                    <h2>Getting Started With Blogging</h2>
                    <p>This is another sample blog post that appears when actual posts cannot be loaded.</p>
                    <p>To fix the blog loading issue:</p>
                    <ol>
                        <li>Make sure your blog post files exist in the 'blogs' directory</li>
                        <li>Verify the index.json file exists and contains the correct paths</li>
                        <li>Check the browser console for specific error messages</li>
                        <li>Try using absolute paths instead of relative paths</li>
                    </ol>
                    <p>Once fixed, your actual blog posts will appear instead of these samples.</p>
                `
            }
        ];
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
            
            // If the path is absolute (starts with /), make it relative to the current domain
            if (filePath.startsWith('/')) {
                filePath = filePath.substring(1); // Remove the leading slash
            }
            
            // For GitHub Pages compatibility, get the full URL
            const fullUrl = new URL(filePath, window.location.origin).href;
            console.log(`Trying to fetch: ${fullUrl}`);
            
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
                console.error(`Error processing content for ${file.name}:`, processingError);
                
                // Create a minimal blog post from the available data
                return {
                    id: id,
                    title: file.title || file.name.replace(/\.(html|md)$/, '').replace(/-/g, ' '),
                    date: postDate,
                    author: file.author || 'Unknown Author',
                    category: 'Uncategorized',
                    excerpt: 'Blog post excerpt...',
                    image: 'images/blog-placeholder.jpg',
                    tags: [],
                    slug: file.name.replace(/\.(html|md)$/, ''),
                    path: fullUrl,
                    content: `<h2>${file.title || file.name}</h2><p>Content could not be fully loaded.</p>`
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
        
        // Get the slug - use explicit blog-slug meta tag if available, otherwise derive from filename
        const metaSlug = this.getMetaContent(doc, 'blog-slug');
        const slug = metaSlug || file.name.replace(/\.html$/, '');
        
        
        // Create a blog post object
        return {
            id: file.id,
            title: this.getMetaContent(doc, 'blog-title') || file.name.replace(/\.html$/, '').replace(/-/g, ' '),
            date: this.getMetaContent(doc, 'blog-date') || new Date().toLocaleDateString(),
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
        
        return {
            id: file.id,
            title: frontmatter['blog-title'] || file.name.replace(/\.md$/, '').replace(/-/g, ' '),
            date: frontmatter['blog-date'] || new Date().toLocaleDateString(),
            author: frontmatter['blog-author'] || 'Anonymous',
            category: frontmatter['blog-category'] || 'Uncategorized',
            excerpt: frontmatter['blog-excerpt'] || this.generateExcerptFromMarkdown(content),
            image: frontmatter['blog-image'] || 'images/blog-placeholder.jpg',
            tags: frontmatter['blog-tags'] ? frontmatter['blog-tags'].split(',').map(tag => tag.trim()) : [],
            slug: file.name.replace(/\.md$/, ''),
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
}

// Export both loaders
window.GitHubBlogLoader = GitHubBlogLoader;
window.LocalBlogLoader = LocalBlogLoader;
