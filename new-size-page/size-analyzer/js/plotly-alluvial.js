// Plotly-based Alluvial Chart Implementation

class PlotlyAlluvialChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        // Color scheme
        this.colors = {
            unchanged: '#95a5a6',
            decreased: '#27ae60',
            increased: '#e74c3c'
        };
        
        this.init();
    }
    
    init() {
        // Clear any existing content
        this.container.innerHTML = '';
        
        // Set up container dimensions
        this.updateDimensions();
        
        // Set up resize handler
        window.addEventListener('resize', () => this.handleResize());
    }
    
    updateDimensions() {
        const container = this.container.parentElement;
        this.width = container.clientWidth;
        this.height = 600;
    }
    
    handleResize() {
        this.updateDimensions();
        if (this.currentData) {
            this.render(this.currentData, this.maxFiles);
        }
    }
    
    render(data, maxFiles = 25) {
        this.currentData = data;
        this.maxFiles = maxFiles;
        
        if (!data || data.length === 0) {
            this.showMessage('No data to display');
            return;
        }
        
        // Prepare data for Plotly Sankey
        const sankeyData = this.preparePlotlyData(data, maxFiles);
        
        // Create Plotly Sankey diagram
        this.createPlotlySankey(sankeyData);
    }
    
    preparePlotlyData(comparisons, maxFiles = 25) {
        // Filter and limit data for better visualization
        const filteredComparisons = comparisons
            .filter(comp => {
                const maxSize = Math.max(comp.size1 || 0, comp.size2 || 0);
                const hasSignificantChange = Math.abs((comp.size2 || 0) - (comp.size1 || 0)) > 100;
                return maxSize > 1000 || hasSignificantChange;
            })
            .sort((a, b) => {
                // Sort by largest absolute change first, then by size
                const changeA = Math.abs((a.size2 || 0) - (a.size1 || 0));
                const changeB = Math.abs((b.size2 || 0) - (b.size1 || 0));
                if (changeA !== changeB) return changeB - changeA;
                return Math.max(b.size1 || 0, b.size2 || 0) - Math.max(a.size1 || 0, a.size2 || 0);
            })
            .slice(0, maxFiles);
        
        console.log('Filtered comparisons:', filteredComparisons.length);
        
        const nodes = [];
        const nodeColors = [];
        const sources = [];
        const targets = [];
        const values = [];
        const linkColors = [];
        const linkLabels = [];
        
        // Create a simpler node structure - just add unique filenames
        const processedFiles = new Set();
        
        filteredComparisons.forEach((comp, index) => {
            const fileName = this.truncateFileName(comp.compileUnit);
            
            if (!processedFiles.has(fileName)) {
                // Add Version 1 node
                nodes.push(`${fileName} (V1)`);
                nodeColors.push(this.colors[comp.changeType]);
                
                // Add Version 2 node  
                nodes.push(`${fileName} (V2)`);
                nodeColors.push(this.colors[comp.changeType]);
                
                // Create link between them
                const v1Index = nodes.length - 2; // V1 node index
                const v2Index = nodes.length - 1; // V2 node index
                
                sources.push(v1Index);
                targets.push(v2Index);
                values.push(Math.max(comp.size1 || 0, comp.size2 || 0));
                linkColors.push(this.colors[comp.changeType] + '80'); // Add transparency
                const change = (comp.size2 || 0) - (comp.size1 || 0);
                const percentChange = comp.size1 > 0 ? ((change / comp.size1) * 100) : 0;
                const changeSign = change >= 0 ? '+' : '';
                linkLabels.push(`${comp.compileUnit}<br>V1: ${this.formatBytes(comp.size1)}<br>V2: ${this.formatBytes(comp.size2)}<br>Change: ${changeSign}${this.formatBytes(change)} (${changeSign}${percentChange.toFixed(1)}%)<br>Type: ${comp.changeType.toUpperCase()}`);
                
                processedFiles.add(fileName);
            }
        });
        
        console.log('Prepared data:', {
            nodes: nodes.length,
            links: sources.length,
            sampleNode: nodes[0],
            sampleLink: { source: sources[0], target: targets[0], value: values[0] }
        });
        
        return {
            nodes: nodes,
            nodeColors: nodeColors,
            sources: sources,
            targets: targets,
            values: values,
            linkColors: linkColors,
            linkLabels: linkLabels
        };
    }
    
    createPlotlySankey(sankeyData) {
        const data = [{
            type: "sankey",
            orientation: "h",
            node: {
                pad: 15,
                thickness: 20,
                line: {
                    color: "black",
                    width: 0.5
                },
                label: sankeyData.nodes,
                color: sankeyData.nodeColors,
                hovertemplate: '%{label}<br>Size: %{value}<br>Click for details<extra></extra>'
            },
            link: {
                source: sankeyData.sources,
                target: sankeyData.targets,
                value: sankeyData.values,
                color: sankeyData.linkColors,
                hovertemplate: '%{customdata}<extra></extra>',
                customdata: sankeyData.linkLabels
            }
        }];
        
        const layout = {
            title: {
                text: "File Size Changes Between Versions",
                font: { size: 16, color: '#2c3e50' }
            },
            width: this.width,
            height: this.height,
            margin: { l: 20, r: 20, t: 60, b: 20 },
            font: { size: 11, family: 'Arial, sans-serif' },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            annotations: [{
                text: "Version 1 → Version 2",
                showarrow: false,
                x: 0.5,
                y: -0.1,
                xref: 'paper',
                yref: 'paper',
                font: { size: 12, color: '#666' }
            }]
        };
        
        const config = {
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'zoomIn2d', 'zoomOut2d'],
            displaylogo: false,
            responsive: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'dmengine_size_comparison',
                height: this.height,
                width: this.width,
                scale: 1
            }
        };
        
        Plotly.newPlot(this.containerId, data, layout, config);
        
        // Add click event listeners for additional interactivity
        this.addInteractivity();
        
        console.log('Plotly Sankey created with data:', {
            nodes: sankeyData.nodes.length,
            links: sankeyData.sources.length,
            maxValue: Math.max(...sankeyData.values)
        });
    }
    
    showMessage(message) {
        this.container.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 400px;
                font-size: 18px;
                color: #666;
            ">${message}</div>
        `;
    }
    
    truncateFileName(filename) {
        return filename.length > 25 
            ? '...' + filename.slice(-22)
            : filename;
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }
    
    // Zoom control methods (Plotly handles zoom internally)
    zoomIn() {
        // Plotly handles zoom with mouse wheel
        console.log('Use mouse wheel to zoom');
    }
    
    zoomOut() {
        // Plotly handles zoom with mouse wheel
        console.log('Use mouse wheel to zoom');
    }
    
    resetZoom() {
        Plotly.relayout(this.containerId, {
            'xaxis.autorange': true,
            'yaxis.autorange': true
        });
    }
    
    fitToView() {
        this.resetZoom();
    }
    
    addInteractivity() {
        const plotElement = document.getElementById(this.containerId);
        
        // Add hover events
        plotElement.on('plotly_hover', (data) => {
            console.log('Hovered:', data);
        });
        
        // Add click events for nodes and links
        plotElement.on('plotly_click', (data) => {
            console.log('Clicked:', data);
            this.handleElementClick(data);
        });
        
        // Add double-click to reset view
        plotElement.on('plotly_doubleclick', () => {
            this.resetZoom();
        });
    }
    
    handleElementClick(data) {
        if (data.points && data.points.length > 0) {
            const point = data.points[0];
            
            // Show detailed information about the clicked element
            if (point.pointNumber !== undefined) {
                this.showDetailedInfo(point);
            }
        }
    }
    
    showDetailedInfo(point) {
        // Create a detailed info display
        const info = document.createElement('div');
        info.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 500px;
            font-family: Arial, sans-serif;
        `;
        
        // Extract more meaningful information from the point
        const isNode = point.pointNumber !== undefined && point.fullData && point.fullData.type === 'sankey';
        const label = point.label || 'N/A';
        const value = point.value || 0;
        
        let detailContent = '';
        if (isNode) {
            detailContent = `
                <h3 style="margin-top: 0; color: #2c3e50;">Node Details</h3>
                <p><strong>File:</strong> ${label}</p>
                <p><strong>Size:</strong> ${this.formatBytes(value)}</p>
                <p><strong>Type:</strong> ${label.includes('(V1)') ? 'Version 1' : 'Version 2'}</p>
            `;
        } else {
            detailContent = `
                <h3 style="margin-top: 0; color: #2c3e50;">Link Details</h3>
                <p><strong>Connection:</strong> ${label}</p>
                <p><strong>Flow Size:</strong> ${this.formatBytes(value)}</p>
            `;
        }
        
        info.innerHTML = `
            ${detailContent}
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="this.parentElement.remove()" style="
                    padding: 8px 16px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Close</button>
            </div>
        `;
        
        document.body.appendChild(info);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (info.parentElement) {
                info.remove();
            }
        }, 8000);
    }
}