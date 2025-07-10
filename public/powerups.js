export const POWER_UPS = [
  // Common (x1.1)
  { name: "10K Runner", description: "Run at least 10km this week.", type: "distance", activity: "Run", target: 10, rarity: "Common", multiplier: 1.1 },
  { name: "Consistency Champ", description: "Train at least 5 days this week.", type: "days", target: 5, rarity: "Common", multiplier: 1.1 },
  { name: "Streak Starter", description: "Train 3 days in a row.", type: "streak", target: 3, rarity: "Common", multiplier: 1.1 },
 
 
  { name: "Distance Doubler", description: "Do two activities of 10km+ each.", type: "double_long", target: 2, rarity: "Common", multiplier: 1.1 },
  { name: "5K Runner", description: "Run at least 5km this week.", type: "distance", activity: "Run", target: 5, rarity: "Common", multiplier: 1.1 },
  { name: "20K Rider", description: "Ride at least 20km this week.", type: "distance", activity: "Ride", target: 20, rarity: "Common", multiplier: 1.1 },
  { name: "Quick Start", description: "Do your first training before Tuesday.", type: "early_week", target: 1, rarity: "Common", multiplier: 1.1 },
  { name: "Weekend Warrior", description: "Train on both Saturday and Sunday.", type: "weekend", target: 2, rarity: "Common", multiplier: 1.1 },
 
  { name: "Short & Sweet", description: "Do 3 activities under 30 minutes.", type: "short", target: 3, rarity: "Common", multiplier: 1.1 },
  { name: "Long Week", description: "Train at least 6 days this week.", type: "days", target: 6, rarity: "Common", multiplier: 1.1 },
  { name: "Step Up", description: "Increase your weekly distance vs last week.", type: "improve_distance", target: 1, rarity: "Common", multiplier: 1.1 },
  { name: "Climb Time", description: "Gain 300m elevation this week.", type: "elevation", target: 300, rarity: "Common", multiplier: 1.1 },
  { name: "Double Day", description: "Do 2 trainings in one day.", type: "double", target: 1, rarity: "Common", multiplier: 1.1 },
  { name: "Mix It Up", description: "Do both a run and a ride this week.", type: "multi_sport", target: 2, rarity: "Common", multiplier: 1.1 },
  
  { name: "Distance Builder", description: "Do 4 activities of 5km+ each.", type: "multi_long", target: 4, rarity: "Common", multiplier: 1.1 },

  // Rare (x1.2–x1.25)
  { name: "5 Hour Hero", description: "Train for at least 5 hours this week.", type: "duration", target: 300, rarity: "Rare", multiplier: 1.25 },
  { name: "Speed Demon", description: "Average speed >12km/h on a run.", type: "speed", activity: "Run", target: 12, rarity: "Rare", multiplier: 1.2 },
  { name: "Hill Crusher", description: "Do a single activity with 500m+ elevation.", type: "single_elevation", target: 500, rarity: "Rare", multiplier: 1.2 },
  { name: "Tri-Training", description: "Do 3 different activity types this week.", type: "variety", target: 3, rarity: "Rare", multiplier: 1.2 },
  { name: "Double Trouble", description: "Do 2 double-session days.", type: "double", target: 2, rarity: "Rare", multiplier: 1.2 },
  { name: "Consistency King", description: "Train every other day (4+ days).", type: "days", target: 4, rarity: "Rare", multiplier: 1.2 },
  { name: "Fast Finish", description: "Finish a training with your fastest split.", type: "fast_finish", target: 1, rarity: "Rare", multiplier: 1.2 },
  { name: "Distance Climber", description: "Do 2 activities of 15km+ each.", type: "double_long", target: 2, rarity: "Rare", multiplier: 1.2 },
  
  // Epic (x1.5)
  { name: "Climb Master", description: "Gain 1000m elevation this week.", type: "elevation", target: 1000, rarity: "Epic", multiplier: 1.5 },
  { name: "Century Rider", description: "Ride at least 100km this week.", type: "distance", activity: "Ride", target: 100, rarity: "Epic", multiplier: 1.5 },
  { name: "Half Marathon", description: "Do a single run of 21km+.", type: "single_distance", activity: "Run", target: 21, rarity: "Epic", multiplier: 1.5 },
  { name: "Streak Master", description: "Train 7 days in a row.", type: "streak", target: 7, rarity: "Epic", multiplier: 1.5 },
  { name: "Long Haul", description: "Do a single activity over 2 hours.", type: "single_duration", target: 120, rarity: "Epic", multiplier: 1.5 },
  { name: "Distance Monster", description: "Do 3 activities of 20km+ each.", type: "multi_long", target: 3, rarity: "Epic", multiplier: 1.5 },
  { name: "Elevation Beast", description: "Do 2 activities with 600m+ elevation.", type: "multi_elevation", target: 2, rarity: "Epic", multiplier: 1.5 },
  { name: "Marathon Mindset", description: "Do a single run of 30km+.", type: "single_distance", activity: "Run", target: 30, rarity: "Epic", multiplier: 1.5 },
  { name: "Ultra Rider", description: "Do a single ride of 150km+.", type: "single_distance", activity: "Ride", target: 150, rarity: "Epic", multiplier: 1.5 },
  { name: "Power Week", description: "Train for at least 8 hours this week.", type: "duration", target: 480, rarity: "Epic", multiplier: 1.5 },

  // Mythical (x2, no challenge)
  { name: "MYTHICAL: Grit God", description: "You found the mythical power-up! All your GRIT is doubled this week.", type: "mythical", rarity: "Mythical", multiplier: 2 }
];

