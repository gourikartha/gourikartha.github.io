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
                        if (data && data.posts) {
                            debugLog.innerHTML = `Index file loaded successfully. Contains ${data.posts.length} posts.`;
                            const slugs = data.posts.map(p => p.name.replace(/\.(html|md)$/, '')).join(', ');
                            
                            const slugsList = document.createElement('div');
                            slugsList.className = 'debug-log';
                            slugsList.innerHTML = `Available slugs: ${slugs}`;
                            debugSection.appendChild(slugsList);
                        } else {
                            debugLog.innerHTML = 'Index file found but has no posts data';
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
        
        // Show loading state
        poemContent.innerHTML = '<p class="loading">Loading poem content...</p>';
        
        // Get all poem posts
        const posts = await fetchPoemPosts();
        console.log('Fetched all poem posts:', posts.length);
        
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
        const posts = await poemLoader.fetchBlogPosts();
        
        // For each post, make sure it has a slug
        posts.forEach(post => {
            if (!post.slug) {
                post.slug = post.name ? post.name.replace(/\.(html|md)$/, '') : '';
            }
        });
        
        return posts;
    } catch (error) {
        console.error('Error fetching poem posts:', error);
        throw error;
    }
}

// Fetch the content of the poem post
async function fetchPoemContent(post) {
    try {
        // Handle both relative and absolute paths
        let filePath = post.path;
        
        // If the path is absolute (starts with /), make it relative to the current domain
        if (filePath.startsWith('/')) {
            filePath = filePath.substring(1); // Remove the leading slash
        }
        
        // For GitHub Pages compatibility, get the full URL
        const fullUrl = new URL(filePath, window.location.origin).href;
        console.log(`Trying to fetch poem: ${fullUrl}`);
        
        // Try to fetch the actual content
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        
        const content = await response.text();
        
        // Check if it's a Markdown file
        if (post.name.endsWith('.md')) {
            // For Markdown files, extract frontmatter and convert to HTML
            const cleanContent = content.replace(/^---\n([\s\S]*?)\n---\n/, ''); // Remove frontmatter
            return convertMarkdownToHtml(cleanContent);
        }
        
        // For HTML files, try to extract the content
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        // Try to extract the article content
        const articleContent = doc.querySelector('article');
        if (articleContent) {
            return articleContent.innerHTML;
        }
        
        // If no article tag is found, try to extract the body content
        const bodyContent = doc.querySelector('body');
        if (bodyContent) {
            // Check if the body has any direct children elements like article, div, etc.
            if (bodyContent.children.length > 0) {
                let innerHTML = '';
                Array.from(bodyContent.children).forEach(child => {
                    if (child.tagName.toLowerCase() !== 'script') {
                        innerHTML += child.outerHTML;
                    }
                });
                return innerHTML;
            }
            return bodyContent.innerHTML;
        }
        
        // If all else fails, return the entire content
        return content;
    } catch (error) {
        console.error('Error fetching poem content:', error);
        throw error;
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
