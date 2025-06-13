/**
 * Loom Video Automation Frontend
 * 
 * This script handles the frontend functionality for the Loom Video Automation tool.
 * It manages file uploads, CSV mapping, and video creation process.
 */

// Global state
const state = {
    overlayVideo: null,
    processedOverlayVideo: null, // Add processed overlay path
    csvData: null,
    csvHeaders: [],
    mappings: {
        website: null,
        name: null
    },
    processing: false,
    results: [],
    workerCounts: {
        recommended: 0,
        recommendedPlusOne: 0
    }
};

// DOM elements
const elements = {
    // Forms and inputs
    overlayForm: document.getElementById('overlayForm'),
    overlayInput: document.getElementById('overlayVideo'),
    csvForm: document.getElementById('csvForm'),
    csvInput: document.getElementById('csvFile'),
    
    // Status and preview elements
    overlayStatus: document.getElementById('overlayStatus'),
    overlayPreview: document.getElementById('overlayPreview'),
    csvStatus: document.getElementById('csvStatus'),
    csvPreview: document.getElementById('csvPreview'),
    
    // Mapping elements
    mapColumnsCard: document.getElementById('mapColumnsCard'),
    websiteColumn: document.getElementById('websiteColumn'),
    nameColumn: document.getElementById('nameColumn'),
    csvTable: document.getElementById('csvTable'),
    csvHeaderRow: document.getElementById('csvHeaderRow'),
    csvDataRows: document.getElementById('csvDataRows'),
    
    // Processing options
    processingOptionsCard: document.getElementById('processingOptionsCard'),
    parallelProcessingToggle: document.getElementById('parallelProcessingToggle'),
    parallelProcessingInfo: document.getElementById('parallelProcessingInfo'),
    workerCountOptions: document.getElementById('workerCountOptions'),
    recommendedWorkers: document.getElementById('recommendedWorkers'),
    extraWorker: document.getElementById('extraWorker'),
    recommendedWorkerCount: document.getElementById('recommendedWorkerCount'),
    extraWorkerCount: document.getElementById('extraWorkerCount'),
    workerCountInfo: document.getElementById('workerCountInfo'),
    
    // Processing elements
    createVideosBtn: document.getElementById('createVideosBtn'),
    resultsCard: document.getElementById('resultsCard'),
    totalProgress: document.getElementById('totalProgress'),
    processingStatus: document.getElementById('processingStatus'),
    videoResults: document.getElementById('videoResults')
};

// Initialize event listeners
function initEventListeners() {
    // Overlay video upload
    elements.overlayForm.addEventListener('submit', function(e) {
        e.preventDefault();
        uploadOverlayVideo();
    });
    
    // CSV file upload
    elements.csvForm.addEventListener('submit', function(e) {
        e.preventDefault();
        uploadCsvFile();
    });
    
    // Column mapping change events
    elements.websiteColumn.addEventListener('change', updateMappings);
    elements.nameColumn.addEventListener('change', updateMappings);
    
    // Parallel processing toggle
    elements.parallelProcessingToggle.addEventListener('change', function() {
        const isParallel = this.checked;
        elements.parallelProcessingInfo.textContent = isParallel 
            ? 'Processing multiple videos simultaneously can be significantly faster on multi-core systems.' 
            : 'Processing videos one at a time. This may be slower but uses less system resources.';
        
        // Show/hide worker count options based on parallel processing toggle
        elements.workerCountOptions.style.display = isParallel ? 'block' : 'none';
    });
    
    // Create videos button
    elements.createVideosBtn.addEventListener('click', startVideoCreation);
    
    // Fetch worker counts
    fetchWorkerCounts();
}

// Fetch worker counts from the server
async function fetchWorkerCounts() {
    try {
        const response = await fetch('/worker-counts');
        const result = await response.json();
        
        if (result.success) {
            state.workerCounts = result.workerCounts;
            
            // Update worker count display
            elements.recommendedWorkerCount.textContent = state.workerCounts.recommended;
            elements.extraWorkerCount.textContent = state.workerCounts.recommendedPlusOne;
            
            // Update worker count info with system details
            const { cpuCores, memoryGB } = state.workerCounts.systemInfo;
            elements.workerCountInfo.innerHTML = `
                The recommended count is based on your system's resources (${cpuCores} CPU cores, ${memoryGB}GB RAM). 
                Adding an extra worker may improve performance on some systems but could cause slowdowns on others.
            `;
            
            console.log('Worker counts fetched:', state.workerCounts);
        }
    } catch (error) {
        console.error('Error fetching worker counts:', error);
    }
}

