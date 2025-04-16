# LinkedIn Network Explorer

A Chrome extension for exploring and analyzing your LinkedIn network connections.

## Features

- Automatically extracts connection data from LinkedIn profiles
- Handles pagination and scrolling automatically
- Exports connection data to CSV format
- Supports large networks (500+ connections)
- Progress tracking and detailed logging
- Error handling and retry mechanisms

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon to open the interface
2. Enter a LinkedIn profile URL
3. Click "Start Extraction" to begin
4. Wait for the extraction to complete
5. Click "Export Data" to save the connections data

## Files

- `manifest.json` - Extension configuration
- `popup.html/js` - Extension popup interface
- `landing.html/js` - Main extraction interface
- `content.js` - Content script for LinkedIn page interaction
- `background.js` - Background script for managing extraction
- `styles.css` - Extension styling

## Technical Details

The extension uses:
- Chrome Extension Manifest V3
- MutationObserver for dynamic content
- Progressive scrolling and content loading
- Asynchronous operations with proper error handling
- Local storage for data persistence

## Privacy

This extension:
- Only works on LinkedIn.com
- Only extracts publicly visible data
- Stores data locally in your browser
- Does not send data to any external servers

## Contributing

Feel free to submit issues and enhancement requests! 