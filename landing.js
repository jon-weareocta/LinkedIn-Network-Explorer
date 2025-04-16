document.addEventListener('DOMContentLoaded', function() {
    const profileUrlInput = document.getElementById('profileUrl');
    const startButton = document.getElementById('startExtraction');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progress');
    const progressText = document.getElementById('progress-text');
    const pagesProcessed = document.getElementById('pages-processed');
    const connectionsFound = document.getElementById('connections-found');
    const logContainer = document.getElementById('log');
    const exportButton = document.getElementById('export-data');

    // Function to update progress
    function updateProgress(data) {
        progressBar.style.width = `${data.progress}%`;
        progressText.textContent = `${data.progress}%`;
        pagesProcessed.textContent = data.pagesProcessed;
        connectionsFound.textContent = data.connectionsFound;
    }

    // Function to add log entry
    function addLogEntry(message, type = 'info') {
        // Only add logs if extraction is in progress
        chrome.storage.local.get(['extractionStarted'], function(result) {
            if (result.extractionStarted) {
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${type}`;
                logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                logContainer.appendChild(logEntry);
                logContainer.scrollTop = logContainer.scrollHeight;
            }
        });
    }

    // Function to reset UI state
    function resetUIState() {
        startButton.disabled = false;
        statusDiv.textContent = 'Ready for new extraction';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        pagesProcessed.textContent = '0';
        connectionsFound.textContent = '0';
        logContainer.innerHTML = '';
        addLogEntry('Ready to start extraction. Enter a LinkedIn profile URL and click Start Extraction.', 'info');
    }

    // Function to handle extraction completion
    function handleExtractionComplete(data) {
        startButton.disabled = false;
        statusDiv.textContent = `Extraction complete! ${data.totalExtracted} connections exported to CSV.`;
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        
        // Clear logs after a delay
        setTimeout(() => {
            logContainer.innerHTML = '';
            addLogEntry('Ready for new extraction', 'info');
        }, 2000);
    }

    // Handle start extraction button click
    startButton.addEventListener('click', function() {
        const profileUrl = profileUrlInput.value.trim();
        
        if (!profileUrl) {
            statusDiv.textContent = 'Please enter a LinkedIn profile URL';
            return;
        }

        if (!profileUrl.includes('linkedin.com/in/')) {
            statusDiv.textContent = 'Please enter a valid LinkedIn profile URL';
            return;
        }

        // Disable button immediately to prevent double-clicks
        startButton.disabled = true;
        statusDiv.textContent = 'Starting extraction...';
        logContainer.innerHTML = ''; // Clear previous logs
        addLogEntry('Starting extraction process...', 'info');

        // Store the profile URL and start extraction
        chrome.storage.local.set({
            'profileUrl': profileUrl,
            'extractionStarted': true,
            'currentPage': 0,
            'extractedData': []
        }, function() {
            // Send message to background script to start extraction
            chrome.runtime.sendMessage({
                action: 'startExtraction',
                profileUrl: profileUrl
            });
        });
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'progress') {
            updateProgress(request.data);
        } else if (request.type === 'log' && request.message) {
            addLogEntry(request.message, request.logType);
        } else if (request.type === 'extractionComplete') {
            handleExtractionComplete(request);
        }
    });

    // Function to convert data to CSV
    function convertToCSV(data) {
        // CSV header
        const headers = ['Name', 'Title', 'Location', 'Profile URL'];
        
        // Convert each row to CSV
        const rows = data.map(item => {
            return [
                `"${item.name.replace(/"/g, '""')}"`,
                `"${item.title.replace(/"/g, '""')}"`,
                `"${item.location.replace(/"/g, '""')}"`,
                `"${item.profileUrl}"`
            ].join(',');
        });
        
        // Combine headers and rows
        return [headers.join(','), ...rows].join('\n');
    }

    // Export data functionality
    exportButton.addEventListener('click', function() {
        chrome.storage.local.get(['extractedData'], function(result) {
            if (result.extractedData && result.extractedData.length > 0) {
                const csv = convertToCSV(result.extractedData);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', url);
                linkElement.setAttribute('download', 'linkedin_connections.csv');
                document.body.appendChild(linkElement);
                linkElement.click();
                document.body.removeChild(linkElement);
                URL.revokeObjectURL(url); // Clean up the URL object
                addLogEntry(`Exported ${result.extractedData.length} connections to CSV`, 'success');
            } else {
                addLogEntry('No data to export', 'error');
            }
        });
    });

    // Initialize UI state
    chrome.storage.local.get(['extractionStarted', 'profileUrl', 'extractedData'], function(result) {
        // Reset UI state first
        resetUIState();
        
        if (result.profileUrl) {
            profileUrlInput.value = result.profileUrl;
        }
        
        if (result.extractionStarted && result.profileUrl) {
            // Update the status, but don't disable the button
            if (result.extractedData && result.extractedData.length > 0) {
                statusDiv.textContent = 'Previous extraction data available. You can start a new extraction.';
                addLogEntry(`Previous extraction found ${result.extractedData.length} connections. You can start a new extraction.`, 'info');
            } else {
                statusDiv.textContent = 'Ready for new extraction';
                addLogEntry('Ready for new extraction', 'info');
            }
        }
    });
    
    // Add reset functionality
    function resetExtraction() {
        chrome.storage.local.set({
            'extractionStarted': false,
            'currentPage': 0
        }, function() {
            resetUIState();
        });
    }
    
    // Add a reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.className = 'reset-button';
    resetButton.style.marginLeft = '10px';
    resetButton.addEventListener('click', resetExtraction);
    
    // Add it next to the Start Extraction button
    startButton.parentNode.appendChild(resetButton);
}); 