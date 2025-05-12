/**
 * Poem posts data - will be populated from poems folder
 */
let allPosts = [];

/**
 * Blog loader instance for poems
 */
const poemLoader = new LocalBlogLoader('poems');

/**
 * Variables for pagination
 */
const postsPerPage = 20;
let currentPage = 1;

/**
 * Load and display poems
 */
async function loadPoems() {
    try {
        const poemContainer = document.getElementById('poem-entries');
        
        // Clear any existing content and show loading
        poemContainer.innerHTML = '<div class="loading">Loading poems...</div>';
        
        console.log('Using poemLoader to fetch poems');
        
        // Use the poemLoader to fetch poems
        allPosts = await poemLoader.fetchPosts();
        
        console.log(`Loaded ${allPosts.length} poems`, allPosts);
        
        // For debug: confirm slugs
        allPosts.forEach(post => {
            console.log(`Poem: ${post.title}, Slug: ${post.slug}`);
        });
        
        // Sort by date
        allPosts = allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Display the poems
        displayPoems();
        
        // Set up pagination if needed
        if (allPosts.length > postsPerPage) {
            setupPagination();
        }
    } catch (error) {
        console.error('Error loading poems:', error);
        
        const poemContainer = document.getElementById('poem-entries');
        poemContainer.innerHTML = `
            <div class="error">
                <h3>Error Loading Poems</h3>
                <p>Could not load the poem list. Please try again later.</p>
                <p class="error-details">${error.message || 'Unknown error'}</p>
            </div>
        `;
        
        // Add debug info when there's an error
        addDebugInfo(poemContainer);
    }
}

/**
 * Display poems for the current page
 * @param {Array} filteredPosts - Optional filtered posts array
 */
function displayPoems(filteredPosts = null) {
    const poemContainer = document.getElementById('poem-entries');
    
    if (!poemContainer) {
        console.error('Cannot display poems - poem-entries element not found!');
        return;
    }
    
    poemContainer.innerHTML = '';
    
    // Use either filtered posts or all posts
    const postsToUse = filteredPosts || allPosts;
    
    // If no poems are found
    if (postsToUse.length === 0) {
        console.warn('No poems found to display');
        poemContainer.innerHTML = `
            <div class="empty-state">
                <i class="far fa-file-alt"></i>
                <p>No poems found.</p>
                <div class="hint">Check back soon for new poems!</div>
            </div>
        `;
        return;
    }
    
    // Calculate start and end index for current page
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = Math.min(startIndex + postsPerPage, postsToUse.length);
    const postsToShow = postsToUse.slice(startIndex, endIndex);
    
    // Display post count
    const totalPostsDiv = document.createElement('div');
    totalPostsDiv.className = 'post-count';
    totalPostsDiv.innerHTML = `Showing ${postsToShow.length} of ${postsToUse.length} poems`;
    poemContainer.appendChild(totalPostsDiv);
    
    // Create a list for poem posts
    const poemList = document.createElement('ul');
    poemList.className = 'poem-post-list';
    
    // Loop through the posts for current page
    for (let i = 0; i < postsToShow.length; i++) {
        const post = postsToShow[i];
        
        // Create list item
        const listItem = document.createElement('li');
        listItem.className = 'poem-post-item';
        
        // Format date properly
        const postDate = new Date(post.date);
        const formattedDate = isNaN(postDate.getTime()) 
            ? post.date 
            : postDate.toLocaleDateString('en-US', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
        
        // Check if post.name exists
        const isMD = post.name ? post.name.endsWith('.md') : 
                   (post.path ? post.path.endsWith('.md') : false);
        
        // Special class to visually highlight MD files
        if (isMD) {
            listItem.classList.add('markdown-poem');
        }
        
        // Create title link - make sure post.slug exists
        const titleLink = document.createElement('a');
        if (!post.slug) {
            // Generate slug from name or path if needed
            if (post.name) {
                post.slug = post.name.replace(/\.(html|md)$/, '');
            } else if (post.path) {
                // Extract filename from path
                const pathParts = post.path.split('/');
                const filename = pathParts[pathParts.length - 1];
                post.slug = filename.replace(/\.(html|md)$/, '');
            } else {
                // Fallback - use id or random string
                post.slug = post.id || `poem-${Math.random().toString(36).substring(2, 9)}`;
                console.warn(`Generated random slug for poem: ${post.title || 'Untitled'}`);
            }
        }
        
        titleLink.href = `poem.html?slug=${post.slug}`;
        titleLink.className = 'poem-post-title';
        titleLink.textContent = post.title || 'Untitled Poem';
        
        // Create date span
        const dateSpan = document.createElement('span');
        dateSpan.className = 'poem-post-date';
        dateSpan.textContent = formattedDate;
        
        // Add elements to list item
        listItem.appendChild(titleLink);
        listItem.appendChild(dateSpan);
        
        // Add list item to poem list
        poemList.appendChild(listItem);
    }
    
    // Add the poem list to container
    poemContainer.appendChild(poemList);
}

/**
 * Search functionality
 */
function handleSearch() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const searchContainer = document.querySelector('.search-container');
    
    // Reset to first page when searching
    currentPage = 1;
    
    // Toggle active class on search container
    if (searchTerm) {
        searchContainer.classList.add('active');
    } else {
        searchContainer.classList.remove('active');
    }
    
    // Remove any existing search results info
    const existingSearchInfo = document.querySelectorAll('.search-results-info');
    existingSearchInfo.forEach(info => info.remove());
    
    if (!searchTerm) {
        // If search is empty, show all posts
        displayPoems();
        setupPagination();
        return;
    }
    
    
    // Filter posts based on search term
    const filteredPosts = allPosts.filter(post => {
        const titleMatch = post.title.toLowerCase().includes(searchTerm);
        const excerptMatch = post.excerpt && post.excerpt.toLowerCase().includes(searchTerm);
        const authorMatch = post.author && post.author.toLowerCase().includes(searchTerm);
        const slugMatch = post.slug && post.slug.toLowerCase().includes(searchTerm);
        
        return titleMatch || excerptMatch || authorMatch || slugMatch;
    });
    
    
    // Display filtered posts
    displayPoems(filteredPosts);
    
    // Add search results info
    const poemContainer = document.getElementById('poem-entries');
    const searchInfo = document.createElement('div');
    searchInfo.className = 'search-results-info';
    
    if (filteredPosts.length === 0) {
        searchInfo.textContent = `No results found for "${searchTerm}"`;
    } else if (filteredPosts.length === 1) {
        searchInfo.textContent = `Found 1 result for "${searchTerm}"`;
    } else {
        searchInfo.textContent = `Found ${filteredPosts.length} results for "${searchTerm}"`;
    }
    
    // Insert after the search container
    searchContainer.parentNode.insertBefore(searchInfo, searchContainer.nextSibling);
    
    // Update pagination if needed
    if (filteredPosts.length > postsPerPage) {
        setupPagination(filteredPosts);
    } else {
        // Hide pagination for small result sets
        const paginationContainer = document.getElementById('pagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
    }
}

/**
 * Set up pagination
 * @param {Array} postsToUse - Optional filtered posts array
 */
function setupPagination(postsToUse = null) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    
    const posts = postsToUse || allPosts;
    
    paginationContainer.innerHTML = '';
    
    const totalPages = Math.ceil(posts.length / postsPerPage);
    
    // Only show pagination if we have more than one page
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.addEventListener('click', () => {
            currentPage--;
            displayPoems(postsToUse);
            setupPagination(postsToUse);
        });
        paginationContainer.appendChild(prevButton);
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        if (i === currentPage) {
            pageButton.classList.add('active');
        }
        
        pageButton.addEventListener('click', () => {
            currentPage = i;
            displayPoems(postsToUse);
            setupPagination(postsToUse);
        });
        
        paginationContainer.appendChild(pageButton);
    }
    
    // Next button
    if (currentPage < totalPages) {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.addEventListener('click', () => {
            currentPage++;
            displayPoems(postsToUse);
            setupPagination(postsToUse);
        });
        paginationContainer.appendChild(nextButton);
    }
}

