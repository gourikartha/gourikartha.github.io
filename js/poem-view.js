// DOM Elements for poem post page
const poemTitle = document.getElementById('poem-title');
const poemDate = document.getElementById('poem-date');
const poemAuthor = document.getElementById('poem-author');
const poemImage = document.getElementById('poem-image');
const poemContent = document.getElementById('poem-content');
const prevPost = document.getElementById('prev-post');
const nextPost = document.getElementById('next-post');

// Create a poem loader instance
const poemLoader = new LocalBlogLoader('poems');

// Initialize the poem post page
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on a poem post page
    if (poemTitle && poemContent) {
        loadPoemPost();
    }
});

// Add debug function to help troubleshoot issues
function addDebugInfo(container) {
    // Create debug section
    const debugSection = document.createElement('div');
    debugSection.className = 'debug-section';
    debugSection.innerHTML = `
        <h3>Debugging Information</h3>
        <div class="debug-log">Current URL: ${window.location.href}</div>
        <div class="debug-log">Requested slug: ${getUrlParameter('slug')}</div>
        <div class="debug-log">Poems path: ${poemLoader.path}</div>
        <div class="debug-log">Available blog loaders: ${window.LocalBlogLoader ? 'LocalBlogLoader' : 'None'}, 
            ${window.GitHubBlogLoader ? 'GitHubBlogLoader' : 'None'}</div>
        <div class="debug-log">Index file: ${poemLoader.indexFile}</div>
    `;
    
    container.appendChild(debugSection);
    
    // Try to check actual poem files
    try {
        fetch(poemLoader.indexFile)
            .then(response => {
                const debugLog = document.createElement('div');
                debugLog.className = 'debug-log';
                
                if (response.ok) {
                    response.json().then(data => {
                        if (Array.isArray(data)) {
                            debugLog.innerHTML = `Index file loaded successfully. Contains ${data.length} posts.`;
                            const slugs = data.map(p => p.slug || p.name?.replace(/\.(html|md)$/, '')).join(', ');
                            
                            const slugsList = document.createElement('div');
                            slugsList.className = 'debug-log';
                            slugsList.innerHTML = `Available slugs: ${slugs}`;
                            debugSection.appendChild(slugsList);
                        } else {
                            debugLog.innerHTML = 'Index file found but data is not in expected array format';
                            debugLog.classList.add('error-log');
                        }
                    }).catch(err => {
                        debugLog.innerHTML = `Error parsing index file: ${err.message}`;
                        debugLog.classList.add('error-log');
                    });
                } else {
                    debugLog.innerHTML = `Index file not found (${response.status} ${response.statusText})`;
                    debugLog.classList.add('error-log');
                }
                
                debugSection.appendChild(debugLog);
            })
            .catch(err => {
                const debugLog = document.createElement('div');
                debugLog.className = 'debug-log error-log';
                debugLog.innerHTML = `Error checking index file: ${err.message}`;
                debugSection.appendChild(debugLog);
            });
    } catch (e) {
        console.error('Error in debug section:', e);
    }
}

