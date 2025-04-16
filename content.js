// Add at the top of the file
let isExtractionRunning = false;

// Function to get random wait time
function getRandomWait(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// Function to log messages
function log(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Only send logs to landing page if extraction is still in progress
    chrome.storage.local.get(['extractionStarted'], function(result) {
        if (result.extractionStarted) {
            chrome.runtime.sendMessage({
                type: 'log',
                message: message,
                logType: type
            });
        }
    });
}

// Function to find connections button and click it
async function findAndClickConnectionsButton() {
    log('Looking for connections button...');
    
    // Wait for page load and profile content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try different selectors for connections button
    const selectors = [
        // Primary selector - the exact search URL pattern we want
        'a[href*="/search/results/people/?connectionOf"]',
        // Fallback selectors
        'a[href*="connectionOf"]',
        'a[href*="/connections/"]'
    ];
    
    let connectionsButton = null;
    let connectionsHref = null;
    
    // First try direct selectors
    for (const selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (element.href && element.href.includes('/search/results/people/?connectionOf')) {
                    connectionsButton = element;
                    connectionsHref = element.href;
                    log(`Found connections button with search URL: ${connectionsHref}`);
                    break;
                }
            }
            if (connectionsButton) break;
        } catch (error) {
            continue;
        }
    }
    
    // If still not found, try finding by scanning all links
    if (!connectionsButton) {
        log('Trying to find connections link by scanning all links...');
        const allLinks = document.querySelectorAll('a[href*="linkedin.com"]');
        for (const link of allLinks) {
            if (link.href && link.href.includes('/search/results/people/?connectionOf')) {
                connectionsButton = link;
                connectionsHref = link.href;
                log(`Found connections button by scanning links: ${connectionsHref}`);
                break;
            }
        }
    }
    
    if (connectionsButton && connectionsHref) {
        log('Found connections link, attempting navigation...');
        
        // Try direct navigation first as it's more reliable
        log(`Navigating to: ${connectionsHref}`);
        window.location.href = connectionsHref;
        
        // Wait for navigation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (document.URL.includes('/search/results/people/')) {
            log('Successfully navigated to connections page', 'success');
            await moveToNextPage();
        } else {
            log('Direct navigation failed, trying click as fallback...');
            connectionsButton.click();
            
            // Wait for page to load and start extraction
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            if (document.URL.includes('/search/results/people/')) {
                log('Successfully navigated to connections page via click', 'success');
                await moveToNextPage();
            } else {
                log('Navigation to connections page failed. Current URL: ' + document.URL, 'error');
            }
        }
    } else {
        log('Could not find connections button with search URL pattern. This might not be a LinkedIn profile page or the connections might not be visible.', 'error');
    }
}

// Function to extract connections data
async function extractConnectionsData() {
    log('Starting to extract connections data...');
    
    // Check authentication first
    if (!await checkAuthentication()) {
        return;
    }
    
    try {
        // Wait for container and cards to be present
        await waitForElement('.search-results-container');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Updated selector to match the actual LinkedIn structure
        const cards = document.querySelectorAll('li.xnCzebhjnqghZDgnabQzdKJqvTIbFBqbM');
        if (!cards || cards.length === 0) {
            log('No connection cards found', 'error');
            return;
        }
        
        log(`Found ${cards.length} connection cards`);
        
        const extractedData = [];
        for (const card of cards) {
            try {
                // Updated selectors based on the actual HTML structure
                const nameElement = card.querySelector('span[dir="ltr"] > span[aria-hidden="true"]');
                const titleElement = card.querySelector('.sghcxBmJHxIkbwXiezHvDhmFICqxFuedUM');
                const locationElement = card.querySelector('.RaWZbsMgsmnrxwyhNGmQHZwiopTqzspzk');
                const profileElement = card.querySelector('a[href*="/in/"]');
                
                if (nameElement && profileElement) {
                    const data = {
                        name: nameElement.textContent.trim(),
                        title: titleElement ? titleElement.textContent.trim() : '',
                        location: locationElement ? locationElement.textContent.trim() : '',
                        profileUrl: profileElement.href
                    };
                    extractedData.push(data);
                }
            } catch (error) {
                log(`Error extracting card data: ${error.message}`, 'warning');
            }
        }
        
        if (extractedData.length > 0) {
            log(`Successfully extracted ${extractedData.length} connections`);
            chrome.runtime.sendMessage({
                type: 'extractedData',
                data: extractedData
            });
        }
        
    } catch (error) {
        log(`Error during extraction: ${error.message}`, 'error');
    }
}