// Upload overlay video
async function uploadOverlayVideo() {
    const file = elements.overlayInput.files[0];
    if (!file) {
        showStatus(elements.overlayStatus, 'Please select a video file', 'danger');
        return;
    }
    
    // Create FormData
    const formData = new FormData();
    formData.append('overlayVideo', file);
    
    try {
        showStatus(elements.overlayStatus, 'Uploading video...', 'info');
        
        const response = await fetch('/upload-overlay-video', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            state.overlayVideo = result.file;
            state.processedOverlayVideo = result.processedPath; // Store processed path
            
            // Show success message with optimization details
            const message = `Video uploaded and pre-processed successfully! (${result.savings} size reduction)`;
            showStatus(elements.overlayStatus, message, 'success');
            
            // Show video preview
            const videoPreview = elements.overlayPreview.querySelector('video');
            videoPreview.src = `/uploads/${result.file}`;
            elements.overlayPreview.classList.remove('d-none');
            
            checkReadyState();
        } else {
            showStatus(elements.overlayStatus, `Error: ${result.error}`, 'danger');
        }
    } catch (error) {
        console.error('Error uploading video:', error);
        showStatus(elements.overlayStatus, 'Error uploading video. Please try again.', 'danger');
    }
}

// Upload CSV file
async function uploadCsvFile() {
    const file = elements.csvInput.files[0];
    if (!file) {
        showStatus(elements.csvStatus, 'Please select a CSV file', 'danger');
        return;
    }
    
    // Create FormData
    const formData = new FormData();
    formData.append('csvFile', file);
    
    try {
        showStatus(elements.csvStatus, 'Uploading CSV...', 'info');
        
        const response = await fetch('/upload-csv', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            state.csvData = result.data;
            state.csvHeaders = result.headers;
            
            showStatus(elements.csvStatus, 'CSV uploaded successfully!', 'success');
            elements.csvPreview.classList.remove('d-none');
            
            // Show CSV mapping section
            populateCsvMappingOptions();
            elements.mapColumnsCard.style.display = 'block';
            
            checkReadyState();
        } else {
            showStatus(elements.csvStatus, `Error: ${result.error}`, 'danger');
        }
    } catch (error) {
        console.error('Error uploading CSV:', error);
        showStatus(elements.csvStatus, 'Error uploading CSV. Please try again.', 'danger');
    }
}

// Populate CSV mapping options
function populateCsvMappingOptions() {
    // Clear existing options
    elements.websiteColumn.innerHTML = '';
    elements.nameColumn.innerHTML = '';
    
    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = '-- Select Column --';
    
    elements.websiteColumn.appendChild(placeholderOption.cloneNode(true));
    elements.nameColumn.appendChild(placeholderOption.cloneNode(true));
    
    // Add options for each header
    state.csvHeaders.forEach((header, index) => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        
        elements.websiteColumn.appendChild(option.cloneNode(true));
        elements.nameColumn.appendChild(option.cloneNode(true));
        
        // Auto-select columns if they contain certain keywords
        if (header.toLowerCase().includes('website') || header.toLowerCase().includes('url')) {
            elements.websiteColumn.value = header;
            state.mappings.website = header;
        }
        
        if (header.toLowerCase().includes('name') || header.toLowerCase().includes('company')) {
            elements.nameColumn.value = header;
            state.mappings.name = header;
        }
    });
    
    // Display CSV preview table
    updateCsvPreviewTable();
    
    // Update mappings based on auto-selection
    updateMappings();
}

// Update CSV preview table
function updateCsvPreviewTable() {
    // Clear existing table
    elements.csvHeaderRow.innerHTML = '';
    elements.csvDataRows.innerHTML = '';
    
    // Add headers
    state.csvHeaders.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        elements.csvHeaderRow.appendChild(th);
    });
    
    // Add data rows (up to 5 rows for preview)
    const previewRows = state.csvData.slice(0, 5);
    previewRows.forEach(row => {
        const tr = document.createElement('tr');
        
        state.csvHeaders.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header] || '';
            tr.appendChild(td);
        });
        
        elements.csvDataRows.appendChild(tr);
    });
}

// Update mappings when dropdown selection changes
function updateMappings() {
    state.mappings.website = elements.websiteColumn.value;
    state.mappings.name = elements.nameColumn.value;
    
    checkReadyState();
}