// Load the poem post content
async function loadPoemPost() {
    try {
        // Get the slug from URL parameter
        const slug = getUrlParameter('slug');
        
        if (!slug) {
            console.warn('No slug parameter found in URL, redirecting to poems listing');
            window.location.href = 'poems.html';
            return;
        }
        
        console.log('Looking for poem with slug:', slug);
        
        // Show loading state
        poemContent.innerHTML = '<p class="loading">Loading poem content...</p>';
        
        // Get all poem posts
        const posts = await fetchPoemPosts();
        console.log('Fetched all poem posts:', posts.length);
        
        // Debug - log all available posts and their slugs
        posts.forEach(post => {
            console.log(`Available post: ${post.title}, Slug: ${post.slug || 'undefined'}, File: ${post.name}`);
            
            // Check for blog-slug property as a fallback
            if (!post.slug && post['blog-slug']) {
                console.log(`Found blog-slug property: ${post['blog-slug']}`);
                post.slug = post['blog-slug'];
            }
        });
        
        // Find the current post by slug
        const currentPost = posts.find(post => post.slug === slug);
        
        if (!currentPost) {
            console.error('Poem post not found for slug:', slug);
            poemContent.innerHTML = `
                <div class="error">
                    <h3>Poem Not Found</h3>
                    <p>The requested poem could not be found.</p>
                    <div class="hint">Check the URL and try again.</div>
                </div>
            `;
            
            // Add debug info to help troubleshoot
            addDebugInfo(poemContent);
            return;
        }
        
        console.log('Found poem post:', currentPost);
        
        // Update page title
        document.title = `${currentPost.title} - Gouri Kartha`;
        
        // Populate poem post data
        poemTitle.textContent = currentPost.title;
        poemDate.textContent = currentPost.date;
        poemAuthor.textContent = currentPost.author;
        
        // Set featured image - remove alt text as requested
        if (currentPost.image) {
            poemImage.src = currentPost.image;
            poemImage.alt = ""; // Removing alt text as requested
            poemImage.style.display = 'block';
            poemImage.classList.add('featured-image'); // Add same class as blog images
        } else {
            // Hide image if no image available
            poemImage.style.display = 'none';
        }
        
        // Display the poem content
        if (currentPost.content) {
            poemContent.innerHTML = currentPost.content;
        } else {
            // Try to fetch the content directly from the file
            try {
                const content = await fetchPoemContent(currentPost);
                if (content) {
                    poemContent.innerHTML = content;
                } else {
                    poemContent.innerHTML = '<p>Failed to load poem content. Please try again later.</p>';
                }
            } catch (error) {
                console.error('Error loading poem content:', error);
                poemContent.innerHTML = `
                    <div class="error">
                        <h3>Unable to Load Content</h3>
                        <p class="hint">There was an error loading the poem content: ${error.message}</p>
                    </div>
                `;
            }
        }
        
        // Set up navigation to previous and next posts
        setupPostNavigation(posts, currentPost);
        
    } catch (error) {
        console.error('Error loading poem post:', error);
        poemContent.innerHTML = `
            <div class="error">
                <h3>Failed to Load Poem</h3>
                <p class="hint">${error.message || 'Please try again later.'}</p>
            </div>
        `;
        
        // Add debug info to help troubleshoot
        addDebugInfo(poemContent);
    }
}

// Fetch poem posts using the LocalBlogLoader
async function fetchPoemPosts() {
    try {
        // Use the poem loader to fetch posts
        let posts = await poemLoader.fetchPosts();
        
        console.log('Raw posts fetched:', posts.length);
        
        // Check if posts might be in a different format (inside a posts property)
        if (posts.length === 0) {
            // Try fetching the raw index.json directly and handle different formats
            const isGitHubPages = window.location.hostname.includes('github.io');
            const indexUrl = isGitHubPages ? 
                `https://${location.host}/${poemLoader.path}/index.json` : 
                `${poemLoader.path}/index.json`;
            
            console.log(`Trying direct fetch from: ${indexUrl}`);
            
            try {
                const response = await fetch(indexUrl);
                if (response.ok) {
                    const data = await response.json();
                    if (data && typeof data === 'object' && Array.isArray(data.posts)) {
                        console.log('Found posts property in direct fetch, using that array');
                        posts = data.posts;
                    }
                }
            } catch (err) {
                console.warn('Error in direct fetch attempt:', err);
            }
        }
        
        // For each post, make sure it has a slug
        posts.forEach(post => {
            if (!post.slug) {
                // Try to get slug from blog-slug first
                if (post['blog-slug']) {
                    post.slug = post['blog-slug'];
                    console.log(`Using blog-slug for post: ${post.title}, slug: ${post.slug}`);
                } else {
                    // Fallback to filename
                    post.slug = post.name ? post.name.replace(/\.(html|md)$/, '') : '';
                    console.log(`Using filename as slug: ${post.slug}`);
                }
            }
        });
        
        return posts;
    } catch (error) {
        console.error('Error fetching poem posts:', error);
        throw error;
    }
}

/**
 * Fetch and display a poem's content
 * @param {Object} post - Poem metadata
 * @returns {Promise<string>} HTML content of the poem
 */
