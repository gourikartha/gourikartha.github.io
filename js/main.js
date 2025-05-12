// Constants
const GITHUB_USERNAME = 'govindkartha'; // Your actual GitHub username
const REPO_NAME = 'webs'; // The repository name
const BLOGS_PATH = 'blogs'; // Path to your blogs folder in the repository

// Initialize blog loaders
const githubBlogLoader = new GitHubBlogLoader(GITHUB_USERNAME, REPO_NAME, BLOGS_PATH);
const localBlogLoader = new LocalBlogLoader(BLOGS_PATH);

// DOM Elements
const featuredPostsContainer = document.getElementById('featured-posts');
const blogsContainer = document.getElementById('blogs-container');
const blogEntriesContainer = document.getElementById('blog-entries');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the page based on which page we're on
    if (featuredPostsContainer) {
        loadFeaturedPosts();
    }
    
    if (blogsContainer) {
        loadAllPosts();
        
        // Set up event listeners for search and filter
        if (searchInput && categoryFilter) {
            searchInput.addEventListener('input', handleSearch);
            categoryFilter.addEventListener('change', handleCategoryFilter);
        }
    }
    
    // Handle newsletter form submission
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', handleNewsletterSubmit);
    }
});

// Load featured blog posts for the homepage
async function loadFeaturedPosts() {
    try {
        const posts = await fetchBlogPosts();
        
        // Get the 3 most recent posts as featured
        const featuredPosts = posts.slice(0, 3);
        
        if (featuredPosts.length === 0) {
            featuredPostsContainer.innerHTML = '<p>No featured posts available yet.</p>';
            return;
        }
        
        featuredPostsContainer.innerHTML = '';
        
        // Create HTML for each featured post
        featuredPosts.forEach(post => {
            const postElement = createBlogPostCard(post);
            featuredPostsContainer.appendChild(postElement);
        });
    } catch (error) {
        console.error('Error loading featured posts:', error);
        featuredPostsContainer.innerHTML = '<p>Failed to load featured posts. Please try again later.</p>';
    }
}

// Load all blog posts for the blogs page
async function loadAllPosts() {
    try {
        const posts = await fetchBlogPosts();
        
        if (posts.length === 0) {
            if (blogsContainer) {
                blogsContainer.innerHTML = '<p>No blog posts available yet.</p>';
            }
            return;
        }
        
        if (blogsContainer) {
            blogsContainer.innerHTML = '';
            
            // Create HTML for each blog post
            posts.forEach(post => {
                const postElement = createBlogPostCard(post);
                blogsContainer.appendChild(postElement);
            });
            
            // Populate category filter options
            if (categoryFilter) {
                populateCategoryFilter(posts);
            }
        }
    } catch (error) {
        console.error('Error loading blog posts:', error);
        if (blogsContainer) {
            blogsContainer.innerHTML = '<p>Failed to load blog posts. Please try again later.</p>';
        }
    }
}

// Fetch blog posts from local directory or GitHub repository
async function fetchBlogPosts() {
    try {
        // Define blog posts directly in code to avoid CORS issues with local files
        const hardcodedPosts = [
            
        ];
        
        
        // Log posts
        hardcodedPosts.forEach((post, i) => {
            console.log(`${i + 1}. ${post.title} - Date: ${post.date}`);
        });
        
        return hardcodedPosts;
    } catch (error) {
        console.error('Error loading blog posts:', error);
        return [];
    }
}

// Create a blog post card element
function createBlogPostCard(post) {
    const article = document.createElement('article');
    article.className = 'blog-card';
    
    article.innerHTML = `
        <div class="blog-card-image">
            <img src="${post.image}" alt="${post.title}" onerror="this.src='images/blog-placeholder.jpg'">
        </div>
        <div class="blog-card-content">
            <h3 class="blog-card-title"><a href="blog.html?slug=${post.slug}">${post.title}</a></h3>
            <p class="blog-card-excerpt">${post.excerpt}</p>
            <div class="blog-card-meta">
                <span class="blog-card-date">${post.date}</span>
                <span class="blog-card-category">${post.category}</span>
            </div>
        </div>
    `;
    
    return article;
}

// Handle search functionality
function handleSearch() {
    const searchValue = searchInput.value.toLowerCase();
    const categoryValue = categoryFilter.value;
    
    const blogCards = blogsContainer.querySelectorAll('.blog-card');
    
    blogCards.forEach(card => {
        const title = card.querySelector('.blog-card-title').textContent.toLowerCase();
        const excerpt = card.querySelector('.blog-card-excerpt').textContent.toLowerCase();
        const category = card.querySelector('.blog-card-category').textContent;
        
        const matchesSearch = title.includes(searchValue) || excerpt.includes(searchValue);
        const matchesCategory = categoryValue === '' || category === categoryValue;
        
        card.style.display = (matchesSearch && matchesCategory) ? 'block' : 'none';
    });
}

// Handle category filter
function handleCategoryFilter() {
    handleSearch(); // Reuse search logic which also handles category filtering
}

// Populate category filter options
function populateCategoryFilter(posts) {
    // Extract unique categories
    const categories = [...new Set(posts.map(post => post.category))];
    
    // Add options to select element
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// Handle newsletter form submission
function handleNewsletterSubmit(event) {
    event.preventDefault();
    const email = event.target.querySelector('input').value;
    
    // In a real implementation, you would send this to a backend service
    // For now, just show an alert
    alert(`Thank you for subscribing with ${email}!`);
    event.target.reset();
}

// Get URL parameters (for blog post page)
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
} 