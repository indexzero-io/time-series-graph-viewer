// Globals for data
let participants;
let timelineData;
let chartData;
let names;

// 1. Data Processing
function processData(participants, timelineData) {
    const names = Object.keys(participants);

    let currentValues = {};
    names.forEach(name => currentValues[name] = participants[name].initialValue);

    return timelineData.map((step, index) => {
        names.forEach(name => {
            if (step.changes && step.changes[name] !== undefined) {
                currentValues[name] += step.changes[name];
            }
        });

        const rankedNames = [...names].sort((a, b) => currentValues[b] - currentValues[a]);

        let rankMap = {};
        rankedNames.forEach((name, rank) => rankMap[name] = rank);

        let valuesForStep = {};
        names.forEach(name => {
            valuesForStep[name] = {
                value: currentValues[name],
                rank: rankMap[name] // 0 is 1st place, 1 is 2nd place, etc.
            };
        });

        return {
            stepIndex: index,
            timeLabel: step.timeLabel,
            values: valuesForStep
        };
    });
}

// 2. Build the D3.js Chart (Dynamic Sizing)
let width, height, innerWidth, innerHeight, xScale, yScale, svg, g, xAxisGroup, yAxisGroup, gridXGroup, gridYGroup, clipRect;
let lineGenerator;
let linesGroup, imagesGroup;
let imageElements = {};
let imageCircles = {};
let labelElements = {};

// Sizing configuration
const margin = { top: 60, right: 120, bottom: 60, left: 80 };
const transitionDuration = 800; // slightly faster for hotkeys

// Playback state
let currentStep = 0;
let isPlaying = false;
let animationTimeout;

// Rank sizes
const getRankSize = (rank) => {
    if (rank === 0) return 30; // 1st place radius
    if (rank === 1) return 24; // 2nd place radius
    if (rank === 2) return 18; // 3rd place radius
    return 14;                 // default radius
};

function initChart() {
    d3.select("#chart-container").selectAll("*").remove();

    width = window.innerWidth;
    height = window.innerHeight;
    innerWidth = width - margin.left - margin.right;
    innerHeight = height - margin.top - margin.bottom;

    svg = d3.select("#chart-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define clip path to hide lines ahead of current step
    const defs = svg.append("defs");
    clipRect = defs.append("clipPath")
        .attr("id", "clip-lines")
        .append("rect")
        .attr("x", 0)
        .attr("y", -margin.top)
        .attr("width", 0) // starts at 0 width
        .attr("height", height);

    xScale = d3.scaleLinear()
        .domain([0, chartData.length - 1])
        .range([0, innerWidth]);

    let minVal = Infinity, maxVal = -Infinity;
    chartData.forEach(d => {
        names.forEach(name => {
            if (d.values[name].value < minVal) minVal = d.values[name].value;
            if (d.values[name].value > maxVal) maxVal = d.values[name].value;
        });
    });

    yScale = d3.scaleLinear()
        .domain([minVal - 10, maxVal + 10])
        .range([innerHeight, 0]);

    // Axes & Grid
    xAxisGroup = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`);
    yAxisGroup = g.append("g").attr("class", "y-axis");
    gridXGroup = g.append("g").attr("class", "grid grid-x").attr("transform", `translate(0,${innerHeight})`);
    gridYGroup = g.append("g").attr("class", "grid grid-y");

    updateAxes();

    lineGenerator = d3.line()
        .x(d => xScale(d.stepIndex))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

    // Group for lines with clip-path
    linesGroup = g.append("g").attr("clip-path", "url(#clip-lines)");
    imagesGroup = g.append("g");

    // Draw full lines once
    names.forEach(name => {
        const fullLineData = chartData.map((d, i) => ({ stepIndex: i, value: d.values[name].value }));

        linesGroup.append("path")
            .datum(fullLineData)
            .attr("class", "line")
            .attr("stroke", participants[name].color)
            .attr("d", lineGenerator);
    });

    // Setup images
    names.forEach(name => {
        imageElements[name] = imagesGroup.append("g");

        // Define clip path for circular avatar
        defs.append("clipPath")
            .attr("id", `clip-circle-${name}`)
            .append("circle")
            .attr("class", "avatar-clip")
            .attr("r", getRankSize(chartData[0].values[name].rank))
            .attr("cx", 0)
            .attr("cy", 0);

        imageCircles[name] = imageElements[name].append("image")
            .attr("href", participants[name].imageUrl)
            .attr("clip-path", `url(#clip-circle-${name})`);

        labelElements[name] = imageElements[name].append("text")
            .attr("class", "participant-label")
            .style("fill", participants[name].color)
            .text(name);
    });

    renderStep(0, 0); // Render initial state without animation duration
}

