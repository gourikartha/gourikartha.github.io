/**
 * Load and display poems
 */
async function loadPoems() {
    try {
        let poemsUrl;
        
        // Determine if we're on GitHub Pages
        if (window.location.hostname.includes('github.io')) {
            // On GitHub Pages, use raw githubusercontent URL to fetch index.json
            const ghUsername = 'gourikartha';
            const ghRepo = 'gourikartha.github.io';
            poemsUrl = `https://raw.githubusercontent.com/${ghUsername}/${ghRepo}/main/poems/index.json`;
        } else {
            // Local development
            poemsUrl = new URL('poems/index.json', window.location.origin).href;
        }
        
        console.log(`Fetching poems index from: ${poemsUrl}`);
        const response = await fetch(poemsUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch poems index: ${response.status} ${response.statusText}`);
        }
        
        const poems = await response.json();
        
        // Check if the index.json has the expected format (array of poems)
        if (!Array.isArray(poems)) {
            console.error('Invalid poems index.json format: expected an array of poems');
            throw new Error('Invalid poems index format');
        }
        
        // Display the poems
        displayPoems(poems);
    } catch (error) {
        console.error('Error loading poems:', error);
        document.getElementById('poem-container').innerHTML = `
            <div class="error-message">
                <h3>Error Loading Poems</h3>
                <p>Could not load the poem list. Please try again later.</p>
                <p class="error-details">${error.message || 'Unknown error'}</p>
            </div>
        `;
    }
} 