export function getPowerUpProgress(powerUp, activities) {
  let current = 0;

  switch (powerUp.type) {
    case "distance":
      current = activities
        .filter(a => {
          if (!powerUp.activity) return true;
          const act = (a.type || '').toLowerCase();
          const puAct = powerUp.activity.toLowerCase();
          if (puAct === 'ride') return act === 'ride' || act === 'cycling';
          if (puAct === 'run') return act === 'run' || act === 'running';
          if (puAct === 'swimming') return act === 'swimming' || act === 'swim';
          return act === puAct;
        })
        .reduce((sum, a) => sum + (a.distance || 0), 0); // distance in km
      break;

    case "multi_long":
    case "double_long":
      // e.g. "Do 2 activities of 10km+ each."
      current = activities.filter(a => {
        if (!powerUp.activity) return (a.distance || 0) >= 10;
        const act = (a.type || '').toLowerCase();
        const puAct = powerUp.activity ? powerUp.activity.toLowerCase() : '';
        if (puAct === 'ride') return (act === 'ride' || act === 'cycling') && (a.distance || 0) >= 10;
        if (puAct === 'run') return (act === 'run' || act === 'running') && (a.distance || 0) >= 10;
        return act === puAct && (a.distance || 0) >= 10;
      }).length;
      break;

    case "variety":
      // "Do 3 different activity types this week."
      current = new Set(activities.map(a => (a.type || '').toLowerCase())).size;
      break;

    case "short":
      // "Do 3 activities under 30 minutes."
      current = activities.filter(a => (a.duration || 0) < 30).length;
      break;

    case "double":
      // "Do 2 trainings in one day"
      {
        const days = {};
        activities.forEach(a => {
          const day = (a.start_date_local || a.date || '').slice(0, 10);
          days[day] = (days[day] || 0) + 1;
        });
        current = Object.values(days).filter(count => count >= 2).length;
      }
      break;

    case "days":
      // "Train at least X days this week"
      current = new Set(activities.map(a => (a.start_date_local || a.date || '').slice(0, 10))).size;
      break;

    case "streak":
      // "Train X days in a row"
      {
        const days = [...new Set(activities.map(a => (a.start_date_local || a.date || '').slice(0, 10)))].sort();
        let maxStreak = 0, streak = 0, prev = null;
        days.forEach(day => {
          const d = new Date(day);
          if (prev) {
            const diff = (d - prev) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
              streak++;
            } else {
              streak = 1;
            }
          } else {
            streak = 1;
          }
          prev = d;
          if (streak > maxStreak) maxStreak = streak;
        });
        current = maxStreak;
      }
      break;

    // Add more cases as needed...

    default:
      current = 0;
  }

  return {
    current: Math.min(current, powerUp.target),
    target: powerUp.target,
    completed: current >= powerUp.target
  };
}

export function getWeeklyPowerUps() {
  const pool = [];
  POWER_UPS.forEach(pu => {
    let weight = 1;
    if (pu.rarity === "Common") weight = 60;
    if (pu.rarity === "Rare") weight = 30;
    if (pu.rarity === "Epic") weight = 9;
    if (pu.rarity === "Mythical") weight = 1;
    for (let i = 0; i < weight; i++) pool.push(pu);
  });
    // Shuffle and pick 3 unique
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const unique = [];
    const names = new Set();
    for (let i = 0; i < shuffled.length && unique.length < 3; i++) {
      if (!names.has(shuffled[i].name)) {
        unique.push(shuffled[i]);
        names.add(shuffled[i].name);
      }
    }
    return unique;
  }

export function renderPowerUpProgress(powerUp, progress) {
  const percent = Math.min(100, Math.round((progress.current / progress.target) * 100));
  const completed = progress.completed;
  let rarityColor = "#388e3c"; // Common
  if (powerUp.rarity === "Epic") rarityColor = "#8e24aa";
  else if (powerUp.rarity === "Rare") rarityColor = "#1976d2";
  else if (powerUp.rarity === "Mythical") rarityColor = "#f7d002";

  return `
    <div class="powerup-card" style="
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
      margin: 18px 0;
      padding: 18px 22px 16px 22px;
      position: relative;
      border-left: 6px solid ${rarityColor};
      ">
      <div style="font-size:1.15em;font-weight:bold;color:#222;">
        ${powerUp.name} <span style="font-size:0.9em;color:#888;">(${powerUp.rarity})</span>
      </div>
      <div style="font-size:1em;color:#444;margin:6px 0 10px 0;">
        <em>${powerUp.description}</em>
      </div>
      <div style="background:#eee;width:100%;height:16px;border-radius:8px;overflow:hidden;margin-bottom:8px;">
        <div style="
          background:${completed ? '#43a047' : '#1976d2'};
          width:${percent}%;
          height:100%;
          transition:width 0.4s;
          display:flex;
          align-items:center;
          justify-content:${completed ? 'center' : 'flex-start'};
          color:#fff;
          font-weight:bold;
          font-size:0.95em;
        ">
          ${completed ? '✅' : ''}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.98em;">
        <span>${progress.current} / ${progress.target}</span>
        <span style="color:#1976d2;">x${powerUp.multiplier}</span>
      </div>
    </div>
  `;
}

