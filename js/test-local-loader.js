// Simple test script for LocalBlogLoader

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
    
    // Create a test output area if it doesn't exist
    let testOutput = document.getElementById('test-output');
    if (!testOutput) {
        testOutput = document.createElement('div');
        testOutput.id = 'test-output';
        testOutput.style.margin = '20px';
        testOutput.style.padding = '20px';
        testOutput.style.border = '1px solid #ccc';
        testOutput.style.backgroundColor = '#f9f9f9';
        document.body.appendChild(testOutput);
    }
    
    // Display a message
    testOutput.innerHTML = '<h3>Testing LocalBlogLoader</h3><p>Checking if blog posts can be loaded...</p>';
    
    try {
        // Create a new LocalBlogLoader instance
        const loader = new LocalBlogLoader('blogs');
        
        // Try to load blog posts
        testOutput.innerHTML += '<p>Attempting to load posts...</p>';
        
        const posts = await loader.fetchBlogPosts();
        
        if (posts && posts.length > 0) {
            testOutput.innerHTML += `<p style="color: green">Success! Loaded ${posts.length} posts.</p>`;
            
            // Display the loaded posts
            testOutput.innerHTML += '<h4>Loaded Posts:</h4><ul>';
            posts.forEach(post => {
                testOutput.innerHTML += `
                    <li>
                        <strong>${post.title}</strong> (${post.date}) by ${post.author}
                        <br>
                        <small>${post.excerpt}</small>
                    </li>
                `;
            });
            testOutput.innerHTML += '</ul>';
        } else {
            testOutput.innerHTML += '<p style="color: red">No posts were loaded.</p>';
        }
    } catch (error) {
        testOutput.innerHTML += `<p style="color: red">Error: ${error.message}</p>`;
        console.error('Test failed:', error);
    }
}); 