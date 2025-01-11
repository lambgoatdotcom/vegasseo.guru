export type LoadingAction = 'searching' | 'thinking' | 'creating' | 'analyzing';

const loadingMessages = {
  searching: [
    "Sparking curiosity",
    "Venturing onward", 
    "Sampling perspectives",
    "Testing the waters",
    "Catching inspiration",
    "Collecting vantage",
    "Scouting vantage points",
    "Scanning the horizon",
    "Opening vantage",
    "Surfacing hidden layers",
    "Digging up insight",
  ],

  thinking: [
    "Cycling through insight",
    "Mirroring perspectives",
    "Rippling with reason", 
    "Tapping awareness",
    "Waking the intellect",
    "Flickering with insight",
    "Gliding through reason",
    "Storming the mind",
    "Triggering epiphanies",
    "Swirling with insight",
    "Thinking cleverly",
    "Mulling over vantage",
    "Dancing with logic",
    "Drifting through logic",
    "Rosining up the mind",
    "Provoking deeper thought",
    "Tuning the mental dial",
    "Coasting to insight",
    "Swirling vantage"
  ],

  creating: [
    "Wiring new ideas",
    "Forging pathways",
    "Riffing on creativity",
    "Merging solutions",
    "Melding directions",
    "Bending the narrative",
    "Stringing insights",
    "Piloting imagination",
    "Splicing perspectives",
    "Knitting solutions",
    "Drumming up ideas",
    "Fusing reason",
    "Forming synergy",
    "Binding fragments",
    "Sculpting solutions",
    "Gelling perspectives",
    "Animating the plan",
    "Dovetailing ideas",
    "Blending intentions"
  ],

  analyzing: [
    "Gambling the odds",
    "Outwitting constraints",
    "Sorting complexities",
    "Lining up logic",
    "Vetting possibilities",
    "Weighing prospects",
    "Sequencing answers",
    "Bargaining with logic",
    "Cycling logic loops",
    "Corralling complexity",
    "Tracking subtleties",
    "Charting progress",
    "Skimming complexities",
    "Harvesting logic",
    "Rewiring assumptions",
    "Cracking the puzzle",
    "Tracing connections",
    "Indexing imagination",
    "Cascading reasons",
    "Sifting complications"
  ]
};

export function getLoadingMessage(action: LoadingAction = 'thinking'): string {
  const messages = loadingMessages[action];
  return messages[Math.floor(Math.random() * messages.length)];
}