// Check if ready to create videos
function checkReadyState() {
    const isReady = state.overlayVideo && 
                    state.csvData && 
                    state.mappings.website && 
                    state.mappings.name;
    
    elements.createVideosBtn.disabled = !isReady;
    
    // Show processing options card if ready
    if (isReady) {
        elements.processingOptionsCard.style.display = 'block';
    }
}

// Start video creation process
async function startVideoCreation() {
    if (state.processing) return;
    
    state.processing = true;
    state.results = [];
    
    // Show results card
    elements.resultsCard.style.display = 'block';
    elements.createVideosBtn.disabled = true;
    
    // Check if using parallel processing and extra worker
    const useParallelProcessing = elements.parallelProcessingToggle.checked;
    const useExtraWorker = useParallelProcessing && elements.extraWorker.checked;
    
    // Prepare data for processing
    const processData = {
        overlayVideo: state.overlayVideo,
        processedOverlayVideo: state.processedOverlayVideo,
        mappings: state.mappings,
        rows: state.csvData,
        useParallelProcessing: useParallelProcessing,
        useExtraWorker: useExtraWorker
    };
    
    try {
        const workerInfo = useParallelProcessing 
            ? (useExtraWorker 
                ? ` (using ${state.workerCounts.recommendedPlusOne} workers)`
                : ` (using ${state.workerCounts.recommended} workers)`)
            : ' (sequential processing)';
            
        showStatus(elements.processingStatus, 'Starting video creation process...' + workerInfo, 'info');
        
        const response = await fetch('/create-videos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(processData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Set up event source for progress updates
            setupProgressUpdates(result.jobId);
        } else {
            showStatus(elements.processingStatus, `Error: ${result.error}`, 'danger');
            state.processing = false;
            elements.createVideosBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error starting video creation:', error);
        showStatus(elements.processingStatus, 'Error starting video creation. Please try again.', 'danger');
        state.processing = false;
        elements.createVideosBtn.disabled = false;
    }
}

// Set up SSE for progress updates
function setupProgressUpdates(jobId) {
    const eventSource = new EventSource(`/progress/${jobId}`);
    
    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        // Update progress bar
        elements.totalProgress.style.width = `${data.progress}%`;
        elements.totalProgress.textContent = `${data.progress}%`;
        
        // Update status message with processing info
        let processingInfo = '';
        if (data.useParallelProcessing) {
            const workerCount = data.useExtraWorker ? state.workerCounts.recommendedPlusOne : state.workerCounts.recommended;
            processingInfo = ` (using ${workerCount} workers)`;
        } else {
            processingInfo = ' (using sequential processing)';
        }
        
        showStatus(elements.processingStatus, data.message + processingInfo, 'info');
        
        // Update results if available
        if (data.results && data.results.length > 0) {
            updateResults(data.results);
        }
        
        // Check if complete
        if (data.complete) {
            eventSource.close();
            state.processing = false;
            elements.createVideosBtn.disabled = false;
            showStatus(elements.processingStatus, 'All videos have been created successfully!', 'success');
        }
    };
    
    eventSource.onerror = function() {
        eventSource.close();
        state.processing = false;
        elements.createVideosBtn.disabled = false;
        showStatus(elements.processingStatus, 'Error receiving progress updates.', 'warning');
    };
}

// Update results display
function updateResults(results) {
    state.results = results;
    elements.videoResults.innerHTML = '';
    
    results.forEach(result => {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';
        
        const card = document.createElement('div');
        card.className = 'card video-result-card h-100';
        
        const statusClass = result.status === 'completed' ? 'bg-success' : 
                           result.status === 'processing' ? 'bg-info' : 
                           result.status === 'error' ? 'bg-danger' : 'bg-warning';
        
        card.innerHTML = `
            <div class="card-header ${statusClass} text-white">
                <h6 class="mb-0">${result.name}</h6>
            </div>
            <div class="card-body">
                <p><strong>Website:</strong> ${result.website}</p>
                <p><strong>Status:</strong> 
                    <span class="status-indicator status-${result.status}"></span>
                    ${result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                </p>
                ${result.error ? `<p class="text-danger"><strong>Error:</strong> ${result.error}</p>` : ''}
                ${result.videoPath ? `
                    <div class="mt-3">
                        <a href="/output/${result.videoPath}" class="btn btn-sm btn-primary" download>Download Video</a>
                        <a href="/output/${result.videoPath}" class="btn btn-sm btn-secondary" target="_blank">View Video</a>
                    </div>
                ` : ''}
            </div>
        `;
        
        col.appendChild(card);
        elements.videoResults.appendChild(col);
    });
}

// Helper function to show status messages
function showStatus(element, message, type) {
    element.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
});
