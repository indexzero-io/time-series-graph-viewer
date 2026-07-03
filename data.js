const chartDataConfig = {
  "participants": {
    "Alice": { "imageUrl": "https://i.pravatar.cc/150?u=Alice", "color": "#ff6384", "initialValue": 50 },
    "Bob": { "imageUrl": "https://i.pravatar.cc/150?u=Bob", "color": "#36a2eb", "initialValue": 60 },
    "Charlie": { "imageUrl": "https://i.pravatar.cc/150?u=Charlie", "color": "#ffce56", "initialValue": 40 },
    "Diana": { "imageUrl": "https://i.pravatar.cc/150?u=Diana", "color": "#4bc0c0", "initialValue": 45 }
  },
  "timelineData": [
    { "timeLabel": "Week 0", "changes": { "Alice": 0, "Bob": 0, "Charlie": 0, "Diana": 0 } },
    { "timeLabel": "Week 1", "changes": { "Alice": 10, "Bob": -5, "Charlie": 15, "Diana": 5 } },
    { "timeLabel": "Week 2\n(Bonus)", "changes": { "Alice": -15, "Bob": 10, "Diana": 20 } },
    { "timeLabel": "Week 3", "changes": { "Alice": 5, "Bob": 25, "Charlie": -10 } },
    { "timeLabel": "Week 4\n(Penalty)", "changes": { "Bob": -10, "Charlie": 30, "Diana": 15 } },
    { "timeLabel": "Week 5", "changes": { "Alice": 20, "Bob": 5, "Charlie": -5, "Diana": -15 } },
    { "timeLabel": "Week 6", "changes": { "Alice": 15, "Bob": 20, "Charlie": 10, "Diana": 5 } }
  ]
};