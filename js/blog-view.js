// DOM Elements for blog post page
const blogTitle = document.getElementById('blog-title');
const blogDate = document.getElementById('blog-date');
const blogAuthor = document.getElementById('blog-author');
// blogCategory element removed as it's no longer displayed
const blogImage = document.getElementById('blog-image');
const blogContent = document.getElementById('blog-content');
const prevPost = document.getElementById('prev-post');
const nextPost = document.getElementById('next-post');

// Create a blog loader instance
const blogLoader = new LocalBlogLoader('blogs');

// Initialize the blog post page
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on a blog post page
    if (blogTitle && blogContent) {
        loadBlogPost();
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
        <div class="debug-log">Blogs path: ${blogLoader.path}</div>
        <div class="debug-log">Available blog loaders: ${window.LocalBlogLoader ? 'LocalBlogLoader' : 'None'}, 
            ${window.GitHubBlogLoader ? 'GitHubBlogLoader' : 'None'}</div>
        <div class="debug-log">Index file: ${blogLoader.indexFile}</div>
    `;
    
    container.appendChild(debugSection);
    
    // Try to check actual blog files
    try {
        fetch(blogLoader.indexFile)
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

// Load the blog post content
async function loadBlogPost() {
    try {
        // Get the slug from URL parameter
        const slug = getUrlParameter('slug');
        
        if (!slug) {
            console.warn('No slug parameter found in URL, redirecting to blogs listing');
            window.location.href = 'blogs.html';
            return;
        }
        
        // Show loading state
        blogContent.innerHTML = '<p class="loading">Loading blog content...</p>';
        
        // Get all blog posts
        const posts = await fetchBlogPosts();
        console.log('Fetched all blog posts:', posts.length);
        
        // Find the current post by slug
        const currentPost = posts.find(post => post.slug === slug);
        
        if (!currentPost) {
            console.error('Blog post not found for slug:', slug);
            blogContent.innerHTML = `
                <div class="error">
                    <h3>Blog Post Not Found</h3>
                    <p>The requested blog post could not be found.</p>
                    <div class="hint">Check the URL and try again.</div>
                </div>
            `;
            
            // Add debug info to help troubleshoot
            addDebugInfo(blogContent);
            return;
        }
        
        
        // Update page title
        document.title = `${currentPost.title} - Gouri Kartha`;
        
        // Populate blog post data
        blogTitle.textContent = currentPost.title;
        blogDate.textContent = currentPost.date;
        blogAuthor.textContent = currentPost.author;
        
        // Set featured image
        if (currentPost.image) {
            blogImage.src = currentPost.image;
            blogImage.alt = currentPost.title;
            blogImage.style.display = 'block';
        }
        
        // Display the blog content
        if (currentPost.content) {
            blogContent.innerHTML = currentPost.content;
        } else {
            // Try to fetch the content directly from the file
            try {
                const content = await fetchBlogContent(currentPost);
                if (content) {
                    blogContent.innerHTML = content;
                } else {
                    blogContent.innerHTML = '<p>Failed to load blog content. Please try again later.</p>';
                }
            } catch (error) {
                console.error('Error loading blog content:', error);
                blogContent.innerHTML = `
                    <div class="error">
                        <h3>Unable to Load Content</h3>
                        <p class="hint">There was an error loading the blog content: ${error.message}</p>
                    </div>
                `;
            }
        }
        
        // Set up navigation to previous and next posts
        setupPostNavigation(posts, currentPost);
        
    } catch (error) {
        console.error('Error loading blog post:', error);
        blogContent.innerHTML = `
            <div class="error">
                <h3>Failed to Load Blog Post</h3>
                <p class="hint">${error.message || 'Please try again later.'}</p>
            </div>
        `;
        
        // Add debug info to help troubleshoot
        addDebugInfo(blogContent);
    }
}

// Fetch blog posts using the LocalBlogLoader
async function fetchBlogPosts() {
    try {
        // Use the blog loader to fetch posts
        const posts = await blogLoader.fetchBlogPosts();
        
        // For each post, make sure it has a slug
        posts.forEach(post => {
            if (!post.slug) {
                post.slug = post.name ? post.name.replace(/\.(html|md)$/, '') : '';
            }
        });
        
        console.log(`Loaded ${posts.length} blog posts`);
        return posts;
    } catch (error) {
        console.error('Error fetching blog posts:', error);
        throw error;
    }
}

// Fetch the content of the blog post
async function fetchBlogContent(post) {
    try {
        // Try to fetch the actual content
        const response = await fetch(post.path);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        
        const content = await response.text();
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
        console.error('Error fetching blog content:', error);
        throw error;
    }
}

// Set up navigation to previous and next posts
function setupPostNavigation(posts, currentPost) {
    // Find the index of the current post
    const currentIndex = posts.findIndex(post => post.slug === currentPost.slug);
    
    // If there's a previous post
    if (currentIndex > 0) {
        const previous = posts[currentIndex - 1];
        prevPost.innerHTML = `<a href="blog.html?slug=${previous.slug}"><i class="fas fa-arrow-left"></i> ${previous.title}</a>`;
        prevPost.style.display = 'block';
    } else {
        prevPost.style.display = 'none';
    }
    
    // If there's a next post
    if (currentIndex < posts.length - 1) {
        const next = posts[currentIndex + 1];
        nextPost.innerHTML = `<a href="blog.html?slug=${next.slug}">${next.title} <i class="fas fa-arrow-right"></i></a>`;
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