// Function to wait for page load
function waitForPageLoad() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            log('Page already loaded');
            resolve();
        } else {
            log('Waiting for page to load...');
            window.addEventListener('load', () => {
                log('Page load complete');
                resolve();
            });
        }
    });
}

// Function to wait for element
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Timeout after specified duration
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);
    });
}

// Function to perform smooth scroll
function smoothScroll(targetPosition, duration = 1000) {
    return new Promise((resolve) => {
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition;
        const startTime = performance.now();

        function scrollStep(currentTime) {
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Easing function for smoother scroll
            const easeProgress = 0.5 * (1 - Math.cos(Math.PI * progress));
            
            window.scrollTo(0, startPosition + (distance * easeProgress));

            if (progress < 1) {
                requestAnimationFrame(scrollStep);
            } else {
                setTimeout(resolve, 100); // Small delay after scroll
            }
        }

        requestAnimationFrame(scrollStep);
    });
}

// Function to check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Function to scroll and wait for content
async function scrollAndWaitForContent() {
    log('Starting progressive scroll and content check...');
    
    const scrollSteps = 5; // Number of scroll steps
    const scrollDelay = getRandomWait(800, 1200); // Random delay between scrolls
    const viewportHeight = window.innerHeight;
    const totalHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
    );

    // First scroll to top
    await smoothScroll(0);
    await new Promise(resolve => setTimeout(resolve, scrollDelay));

    // Scroll progressively
    for (let i = 1; i <= scrollSteps; i++) {
        const targetPosition = (totalHeight / scrollSteps) * i;
        log(`Scrolling progress: ${Math.round((i / scrollSteps) * 100)}%`);
        
        await smoothScroll(targetPosition);
        await new Promise(resolve => setTimeout(resolve, scrollDelay));

        // Wait for any lazy-loaded content
        try {
            await waitForElement('.search-results-container', 5000);
            // Check for connection cards using the correct selector
            const cards = document.querySelectorAll('li.xnCzebhjnqghZDgnabQzdKJqvTIbFBqbM');
            log(`Found ${cards.length} connection cards at scroll step ${i}`);
            
            // If we found cards, wait a bit longer to ensure all content is loaded
            if (cards.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            log('Warning: Search results container not found during scroll', 'warning');
        }
    }

    // Final scroll to bottom to ensure everything is loaded
    await smoothScroll(totalHeight);
    await new Promise(resolve => setTimeout(resolve, scrollDelay * 1.5)); // Longer wait at bottom

    log('Scroll complete, checking for pagination...');
}

