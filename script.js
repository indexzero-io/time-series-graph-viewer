// 1. Data Structure Setup
const participants = {
    "Alice": {
        imageUrl: "https://i.pravatar.cc/150?u=Alice",
        color: "#ff6384",
        initialValue: 50
    },
    "Bob": {
        imageUrl: "https://i.pravatar.cc/150?u=Bob",
        color: "#36a2eb",
        initialValue: 60
    },
    "Charlie": {
        imageUrl: "https://i.pravatar.cc/150?u=Charlie",
        color: "#ffce56",
        initialValue: 40
    },
    "Diana": {
        imageUrl: "https://i.pravatar.cc/150?u=Diana",
        color: "#4bc0c0",
        initialValue: 45
    }
};

const timelineData = [
    { timeLabel: "Week 0", changes: { "Alice": 0, "Bob": 0, "Charlie": 0, "Diana": 0 } },
    { timeLabel: "Week 1", changes: { "Alice": 10, "Bob": -5, "Charlie": 15, "Diana": 5 } },
    { timeLabel: "Week 2", changes: { "Alice": -15, "Bob": 10, "Diana": 20 } },
    { timeLabel: "Week 3", changes: { "Alice": 5, "Bob": 25, "Charlie": -10 } },
    { timeLabel: "Week 4", changes: { "Bob": -10, "Charlie": 30, "Diana": 15 } },
    { timeLabel: "Week 5", changes: { "Alice": 20, "Bob": 5, "Charlie": -5, "Diana": -15 } },
    { timeLabel: "Week 6", changes: { "Alice": 15, "Bob": 20, "Charlie": 10, "Diana": 5 } }
];

// 2. Data Processing
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
                rank: rankMap[name]
            };
        });

        return {
            stepIndex: index,
            timeLabel: step.timeLabel,
            values: valuesForStep
        };
    });
}

const chartData = processData(participants, timelineData);
const names = Object.keys(participants);

// 3. Build the D3.js Chart
const width = 800;
const height = 500;
const margin = { top: 40, right: 100, bottom: 40, left: 60 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const xScale = d3.scaleLinear()
    .domain([0, chartData.length - 1])
    .range([0, innerWidth]);

let minVal = Infinity;
let maxVal = -Infinity;
chartData.forEach(d => {
    names.forEach(name => {
        if (d.values[name].value < minVal) minVal = d.values[name].value;
        if (d.values[name].value > maxVal) maxVal = d.values[name].value;
    });
});

const yScale = d3.scaleLinear()
    .domain([minVal - 10, maxVal + 10])
    .range([innerHeight, 0]);

const xAxis = d3.axisBottom(xScale)
    .ticks(chartData.length)
    .tickFormat(i => chartData[i] ? chartData[i].timeLabel : "");

const yAxis = d3.axisLeft(yScale);

g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(chartData.length).tickSize(-innerHeight).tickFormat(''))
    .selectAll(".tick line").classed("grid-line", true);

g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''))
    .selectAll(".tick line").classed("grid-line", true);

g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis)
    .selectAll("text").classed("axis-text", true);

g.append("g")
    .call(yAxis)
    .selectAll("text").classed("axis-text", true);

g.selectAll(".domain").classed("axis-line", true);

// 4. Implement Animations
const lineGenerator = d3.line()
    .x(d => xScale(d.stepIndex))
    .y(d => yScale(d.value))
    .curve(d3.curveMonotoneX); // Smooth curves

// Create groups for lines and images
const linesGroup = g.append("g").attr("class", "lines");
const imagesGroup = g.append("g").attr("class", "images");

let lines = {};
let imageElements = {};
let currentStep = 0;

// Setup initial state (Step 0)
names.forEach(name => {
    const dataForLine = [ { stepIndex: 0, value: chartData[0].values[name].value } ];

    // Draw initial lines
    lines[name] = linesGroup.append("path")
        .datum(dataForLine)
        .attr("class", "line")
        .attr("stroke", participants[name].color)
        .attr("d", lineGenerator);

    // Add initial images
    imageElements[name] = imagesGroup.append("g")
        .attr("transform", `translate(${xScale(0)}, ${yScale(chartData[0].values[name].value)})`);

    // Define clip path to make images circular
    const defs = svg.append("defs");
    defs.append("clipPath")
        .attr("id", `clip-circle-${name}`)
        .append("circle")
        .attr("r", 15)
        .attr("cx", 0)
        .attr("cy", 0);

    // Append image
    imageElements[name].append("image")
        .attr("href", participants[name].imageUrl)
        .attr("x", -15)
        .attr("y", -15)
        .attr("width", 30)
        .attr("height", 30)
        .attr("clip-path", `url(#clip-circle-${name})`);

    // Append label
    imageElements[name].append("text")
        .attr("x", 20)
        .attr("y", 4)
        .attr("class", "participant-label")
        .style("fill", participants[name].color)
        .text(name);
});

const transitionDuration = 1000;

function animateNextStep() {
    if (currentStep >= chartData.length - 1) {
        document.getElementById("start-btn").disabled = false;
        return; // Animation finished
    }

    currentStep++;

    names.forEach(name => {
        // Build data array for the line up to the current step
        const lineDataArray = [];
        for (let i = 0; i <= currentStep; i++) {
            lineDataArray.push({
                stepIndex: i,
                value: chartData[i].values[name].value
            });
        }

        // Animate Line drawing
        lines[name].datum(lineDataArray)
            .transition()
            .duration(transitionDuration)
            .ease(d3.easeLinear)
            .attr("d", lineGenerator);

        // Animate Image Moving
        const endX = xScale(currentStep);
        const endY = yScale(chartData[currentStep].values[name].value);

        imageElements[name]
            .transition()
            .duration(transitionDuration)
            .ease(d3.easeLinear)
            .attr("transform", `translate(${endX}, ${endY})`);
    });

    // Schedule next step
    setTimeout(animateNextStep, transitionDuration);
}

document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("start-btn").disabled = true;

    // Reset if already finished
    if (currentStep >= chartData.length - 1) {
        currentStep = 0;
        names.forEach(name => {
            const dataForLine = [ { stepIndex: 0, value: chartData[0].values[name].value } ];
            lines[name].datum(dataForLine).attr("d", lineGenerator);
            imageElements[name].attr("transform", `translate(${xScale(0)}, ${yScale(chartData[0].values[name].value)})`);
        });
    }

    // Start animation
    animateNextStep();
});
