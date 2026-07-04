// Globals for data
const DYNAMIC_ZOOM = true;
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
let lineElements = {};
let imageElements = {};
let imageCircles = {};
let labelElements = {};
let globalMinVal, globalMaxVal;

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
        .domain(DYNAMIC_ZOOM ? [0, 1] : [0, chartData.length - 1])
        .range([0, innerWidth]);

    globalMinVal = Infinity;
    globalMaxVal = -Infinity;

    if (DYNAMIC_ZOOM) {
        // Init with step 0 values
        names.forEach(name => {
            if (chartData[0].values[name].value < globalMinVal) globalMinVal = chartData[0].values[name].value;
            if (chartData[0].values[name].value > globalMaxVal) globalMaxVal = chartData[0].values[name].value;
        });
    } else {
        chartData.forEach(d => {
            names.forEach(name => {
                if (d.values[name].value < globalMinVal) globalMinVal = d.values[name].value;
                if (d.values[name].value > globalMaxVal) globalMaxVal = d.values[name].value;
            });
        });
    }

    yScale = d3.scaleLinear()
        .domain([globalMinVal - 10, globalMaxVal + 10])
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

    lineElements = {};

    // Draw full lines once
    names.forEach(name => {
        const fullLineData = chartData.map((d, i) => ({ stepIndex: i, value: d.values[name].value }));

        lineElements[name] = linesGroup.append("path")
            .datum(fullLineData)
            .attr("class", "line")
            .attr("stroke", participants[name].color)
            .attr("d", lineGenerator)
            .style("cursor", "pointer");
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
            .style("display", "none")
            .text(name);

        imageElements[name].style("cursor", "pointer");

        // Hover interactivity to bring line and image to front
        const bringToFront = () => {
            lineElements[name].raise();
            imageElements[name].raise();
        };

        lineElements[name].on("mouseover", bringToFront);
        imageElements[name].on("mouseover", bringToFront);
    });

    renderStep(0, 0); // Render initial state without animation duration
}

function updateAxes(duration = 0) {
    // Generate valid ticks for the current X domain to avoid fractional ticks
    const xDomain = xScale.domain();
    const maxTick = Math.ceil(xDomain[1]);
    const tickValues = d3.range(0, maxTick + 1);

    const xAxis = d3.axisBottom(xScale)
        .tickValues(tickValues)
        .tickFormat(i => chartData[i] ? chartData[i].timeLabel : "");
    const yAxis = d3.axisLeft(yScale);

    // Transition axes and grid
    const trans = d3.transition().duration(duration).ease(d3.easeLinear);

    gridXGroup.transition(trans).call(d3.axisBottom(xScale).tickValues(tickValues).tickSize(-innerHeight).tickFormat(''))
        .on("end", function() { d3.select(this).selectAll(".tick line").classed("grid-line", true); });
    gridYGroup.transition(trans).call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''))
        .on("end", function() { d3.select(this).selectAll(".tick line").classed("grid-line", true); });

    xAxisGroup.transition(trans).call(xAxis)
        .on("end", function() {
            d3.select(this).selectAll("text").classed("axis-text", true);

            // Handle line breaks \n in X axis labels
            d3.select(this).selectAll(".tick text").each(function() {
                const el = d3.select(this);
                // Handle both actual newlines and escaped newlines
                const textContent = el.text();
                // Skip empty strings
                if (!textContent) return;

                // If it already has tspan, we need to extract original text
                let rawText = textContent;
                if (el.selectAll("tspan").size() > 0) {
                   rawText = el.selectAll("tspan").nodes().map(n => d3.select(n).text()).join("\\n");
                }

                const lines = rawText.includes("\\n") ? rawText.split("\\n") : rawText.split("\n");
                if (lines.length > 1) {
                    el.text(""); // Clear existing text
                    lines.forEach((line, i) => {
                        el.append("tspan")
                          .attr("x", 0)
                          .attr("y", 9)
                          .attr("dy", `${i * 1.2}em`)
                          .text(line);
                    });
                }
            });
        });

    yAxisGroup.transition(trans).call(yAxis)
        .on("end", function() { d3.select(this).selectAll("text").classed("axis-text", true); });

    g.selectAll(".domain").classed("axis-line", true);
}

function renderStep(targetStep, duration = transitionDuration) {
    currentStep = targetStep;

    if (DYNAMIC_ZOOM) {
        // Find new max Y across all names for the current step
        let newMaxY = -Infinity;
        names.forEach(name => {
            if (chartData[currentStep].values[name].value > newMaxY) {
                newMaxY = chartData[currentStep].values[name].value;
            }
        });

        // Update Y global max if necessary, or strictly follow current max for zoom out
        if (newMaxY > globalMaxVal) {
            globalMaxVal = newMaxY;
        }

        // Update scales dynamically
        xScale.domain([0, Math.max(1, currentStep)]);
        yScale.domain([globalMinVal - 10, globalMaxVal + 10]);

        // Transition the axes
        updateAxes(duration);

        // Transition the lines to their new scales
        names.forEach(name => {
            const fullLineData = chartData.map((d, i) => ({ stepIndex: i, value: d.values[name].value }));
            lineElements[name].transition()
                .duration(duration)
                .ease(d3.easeLinear)
                .attr("d", lineGenerator(fullLineData));
        });
    }

    const targetX = xScale(currentStep);

    // Animate the clip rect width to reveal the lines precisely
    clipRect.transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attr("width", targetX);

    // Sort names by rank so highest rank is placed first (on the left)
    const sortedNames = [...names].sort((a, b) => {
        return chartData[currentStep].values[a].rank - chartData[currentStep].values[b].rank;
    });

    const placedAvatars = [];
    const gap = 4;

    // Animate avatars and labels
    sortedNames.forEach(name => {
        const val = chartData[currentStep].values[name].value;
        const rank = chartData[currentStep].values[name].rank;
        const targetY = yScale(val);
        const radius = getRankSize(rank);

        let finalX = targetX;
        let finalY = targetY;

        let hasOverlap = true;
        let loopGuard = 0;
        while (hasOverlap && loopGuard < 100) {
            hasOverlap = false;
            loopGuard++;
            for (let i = 0; i < placedAvatars.length; i++) {
                const p = placedAvatars[i];
                const dx = finalX - p.x;
                const dy = finalY - p.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = radius + p.radius + gap;

                if (distance < minDistance) {
                    const neededX = p.x + Math.sqrt(minDistance * minDistance - dy * dy);
                    if (neededX > finalX + 0.001) {
                        finalX = neededX;
                        hasOverlap = true;
                    }
                }
            }
        }

        placedAvatars.push({ x: finalX, y: finalY, radius: radius });

        // Move group
        imageElements[name].transition()
            .duration(duration)
            .ease(d3.easeLinear)
            .attr("transform", `translate(${finalX}, ${finalY})`);

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

    // Auto stop if reached end
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

    // Start after slight delay if we just reset
    setTimeout(() => {
        if (isPlaying) playNextStep();
    }, 50);
}

function stopAnimation() {
    isPlaying = false;
    clearTimeout(animationTimeout);
}

// 4. Event Listeners
window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        e.preventDefault(); // Prevent default page scroll
        if (isPlaying) {
            stopAnimation();
        } else {
            startAnimation();
        }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
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
function loadDataAndInit() {
    participants = chartDataConfig.participants;
    timelineData = chartDataConfig.timelineData;

    chartData = processData(participants, timelineData);
    names = Object.keys(participants);

    initChart();
}

loadDataAndInit();