// Function to check for next page button and click it
async function moveToNextPage() {
    log('Starting next page navigation process...');
    
    try {
        // Check authentication first
        if (!await checkAuthentication()) {
            isExtractionRunning = false;
            return;
        }
        
        // Wait for initial page load
        await waitForPageLoad();
        
        // Scroll and wait for content
        await scrollAndWaitForContent();
        
        // Extract data after ensuring content is loaded
        await extractConnectionsData();
        
        // Wait a moment before checking pagination
        await new Promise(resolve => setTimeout(resolve, getRandomWait(2000, 3000)));
        
        // Try multiple times to find pagination
        let pagination = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!pagination && retryCount < maxRetries) {
            pagination = await waitForElement('.artdeco-pagination', 5000).catch(() => null);
            if (!pagination) {
                log(`Pagination not found, retry ${retryCount + 1} of ${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                retryCount++;
            }
        }
        
        if (!pagination) {
            log('No pagination found after retries, extraction complete', 'success');
            isExtractionRunning = false;
            chrome.runtime.sendMessage({ type: 'extractionComplete' });
            return;
        }
        
        // Find next button and check if we're on the last page
        const nextButton = await waitForElement('button.artdeco-pagination__button--next', 5000).catch(() => null);
        const pageInfo = document.querySelector('.artdeco-pagination__page-state');
        let currentPage = 1;
        let totalPages = 1;
        
        if (pageInfo) {
            const pageText = pageInfo.textContent.trim();
            const matches = pageText.match(/Page (\d+) of (\d+)/);
            if (matches) {
                currentPage = parseInt(matches[1]);
                totalPages = parseInt(matches[2]);
                log(`On page ${currentPage} of ${totalPages}`);
            }
        }
        
        if (!nextButton || nextButton.disabled || nextButton.getAttribute('aria-disabled') === 'true' || currentPage >= totalPages) {
            log(`Reached last page (${currentPage} of ${totalPages}), extraction complete`, 'success');
            isExtractionRunning = false;
            chrome.runtime.sendMessage({ type: 'extractionComplete' });
            return;
        }
        
        // Ensure next button is in viewport
        if (!isInViewport(nextButton)) {
            await smoothScroll(nextButton.getBoundingClientRect().top + window.scrollY - (window.innerHeight / 2));
            await new Promise(resolve => setTimeout(resolve, getRandomWait(1000, 2000)));
        }
        
        // Random wait before clicking
        await new Promise(resolve => setTimeout(resolve, getRandomWait(2000, 3000)));
        
        // Click next button
        log(`Navigating to page ${currentPage + 1}...`);
        nextButton.click();
        
        // Wait for page change
        const currentUrl = window.location.href;
        let pageChangeTimeout = setTimeout(() => {
            log('Timeout waiting for page change', 'error');
            isExtractionRunning = false;
            chrome.runtime.sendMessage({ type: 'extractionComplete' });
        }, 15000);
        
        // Monitor for page change
        const observer = new MutationObserver(async (mutations, obs) => {
            if (window.location.href !== currentUrl) {
                clearTimeout(pageChangeTimeout);
                obs.disconnect();
                log('URL changed, waiting for new page to load...');
                
                // Wait for new page load
                await waitForPageLoad();
                await new Promise(resolve => setTimeout(resolve, getRandomWait(3000, 4000)));
                
                // Start the process again
                moveToNextPage();
            }
        });
        
        observer.observe(document, { subtree: true, childList: true });
        
    } catch (error) {
        log(`Error during pagination: ${error.message}`, 'error');
        isExtractionRunning = false;
        chrome.runtime.sendMessage({ type: 'extractionComplete' });
    }
}

// Function to check if we're on login page
function isLoginPage() {
    return document.querySelector('input[type="password"]') !== null || 
           document.querySelector('.sign-in-form') !== null ||
           document.URL.includes('linkedin.com/login');
}

// Function to check authentication status
async function checkAuthentication() {
    if (isLoginPage()) {
        log('User is not authenticated - redirecting to login page', 'error');
        chrome.runtime.sendMessage({ 
            type: 'authError',
            message: 'LinkedIn authentication required. Please log in to LinkedIn and try again.'
        });
        return false;
    }
    return true;
}

// Initialize extraction
async function initialize() {
    log('Content script initialized on: ' + document.URL);
    
    // Prevent multiple instances from running
    if (isExtractionRunning) {
        log('Extraction already in progress, skipping initialization');
        return;
    }
    
    // Check authentication first
    if (!await checkAuthentication()) {
        return;
    }
    
    isExtractionRunning = true;
    
    try {
        if (document.URL.includes('linkedin.com/in/')) {
            log('Detected LinkedIn profile page');
            // Wait for the page to fully load before looking for the connections button
            await new Promise(resolve => setTimeout(resolve, 3000));
            await findAndClickConnectionsButton();
        } else if (document.URL.includes('/search/results/people/')) {
            log('Already on connections page, starting extraction');
            await moveToNextPage();
        } else {
            log('Not on a LinkedIn profile or connections page. Current URL: ' + document.URL, 'warning');
        }
    } catch (error) {
        log(`Error during initialization: ${error.message}`, 'error');
        isExtractionRunning = false;
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'startExtraction') {
        log('Received extraction start command');
        initialize().catch(error => {
            log(`Error during initialization: ${error.message}`, 'error');
        });
    }
});

// Check if we should automatically start when the page loads
chrome.storage.local.get(['autoStart', 'extractionStarted'], function(result) {
    if (result.autoStart && result.extractionStarted) {
        log('Auto-starting extraction');
        initialize().catch(error => {
            log(`Error during auto-start initialization: ${error.message}`, 'error');
        });
    }
});

// Run initialization when script is loaded
initialize().catch(error => {
    log(`Error during initial initialization: ${error.message}`, 'error');
}); 