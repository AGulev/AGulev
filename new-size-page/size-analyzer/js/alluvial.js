// Alluvial Diagram Visualization Module

class AlluvialChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = d3.select(`#${containerId}`);
        this.margin = { top: 20, right: 40, bottom: 20, left: 40 };
        this.tooltip = d3.select('#tooltip');
        
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
        this.svg.selectAll('*').remove();
        
        // Set up responsive dimensions
        this.updateDimensions();
        
        // Create zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => this.handleZoom(event));
        
        // Apply zoom to SVG
        this.svg.call(this.zoom);
        
        // Create main group that will be transformed by zoom
        this.g = this.svg.append('g')
            .attr('class', 'zoom-group')
            .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
        
        // Create groups for nodes and links
        this.linksGroup = this.g.append('g').attr('class', 'links');
        this.nodesGroup = this.g.append('g').attr('class', 'nodes');
        
        // Set up resize handler
        window.addEventListener('resize', () => this.handleResize());
    }
    
    updateDimensions() {
        const container = this.svg.node().parentElement;
        this.width = container.clientWidth - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;
        
        this.svg
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);
    }
    
    handleResize() {
        this.updateDimensions();
        if (this.currentData) {
            this.render(this.currentData);
        }
    }
    
    handleZoom(event) {
        // Apply zoom transform to the main group
        this.g.attr('transform', 
            `translate(${this.margin.left}, ${this.margin.top}) ${event.transform}`
        );
    }
    
    // Zoom control methods
    zoomIn() {
        this.svg.transition().duration(300).call(
            this.zoom.scaleBy, 1.5
        );
    }
    
    zoomOut() {
        this.svg.transition().duration(300).call(
            this.zoom.scaleBy, 1 / 1.5
        );
    }
    
    resetZoom() {
        this.svg.transition().duration(500).call(
            this.zoom.transform,
            d3.zoomIdentity.translate(0, 0).scale(1)
        );
    }
    
    fitToView() {
        if (!this.currentData || this.currentData.length === 0) return;
        
        // Calculate bounds of all elements
        const bounds = this.g.node().getBBox();
        const parent = this.svg.node().parentElement;
        const fullWidth = parent.clientWidth;
        const fullHeight = parent.clientHeight;
        
        const width = bounds.width;
        const height = bounds.height;
        const midX = bounds.x + width / 2;
        const midY = bounds.y + height / 2;
        
        if (width === 0 || height === 0) return;
        
        // Calculate scale to fit content
        const scale = Math.min(
            fullWidth / width,
            fullHeight / height
        ) * 0.9; // 90% to add some padding
        
        // Calculate translation to center
        const translate = [
            fullWidth / 2 - scale * midX,
            fullHeight / 2 - scale * midY
        ];
        
        this.svg.transition().duration(750).call(
            this.zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }
    
    render(data) {
        this.currentData = data;
        
        // Clear existing content
        this.linksGroup.selectAll('*').remove();
        this.nodesGroup.selectAll('*').remove();
        
        if (!data || data.length === 0) {
            this.showMessage('No data to display');
            return;
        }
        
        // Prepare data for sankey
        const sankeyData = this.prepareSankeyData(data);
        
        // Try custom layout if Sankey isn't working
        const graph = this.createCustomLayout(sankeyData);
        
        console.log('Custom graph:', graph);
        
        // Draw links
        this.drawLinks(graph.links);
        
        // Draw nodes
        this.drawNodes(graph.nodes);
    }
    
    prepareSankeyData(comparisons) {
        // Filter and limit data for better visualization
        const maxFiles = 30;
        const filteredComparisons = comparisons
            .filter(comp => Math.max(comp.size1 || 0, comp.size2 || 0) > 1000) // Only meaningful sizes
            .sort((a, b) => Math.max(b.size1, b.size2) - Math.max(a.size1, a.size2))
            .slice(0, maxFiles);
        
        const nodes = [];
        const links = [];
        let nodeIndex = 0;
        
        // Create nodes for version 1 (left column)
        filteredComparisons.forEach((comp, index) => {
            const size1 = comp.size1 || 0;
            const fileName = this.truncateFileName(comp.compileUnit);
            
            if (size1 > 0) {
                nodes.push({
                    id: `v1_${index}`,
                    name: fileName,
                    fullName: comp.compileUnit,
                    version: 1,
                    changeType: comp.changeType,
                    comparison: comp,
                    column: 0 // Left column
                });
            }
        });
        
        // Create nodes for version 2 (right column)
        filteredComparisons.forEach((comp, index) => {
            const size2 = comp.size2 || 0;
            const fileName = this.truncateFileName(comp.compileUnit);
            
            if (size2 > 0) {
                nodes.push({
                    id: `v2_${index}`,
                    name: fileName,
                    fullName: comp.compileUnit,
                    version: 2,
                    changeType: comp.changeType,
                    comparison: comp,
                    column: 1 // Right column
                });
            }
        });
        
        // Create links between matching files
        filteredComparisons.forEach((comp, index) => {
            const size1 = comp.size1 || 0;
            const size2 = comp.size2 || 0;
            
            if (size1 > 0 && size2 > 0) {
                // Link from version 1 to version 2
                links.push({
                    source: `v1_${index}`,
                    target: `v2_${index}`,
                    value: Math.max(size1, size2), // Flow thickness
                    changeType: comp.changeType,
                    comparison: comp,
                    size1: size1,
                    size2: size2
                });
            } else if (size1 > 0) {
                // File exists only in version 1 - create dummy target
                const dummyTarget = `dummy_v2_${index}`;
                nodes.push({
                    id: dummyTarget,
                    name: '',
                    fullName: comp.compileUnit,
                    version: 2,
                    changeType: 'decreased',
                    comparison: comp,
                    column: 1,
                    isDummy: true
                });
                
                links.push({
                    source: `v1_${index}`,
                    target: dummyTarget,
                    value: size1,
                    changeType: 'decreased',
                    comparison: comp,
                    size1: size1,
                    size2: 0
                });
            } else if (size2 > 0) {
                // File exists only in version 2 - create dummy source
                const dummySource = `dummy_v1_${index}`;
                nodes.push({
                    id: dummySource,
                    name: '',
                    fullName: comp.compileUnit,
                    version: 1,
                    changeType: 'increased',
                    comparison: comp,
                    column: 0,
                    isDummy: true
                });
                
                links.push({
                    source: dummySource,
                    target: `v2_${index}`,
                    value: size2,
                    changeType: 'increased',
                    comparison: comp,
                    size1: 0,
                    size2: size2
                });
            }
        });
        
        return { nodes, links };
    }
    
    truncateFileName(filename) {
        return filename.length > 25 
            ? '...' + filename.slice(-22)
            : filename;
    }
    
    createCustomLayout(sankeyData) {
        const { nodes, links } = sankeyData;
        const nodeWidth = 15;
        const nodePadding = 8;
        const leftX = 100;
        const rightX = this.width - 100 - nodeWidth;
        const availableHeight = this.height - 40;
        
        // Separate nodes by version/column
        const leftNodes = nodes.filter(n => n.column === 0);
        const rightNodes = nodes.filter(n => n.column === 1);
        
        // Calculate total size for each column to proportion heights
        const leftTotalSize = leftNodes.reduce((sum, n) => sum + (n.comparison?.size1 || 1), 0);
        const rightTotalSize = rightNodes.reduce((sum, n) => sum + (n.comparison?.size2 || 1), 0);
        
        let leftY = 20;
        let rightY = 20;
        
        // Position left nodes
        leftNodes.forEach(node => {
            const nodeSize = node.comparison?.size1 || 1;
            const nodeHeight = Math.max(4, (nodeSize / leftTotalSize) * availableHeight);
            
            node.x0 = leftX;
            node.x1 = leftX + nodeWidth;
            node.y0 = leftY;
            node.y1 = leftY + nodeHeight;
            
            leftY += nodeHeight + nodePadding;
        });
        
        // Position right nodes
        rightNodes.forEach(node => {
            const nodeSize = node.comparison?.size2 || 1;
            const nodeHeight = Math.max(4, (nodeSize / rightTotalSize) * availableHeight);
            
            node.x0 = rightX;
            node.x1 = rightX + nodeWidth;
            node.y0 = rightY;
            node.y1 = rightY + nodeHeight;
            
            rightY += nodeHeight + nodePadding;
        });
        
        // Calculate link positions
        links.forEach(link => {
            const sourceNode = nodes.find(n => n.id === link.source);
            const targetNode = nodes.find(n => n.id === link.target);
            
            if (sourceNode && targetNode) {
                link.source = sourceNode;
                link.target = targetNode;
                
                // Calculate link thickness based on value
                const maxValue = Math.max(...links.map(l => l.value));
                link.width = Math.max(2, (link.value / maxValue) * 50);
                
                // Position link at center of nodes
                link.y0 = sourceNode.y0 + (sourceNode.y1 - sourceNode.y0) / 2 - link.width / 2;
                link.y1 = link.y0 + link.width;
            }
        });
        
        return { nodes, links };
    }
    
    drawLinks(links) {
        const link = this.linksGroup.selectAll('.link')
            .data(links)
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d => this.createCurvedPath(d))
            .attr('stroke', d => this.colors[d.changeType] || '#ddd')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => Math.max(2, d.width || 2))
            .attr('fill', 'none')
            .style('mix-blend-mode', 'multiply')
            .on('mouseover', (event, d) => this.showLinkTooltip(event, d))
            .on('mouseout', () => this.hideTooltip())
            .on('mousemove', event => this.moveTooltip(event));
        
        // Add hover effects
        link.on('mouseenter', function(event, d) {
            d3.select(this)
                .attr('stroke-opacity', 0.9)
                .attr('stroke-width', d => Math.max(3, (d.width || 2) + 1));
        }).on('mouseleave', function(event, d) {
            d3.select(this)
                .attr('stroke-opacity', 0.6)
                .attr('stroke-width', d => Math.max(2, d.width || 2));
        });
    }
    
    createCurvedPath(d) {
        // Check if we have proper source and target nodes
        if (!d.source || !d.target) {
            console.log('Missing source or target:', d);
            return '';
        }
        
        // Use the Sankey-generated coordinates if available, otherwise create our own
        const x0 = d.source.x1 || d.source.x + 15;
        const x1 = d.target.x0 || d.target.x;
        const y0 = d.y0 || d.source.y;
        const y1 = d.y1 || d.source.y + (d.width || 2);
        const y2 = d.y0 + (d.target.y - d.source.y) || d.target.y;
        const y3 = d.y1 + (d.target.y - d.source.y) || d.target.y + (d.width || 2);
        
        // Create curved path
        const curvature = 0.5;
        const xi = d3.interpolateNumber(x0, x1);
        const x2 = xi(curvature);
        const x3 = xi(1 - curvature);
        
        return `M${x0},${y0}C${x2},${y0} ${x3},${y2} ${x1},${y2}L${x1},${y3}C${x3},${y3} ${x2},${y1} ${x0},${y1}Z`;
    }
    
    drawNodes(nodes) {
        const node = this.nodesGroup.selectAll('.node')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);
        
        // Create drag behavior for nodes
        const drag = d3.drag()
            .on('start', (event, d) => this.dragStarted(event, d))
            .on('drag', (event, d) => this.dragged(event, d))
            .on('end', (event, d) => this.dragEnded(event, d));

        // Draw node rectangles with proper sizing
        node.append('rect')
            .attr('height', d => Math.max(3, d.y1 - d.y0)) // Minimum height for visibility
            .attr('width', d => d.x1 - d.x0)
            .attr('fill', d => {
                if (d.isDummy) return 'transparent';
                return this.colors[d.changeType] || '#ddd';
            })
            .attr('stroke', d => d.isDummy ? 'transparent' : '#333')
            .attr('stroke-width', d => d.isDummy ? 0 : 1)
            .attr('rx', 2) // Slightly rounded corners
            .style('cursor', d => d.isDummy ? 'default' : 'move')
            .call(d => d.isDummy ? null : drag)
            .on('mouseover', (event, d) => {
                if (!d.isDummy) this.showNodeTooltip(event, d);
            })
            .on('mouseout', () => this.hideTooltip())
            .on('mousemove', event => this.moveTooltip(event));
        
        // Add node labels (only show for larger nodes and not dummy nodes)
        node.append('text')
            .attr('x', d => (d.x1 - d.x0) / 2)
            .attr('y', d => (d.y1 - d.y0) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .style('font-size', '8px')
            .style('font-weight', 'bold')
            .style('fill', 'white')
            .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.7)')
            .style('display', d => {
                if (d.isDummy) return 'none';
                return (d.y1 - d.y0) > 15 ? 'block' : 'none';
            })
            .text(d => d.name || '');
    }
    
    showLinkTooltip(event, d) {
        const comp = d.comparison;
        const size1 = d.size1 || comp.size1;
        const size2 = d.size2 || comp.size2;
        const difference = size2 - size1;
        const percentChange = size1 > 0 ? ((difference / size1) * 100) : (size2 > 0 ? 100 : 0);
        
        const content = `
            <strong>${comp.compileUnit}</strong><br/>
            <span style="color: #666;">Flow thickness: ${this.formatBytes(d.value)}</span><br/>
            Version 1: ${this.formatBytes(size1)}<br/>
            Version 2: ${this.formatBytes(size2)}<br/>
            Change: ${this.formatBytes(difference)} (${this.formatPercentage(percentChange)})<br/>
            <span style="color: ${this.colors[comp.changeType]};">● ${comp.changeType.toUpperCase()}</span>
        `;
        
        this.showTooltip(event, content);
    }
    
    showNodeTooltip(event, d) {
        const comp = d.comparison;
        const nodeSize = d.value || comp[`size${d.version}`];
        const content = `
            <strong>${comp.compileUnit}</strong><br/>
            <span style="color: #666;">Version ${d.version}</span><br/>
            Size: ${this.formatBytes(nodeSize)}<br/>
            <span style="color: ${this.colors[comp.changeType]};">● ${comp.changeType.toUpperCase()}</span><br/>
            <em>Node height represents size</em>
        `;
        
        this.showTooltip(event, content);
    }
    
    showTooltip(event, content) {
        this.tooltip
            .html(content)
            .classed('visible', true);
        
        this.moveTooltip(event);
    }
    
    moveTooltip(event) {
        const [x, y] = d3.pointer(event, document.body);
        this.tooltip
            .style('left', (x + 10) + 'px')
            .style('top', (y - 10) + 'px');
    }
    
    hideTooltip() {
        this.tooltip.classed('visible', false);
    }
    
    showMessage(message) {
        this.g.selectAll('*').remove();
        
        this.g.append('text')
            .attr('x', this.width / 2)
            .attr('y', this.height / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '18px')
            .style('fill', '#666')
            .text(message);
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }
    
    formatPercentage(percent) {
        return (percent >= 0 ? '+' : '') + percent.toFixed(1) + '%';
    }
    
    // Drag event handlers
    dragStarted(event, d) {
        // Store initial position
        d.dragStartX = d.x0;
        d.dragStartY = d.y0;
        
        // Disable zoom during drag
        this.svg.on('.zoom', null);
        
        // Change cursor
        d3.select(event.sourceEvent.target).style('cursor', 'grabbing');
    }
    
    dragged(event, d) {
        // Calculate new position
        const dx = event.x - d.dragStartX;
        const dy = event.y - d.dragStartY;
        
        // Update node position
        d.x0 = d.dragStartX + dx;
        d.x1 = d.x0 + (d.x1 - d.dragStartX);
        d.y0 = d.dragStartY + dy;
        d.y1 = d.y0 + (d.y1 - d.dragStartY);
        
        // Update visual position
        d3.select(event.sourceEvent.target.parentNode)
            .attr('transform', `translate(${d.x0},${d.y0})`);
        
        // Update connected links
        this.updateLinks();
    }
    
    dragEnded(event, d) {
        // Re-enable zoom
        this.svg.call(this.zoom);
        
        // Reset cursor
        d3.select(event.sourceEvent.target).style('cursor', 'move');
    }
    
    updateLinks() {
        // Redraw all links to reflect new node positions
        this.linksGroup.selectAll('.link')
            .attr('d', d3.sankeyLinkHorizontal());
    }
}