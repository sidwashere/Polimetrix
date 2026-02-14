import { Politician, Source } from './types';

export const INITIAL_POLITICIANS: Politician[] = [
  { 
    id: '1', 
    name: "William Ruto", 
    role: "Incumbent President", 
    party: "UDA (Kenya Kwanza)", 
    score: 100.0, 
    trend: 0, 
    color: "#fbbf24", // Yellow
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/William_Ruto_at_Chatham_House_2022.jpg/640px-William_Ruto_at_Chatham_House_2022.jpg",
    slogan: "The Plan / Bottom-Up",
    bio: "Current President of Kenya (since 2022). Focusing on affordable housing, healthcare, and the 'Hustler Fund' economic transformation agenda.",
    history: Array(15).fill({ time: '', score: 100 }) 
  },
  { 
    id: '2', 
    name: "Kalonzo Musyoka", 
    role: "Wiper Leader", 
    party: "Wiper Democratic Movement", 
    score: 100.0, 
    trend: 0, 
    color: "#3b82f6", // Blue
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Kalonzo_Musyoka.jpg/640px-Kalonzo_Musyoka.jpg",
    slogan: "Hakika (Certainty)",
    bio: "Former Vice President and longstanding Azimio principal. Has explicitly declared his intent to vie for the presidency in 2027.",
    history: Array(15).fill({ time: '', score: 100 })
  },
  { 
    id: '3', 
    name: "George Wajackoyah", 
    role: "Party Leader", 
    party: "Roots Party", 
    score: 100.0, 
    trend: 0, 
    color: "#a855f7", // Purple
    image: "https://upload.wikimedia.org/wikipedia/commons/f/ff/George_Wajackoyah.jpg",
    slogan: "Tingiza Mti",
    bio: "Legal scholar and professor. Known for his unconventional 2022 manifesto advocating for industrial hemp cultivation and snake farming.",
    history: Array(15).fill({ time: '', score: 100 })
  },
  { 
    id: '4', 
    name: "Reuben Kigame", 
    role: "Activist", 
    party: "Independent / KPC", 
    score: 100.0, 
    trend: 0, 
    color: "#ef4444", // Red
    image: "https://pbs.twimg.com/profile_images/1544253944690380800/W83pYq4y_400x400.jpg",
    slogan: "Reset Kenya",
    bio: "Renowned gospel musician, teacher, and human rights activist running on a platform of integrity and constitutionalism.",
    history: Array(15).fill({ time: '', score: 100 })
  },
  { 
    id: '5', 
    name: "Ekuru Aukot", 
    role: "Party Leader", 
    party: "Thirdway Alliance", 
    score: 100.0, 
    trend: 0, 
    color: "#10b981", // Emerald
    image: "https://upload.wikimedia.org/wikipedia/commons/8/85/Dr_Ekuru_Aukot.jpg",
    slogan: "Punguza Mizigo",
    bio: "Constitutional lawyer and drafter of the 2010 Constitution. Advocates for reducing the public wage bill and government expenditure.",
    history: Array(15).fill({ time: '', score: 100 })
  }
];

export const INITIAL_SOURCES: Source[] = [
  { id: 's1', name: "X (Twitter)", type: "social", weight: 1.0, active: true },
  { id: 's2', name: "Daily Nation", type: "news", weight: 2.5, active: true },
  { id: 's3', name: "The Standard", type: "news", weight: 2.5, active: true },
  { id: 's4', name: "Citizen Digital", type: "tv", weight: 2.2, active: true },
  { id: 's5', name: "The Star", type: "news", weight: 1.8, active: true },
  { id: 's6', name: "Kenyans.co.ke", type: "blog", weight: 1.5, active: true },
];

export const MOCK_HEADLINES = {
  positive: [
    "launches new youth employment initiative in Nairobi",
    "receives endorsement from regional elders in Mount Kenya",
    "polls show surging support in key swing counties",
    "praised for transparent financial disclosures",
    "draws massive crowds at coastal rally in Mombasa",
    "successfully unites coalition partners for 2027 bid"
  ],
  negative: [
    "criticized for delayed infrastructure projects",
    "faces allegations of misuse of funds by opponents",
    "heckled by crowd during town hall meeting in Rift Valley",
    "drops in latest TIFA opinion polls",
    "key ally defects to rival coalition",
    "questioned over controversial remarks on tax policy"
  ],
  neutral: [
    "scheduled to visit Western region tomorrow",
    "announces major press conference for Monday",
    "featured in prime time debate on Citizen TV",
    "clarifies stance on agricultural exports and subsidies"
  ]
};