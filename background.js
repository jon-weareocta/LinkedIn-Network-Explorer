let currentTabId = null;
let totalConnections = 0;
let processedConnections = 0;

// Function to log messages
function log(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Forward log to landing page if it exists and extraction is in progress
    chrome.storage.local.get(['extractionStarted'], function(result) {
        if (result.extractionStarted) {
            chrome.tabs.query({url: chrome.runtime.getURL('landing.html')}, function(tabs) {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'log',
                        message: message,
                        logType: type
                    });
                }
            });
        }
    });
}

// Listen for messages from popup and landing page
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'startExtraction') {
        log('Starting extraction for profile: ' + request.profileUrl);
        startExtraction(request.profileUrl);
    } else if (request.type === 'closeTab') {
        // Close the LinkedIn tab if it exists
        if (currentTabId) {
            chrome.tabs.remove(currentTabId, function() {
                currentTabId = null;
                log('Closed LinkedIn tab');
            });
        }
    } else if (request.type === 'extractionComplete') {
        handleExtractionComplete(request);
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (sender.tab) {
        currentTabId = sender.tab.id;
    }
    
    if (request.type === 'extractedData') {
        log(`Received ${request.data.length} connections from content script`);
        handleExtractedData(request.data);
    } else if (request.type === 'extractionComplete') {
        log('Received extraction complete message');
        handleExtractionComplete();
    } else if (request.type === 'log') {
        // Forward content script logs to landing page
        log(`[Content Script] ${request.message}`, request.logType);
    }
});

// Start the extraction process
function startExtraction(profileUrl) {
    log('Starting extraction process');
    
    // Reset counters
    totalConnections = 0;
    processedConnections = 0;
    
    // Store extraction settings
    chrome.storage.local.set({
        profileUrl: profileUrl,
        extractionStarted: true,
        currentPage: 0,
        extractedData: [],
        autoStart: true
    }, function() {
        log('Extraction settings saved');
        
        // Open the profile in a new tab
        chrome.tabs.create({url: profileUrl}, function(tab) {
            log(`LinkedIn profile opened in tab ${tab.id}`);
            currentTabId = tab.id;
            
            // Send initial progress update
            updateProgress();
            
            // Wait for tab to load, then inject content script
            setTimeout(function() {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'startExtraction',
                    profileUrl: profileUrl
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        // If there's an error, the content script might not be loaded yet
                        log('Content script not ready, will auto-initialize', 'warning');
                    } else {
                        log('Sent start command to content script');
                    }
                });
            }, 1000);
        });
    });
}

// Handle extracted data
function handleExtractedData(data) {
    log(`Processing ${data.length} extracted connections`);
    
    // Get existing data
    chrome.storage.local.get(['extractedData', 'currentPage'], function(result) {
        const existingData = result.extractedData || [];
        const currentPage = (result.currentPage || 0) + 1;
        
        // Add new data
        const newData = [...existingData];
        
        // Check for duplicates and add new connections
        let newConnectionCount = 0;
        data.forEach(connection => {
            if (!newData.some(existing => existing.profileUrl === connection.profileUrl)) {
                newData.push(connection);
                newConnectionCount++;
            }
        });
        
        log(`Added ${newConnectionCount} new connections (filtered out ${data.length - newConnectionCount} duplicates)`);
        
        // Update storage
        chrome.storage.local.set({
            'extractedData': newData,
            'currentPage': currentPage
        }, function() {
            // Update counters
            processedConnections = newData.length;
            totalConnections = Math.max(totalConnections, processedConnections);
            
            log(`Updated storage: ${processedConnections} total connections across ${currentPage} pages`);
            
            // Update progress
            updateProgress();
        });
    });
}

// Handle extraction completion
function handleExtractionComplete(request = {}) {
    chrome.storage.local.get(['extractedData'], function(result) {
        const totalExtracted = result.extractedData?.length || 0;
        
        log(`Extraction complete! Found ${totalExtracted} total connections`, 'success');
        
        // Update final progress
        updateProgress(true);
        
        // Send success message to landing page
        chrome.tabs.query({url: chrome.runtime.getURL('landing.html')}, function(tabs) {
            if (tabs && tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'extractionComplete',
                    message: `Extraction complete! Successfully extracted data for ${totalExtracted} connections.`,
                    totalExtracted: totalExtracted
                });
            }
        });
        
        // Clean up
        if (currentTabId) {
            setTimeout(() => {
                chrome.tabs.remove(currentTabId, function() {
                    currentTabId = null;
                });
            }, 1000);
        }
    });
}

// Update progress in the landing page
function updateProgress(isComplete = false) {
    chrome.storage.local.get(['extractedData', 'currentPage'], function(result) {
        const progress = isComplete ? 100 : Math.min(100, Math.max(5, Math.round((result.currentPage / Math.max(1, Math.ceil(totalConnections / 10))) * 100)));
        
        // Send progress update to landing page
        chrome.tabs.query({url: chrome.runtime.getURL('landing.html')}, function(tabs) {
            if (tabs && tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'progress',
                    data: {
                        progress: progress,
                        pagesProcessed: result.currentPage || 0,
                        connectionsFound: result.extractedData?.length || 0
                    }
                });
            }
        });
    });
}

// Listen for tab updates (for debugging)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (tabId === currentTabId && changeInfo.status === 'complete') {
        log(`LinkedIn tab finished loading: ${tab.url}`);
    }
}); 