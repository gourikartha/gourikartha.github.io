/**
 * Load and display blog posts
 */
async function loadBlogs() {
    try {
        // Initialize the blog loader
        const blogLoader = new LocalBlogLoader('blogs/index.json');
        
        // Fetch all blog posts
        const posts = await blogLoader.fetchPosts();
        
        // Display the blog posts
        displayBlogPosts(posts);
    } catch (error) {
        console.error('Error loading blogs:', error);
        document.getElementById('blog-container').innerHTML = `
            <div class="error-message">
                <h3>Error Loading Blogs</h3>
                <p>Could not load the blog posts. Please try again later.</p>
                <p class="error-details">${error.message || 'Unknown error'}</p>
            </div>
        `;
    }
} 