function updateAxes() {
    const xAxis = d3.axisBottom(xScale).ticks(chartData.length).tickFormat(i => chartData[i] ? chartData[i].timeLabel : "");
    const yAxis = d3.axisLeft(yScale);

    gridXGroup.call(d3.axisBottom(xScale).ticks(chartData.length).tickSize(-innerHeight).tickFormat(''))
        .selectAll(".tick line").classed("grid-line", true);
    gridYGroup.call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''))
        .selectAll(".tick line").classed("grid-line", true);

    xAxisGroup.call(xAxis).selectAll("text").classed("axis-text", true);
    yAxisGroup.call(yAxis).selectAll("text").classed("axis-text", true);
    g.selectAll(".domain").classed("axis-line", true);
}

function renderStep(targetStep, duration = transitionDuration) {
    currentStep = targetStep;
    const targetX = xScale(currentStep);

    // Animate the clip rect width to reveal the lines precisely
    clipRect.transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attr("width", targetX);

    // Animate avatars and labels
    names.forEach(name => {
        const val = chartData[currentStep].values[name].value;
        const rank = chartData[currentStep].values[name].rank;
        const targetY = yScale(val);
        const radius = getRankSize(rank);

        // Move group
        imageElements[name].transition()
            .duration(duration)
            .ease(d3.easeLinear)
            .attr("transform", `translate(${targetX}, ${targetY})`);

        // Scale image and clip circle
        d3.select(`#clip-circle-${name} circle`).transition()
            .duration(duration)
            .attr("r", radius);

        imageCircles[name].transition()
            .duration(duration)
            .attr("x", -radius)
            .attr("y", -radius)
            .attr("width", radius * 2)
            .attr("height", radius * 2);

        // Move label
        labelElements[name].transition()
            .duration(duration)
            .attr("x", radius + 8)
            .attr("y", 5);
    });

    // Update button text if reached end
    if (currentStep >= chartData.length - 1 && isPlaying) {
        stopAnimation();
    }
}

function playNextStep() {
    if (currentStep < chartData.length - 1) {
        renderStep(currentStep + 1);
        animationTimeout = setTimeout(playNextStep, transitionDuration);
    } else {
        stopAnimation();
    }
}

function startAnimation() {
    if (currentStep >= chartData.length - 1) {
        renderStep(0, 0); // instantly reset
    }
    isPlaying = true;
    document.getElementById("start-btn").innerText = "Pause Animation";
    document.getElementById("start-btn").style.backgroundColor = "#ff9800"; // Orange for pause

    // Start after slight delay if we just reset
    setTimeout(() => {
        if (isPlaying) playNextStep();
    }, 50);
}

function stopAnimation() {
    isPlaying = false;
    clearTimeout(animationTimeout);
    document.getElementById("start-btn").innerText = currentStep >= chartData.length - 1 ? "Restart Animation" : "Resume Animation";
    document.getElementById("start-btn").style.backgroundColor = "#4CAF50"; // Green for start
}

// 4. Event Listeners
document.getElementById("start-btn").addEventListener("click", () => {
    if (isPlaying) {
        stopAnimation();
    } else {
        startAnimation();
    }
});

window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (isPlaying) stopAnimation();

        if (e.key === "ArrowLeft" && currentStep > 0) {
            renderStep(currentStep - 1, transitionDuration / 2); // faster manual stepping
        } else if (e.key === "ArrowRight" && currentStep < chartData.length - 1) {
            renderStep(currentStep + 1, transitionDuration / 2);
        }
    }
});

// 5. Window Resize handling
window.addEventListener("resize", () => {
    if (animationTimeout) clearTimeout(animationTimeout);
    const savedStep = currentStep; // Save current step before initChart resets it
    initChart();
    renderStep(savedStep, 0); // re-render at current step instantly
    if (isPlaying) playNextStep();
});

// Initialize on load
async function loadDataAndInit() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();

        participants = data.participants;
        timelineData = data.timelineData;

        chartData = processData(participants, timelineData);
        names = Object.keys(participants);

        initChart();
    } catch (error) {
        console.error("Failed to load data:", error);
    }
}

loadDataAndInit();