async function fetchPoemContent(post) {
    try {
        // Handle both relative and absolute paths
        let filePath = post.path;
        let fullUrl;
        
        // Create GitHub Pages URL
        if (window.location.hostname.includes('github.io')) {
            // Direct fetch from GitHub raw content
            const ghUsername = 'gourikartha';
            const ghRepo = 'gourikartha.github.io';
            
            // Fix path handling for GitHub Pages
            if (filePath.startsWith('./')) {
                // Remove the leading ./ which causes issues with raw.githubusercontent.com
                filePath = filePath.substring(2);
            } else if (filePath.startsWith('/')) {
                filePath = filePath.substring(1);
            }
            
            // Log the final path for debugging
            console.log(`Final path for GitHub fetch: ${filePath}`);
            
            // Use raw.githubusercontent.com for direct content access
            fullUrl = `https://raw.githubusercontent.com/${ghUsername}/${ghRepo}/main/${filePath}`;
            console.log(`Trying to fetch poem from GitHub raw content: ${fullUrl}`);
            
            // Fallback URL in case the main branch name is different
            const fallbackUrl = `https://${ghUsername}.github.io/${filePath}`;
            console.log(`Fallback URL if needed: ${fallbackUrl}`);
        } else {
            // Local development
            if (filePath.startsWith('/')) {
                filePath = filePath.substring(1);
            } else if (filePath.startsWith('./')) {
                filePath = filePath.substring(2);
            }
            fullUrl = new URL(filePath, window.location.origin).href;
            console.log(`Trying to fetch poem locally: ${fullUrl}`);
        }
        
        console.log('Fetching poem from path:', filePath);
        console.log('Full URL constructed:', fullUrl);
        
        let response = await fetch(fullUrl);
        
        // If the first URL fails and we're on GitHub Pages, try the fallback
        if (!response.ok && window.location.hostname.includes('github.io')) {
            const ghUsername = 'gourikartha';
            const fallbackUrl = `https://${ghUsername}.github.io/${filePath}`;
            console.log(`First attempt failed, trying fallback URL: ${fallbackUrl}`);
            response = await fetch(fallbackUrl);
        }
        
        if (!response.ok) {
            console.error(`Failed to fetch poem ${fullUrl}: ${response.status} ${response.statusText}`);
            throw new Error(`Failed to fetch poem: ${response.status} ${response.statusText}`);
        }
        
        const content = await response.text();
        console.log('Poem content length:', content.length);
        
        // Process Markdown files
        if (post.path.endsWith('.md')) {
            // Remove frontmatter and convert to HTML
            const cleanContent = content.replace(/---[\s\S]*?---/, '').trim();
            
            if (!window.marked) {
                console.error('Marked library not loaded');
                return `<div class="error">Markdown parser not loaded. Please add <code>marked.js</code> to your page.</div>`;
            }
            
            const html = marked.parse(cleanContent);
            
            // Wrap the poem in the appropriate container
            return `<div class="poem-markdown-content">${html}</div>`;
        }
        
        // Process HTML files (if any)
        let htmlContent = content;
        
        // Extract content from article tag if available
        const articleMatch = htmlContent.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        if (articleMatch && articleMatch[1]) {
            htmlContent = articleMatch[1];
        } else {
            // Extract content from body tag if available
            const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (bodyMatch && bodyMatch[1]) {
                // Filter out any script tags
                htmlContent = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '');
            }
        }
        
        return htmlContent;
    } catch (error) {
        console.error('Error fetching poem content:', error);
        console.error('Error stack:', error.stack);
        return `<div class="error-message">
                    <h3>Error Loading Poem</h3>
                    <p>Could not load the poem content. Please try again later.</p>
                    <p class="error-details">${error.message || 'Unknown error'}</p>
                </div>`;
    }
}

// Simple Markdown to HTML converter
function convertMarkdownToHtml(markdown) {
    // First, strip out the frontmatter if present
    const content = markdown.replace(/^---\n([\s\S]*?)\n---\n/, '').trim();
    
    // Instead of using stanza-based formatting, preserve exact spacing
    // by treating the entire poem as a single block
    const poemText = content
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Handle single newline by adding <br> tags
        .replace(/\n/g, '<br>')
        // Bold formatting
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Italic formatting
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Wrap the entire poem in a div with proper styling
    return `<div class="poem-markdown-content"><p class="poem-exact">${poemText}</p></div>`;
}

// Set up navigation to previous and next posts
function setupPostNavigation(posts, currentPost) {
    // Find the index of the current post
    const currentIndex = posts.findIndex(post => post.slug === currentPost.slug);
    
    // If there's a previous post
    if (currentIndex > 0) {
        const previous = posts[currentIndex - 1];
        prevPost.innerHTML = `<a href="poem.html?slug=${previous.slug}"><i class="fas fa-arrow-left"></i> ${previous.title}</a>`;
        prevPost.style.display = 'block';
    } else {
        prevPost.style.display = 'none';
    }
    
    // If there's a next post
    if (currentIndex < posts.length - 1) {
        const next = posts[currentIndex + 1];
        nextPost.innerHTML = `<a href="poem.html?slug=${next.slug}">${next.title} <i class="fas fa-arrow-right"></i></a>`;
        nextPost.style.display = 'block';
    } else {
        nextPost.style.display = 'none';
    }
}

// Get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
} 