/**
 * Add debugging information to help troubleshoot poem loading issues
 * @param {HTMLElement} container - The container to add debug info to
 */
function addDebugInfo(container) {
    // Create debug section
    const debugSection = document.createElement('div');
    debugSection.className = 'debug-section';
    debugSection.innerHTML = `
        <h3>Debugging Information</h3>
        <div class="debug-log">Current URL: ${window.location.href}</div>
        <div class="debug-log">Poems path: ${poemLoader.path}</div>
        <div class="debug-log">Files in poems directory: <span id="poem-files">Checking...</span></div>
        <div class="debug-log">Available blog loaders: ${window.LocalBlogLoader ? 'LocalBlogLoader' : 'None'}, 
            ${window.GitHubBlogLoader ? 'GitHubBlogLoader' : 'None'}</div>
    `;
    
    container.appendChild(debugSection);
    
    // Try to check actual poem files
    try {
        fetch('js/github-blog-loader.js')
            .then(response => {
                const filesSpan = document.getElementById('poem-files');
                if (response.ok) {
                    filesSpan.textContent = 'Blog loader script found';
                } else {
                    filesSpan.textContent = 'Blog loader script not found';
                    filesSpan.classList.add('error-log');
                }
            })
            .catch(err => {
                const filesSpan = document.getElementById('poem-files');
                filesSpan.textContent = `Error checking files: ${err.message}`;
                filesSpan.classList.add('error-log');
            });
    } catch (e) {
        console.error('Error in debug section:', e);
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the poems listing page
    const poemContainer = document.getElementById('poem-entries');
    if (poemContainer) {
        loadPoems();
    }
    
    // Set up pagination container
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) {
        console.log('No pagination container found');
    }
    
    // Set up search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    } else {
        console.error('Could not find search-input element!');
    }
}); 
