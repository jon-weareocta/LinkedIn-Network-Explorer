// Immediately redirect to the landing page
window.onload = function() {
    chrome.tabs.create({ url: 'landing.html' });
    window.close();
}; 