export interface AIStackCompany {
  ticker: string;
  name: string;
  role: string;
}

export interface AIStackLayer {
  layer: string;
  label: string;
  sublabel: string;
  companies: AIStackCompany[];
}

export interface AIStackFlowStep {
  label: string;
  tickers: string;
}

export const AI_STACK_DATA: AIStackLayer[] = [
  {
    layer: "L0",
    label: "RAW MATERIALS",
    sublabel: "Critical minerals, metals & nuclear fuel",
    companies: [
      { ticker: "CCJ", name: "Cameco", role: "Uranium — nuclear fuel for AI power plants" },
      { ticker: "UEC", name: "Uranium Energy", role: "Uranium mining & supply chain" },
      { ticker: "FCX", name: "Freeport-McMoRan", role: "Copper — wiring, cooling, grid" },
      { ticker: "SCCO", name: "Southern Copper", role: "Copper production at scale" },
      { ticker: "ATI", name: "Allegheny Tech", role: "Titanium, nickel superalloys — jet engines, nuclear fuel rods, defense" },
      { ticker: "MP", name: "MP Materials", role: "Rare earth elements for motors & robotics" },
    ],
  },
  {
    layer: "L1",
    label: "POWER GENERATION",
    sublabel: "Gigawatts of always-on electricity for AI campuses",
    companies: [
      { ticker: "CEG", name: "Constellation Energy", role: "Largest US nuclear fleet — PPAs with MSFT, Meta, Amazon" },
      { ticker: "VST", name: "Vistra", role: "Nuclear + gas — long-term hyperscaler contracts" },
      { ticker: "BE", name: "Bloom Energy", role: "Fuel cells — +198% YTD, non-tech top performer" },
      { ticker: "GEV", name: "GE Vernova", role: "Gas turbines, grid equipment — every new power plant" },
      { ticker: "OKLO", name: "Oklo", role: "Next-gen microreactors — modular nuclear for data centers" },
      { ticker: "SMR", name: "NuScale Power", role: "Small modular reactor technology" },
    ],
  },
  {
    layer: "L2",
    label: "GRID & ELECTRICAL INFRASTRUCTURE",
    sublabel: "Transmission, substations & high-voltage buildout",
    companies: [
      { ticker: "PWR", name: "Quanta Services", role: "$44B backlog — transmission lines, grid interconnects" },
      { ticker: "EME", name: "EMCOR", role: "Record $4.3B network & comms backlog — data center electrical" },
      { ticker: "ETN", name: "Eaton", role: "Electrical equipment + acquired Motivair liquid cooling" },
      { ticker: "POWL", name: "Powell Industries", role: "Medium-voltage switchgear — $400M record AI data center order" },
      { ticker: "HUB.B", name: "Hubbell", role: "Grid components for bidirectional power & EV charging" },
      { ticker: "GEV", name: "GE Vernova", role: "Grid modernization hardware & software (also L1)" },
    ],
  },
  {
    layer: "L3",
    label: "DATA CENTER CONSTRUCTION",
    sublabel: "Physical campuses, site development & electrical fit-out",
    companies: [
      { ticker: "STRL", name: "Sterling Infrastructure", role: "Turnkey data center site dev — 92% revenue YoY, $3.8B 2026 guide" },
      { ticker: "PWR", name: "Quanta Services", role: "Full electrical path from power plant to server rack (also L2)" },
      { ticker: "EME", name: "EMCOR", role: "Mission-critical electrical & mechanical services (also L2)" },
      { ticker: "FLR", name: "Fluor", role: "Large-scale industrial & data center EPC construction" },
      { ticker: "CBRE", name: "CBRE Group", role: "Data center real estate advisory & development" },
    ],
  },
  {
    layer: "L4",
    label: "DATA CENTER REAL ESTATE",
    sublabel: "Physical buildings leased to hyperscalers under long-term contracts",
    companies: [
      { ticker: "EQIX", name: "Equinix", role: "Premium REIT — network exchanges, cloud on-ramps, interconnection" },
      { ticker: "DLR", name: "Digital Realty", role: "Largest pure-play DC REIT — lease pricing 30-50% above expiring" },
      { ticker: "CORZ", name: "Core Scientific", role: "Bitcoin mining pivot to AI/HPC — CoreWeave contracts" },
      { ticker: "APLD", name: "Applied Digital", role: "High-performance computing data centers for AI workloads" },
      { ticker: "IRON", name: "Iron Mountain", role: "Data center expansion + colocation for enterprise AI" },
    ],
  },
  {
    layer: "L5",
    label: "COOLING & THERMAL MANAGEMENT",
    sublabel: "Liquid cooling — racks now draw 120–150kW vs 15kW in 2023",
    companies: [
      { ticker: "VRT", name: "Vertiv", role: "$15B backlog, Q4 orders +252% — thermal mgmt & power distribution" },
      { ticker: "ETN", name: "Eaton", role: "Power distribution units + acquired Motivair liquid cooling (also L2)" },
      { ticker: "AEIS", name: "Advanced Energy Ind.", role: "Precision power conversion — semiconductor fab + data center" },
      { ticker: "MPWR", name: "Monolithic Power Sys.", role: "On-board DC-DC converters — 'last inch' to GPU, 85% YoY growth guide" },
      { ticker: "GNRC", name: "Generac", role: "Backup power / UPS systems for data centers" },
      { ticker: "CMI", name: "Cummins", role: "Diesel & hydrogen backup generators" },
    ],
  },
  {
    layer: "L6",
    label: "SEMICONDUCTOR FAB EQUIPMENT",
    sublabel: "The machines that make the chips — ASML is the ultimate chokepoint",
    companies: [
      { ticker: "ASML", name: "ASML", role: "EUV lithography — only company that makes the machines that print advanced chips" },
      { ticker: "AMAT", name: "Applied Materials", role: "Deposition, etch, metrology — largest semi equipment co." },
      { ticker: "LRCX", name: "Lam Research", role: "Etch & deposition — critical for 3D NAND & advanced logic" },
      { ticker: "KLAC", name: "KLA Corp", role: "Process control & inspection — quality gatekeeper for fabs" },
      { ticker: "AEIS", name: "Advanced Energy Ind.", role: "RF/DC plasma power for fab equipment (also L5)" },
      { ticker: "AEHR", name: "Aehr Test Systems", role: "Chip burn-in & test — +327% YTD; $41M hyperscaler AI accelerator order" },
    ],
  },
  {
    layer: "L7",
    label: "SPECIALTY FOUNDRIES",
    sublabel: "Fabs that make analog, photonic & mixed-signal chips mainstream fabs won't touch",
    companies: [
      { ticker: "TSM", name: "TSMC", role: "World's most advanced foundry — makes NVDA, AVGO, AMD, Apple chips" },
      { ticker: "TSEM", name: "Tower Semiconductor", role: "Silicon photonics foundry — $1.3B SiPho backlog; analog & RF specialist" },
      { ticker: "AMKR", name: "Amkor Technology", role: "Advanced chip packaging (CoWoS) — TSMC sold out, Amkor is primary alternative" },
      { ticker: "ONTO", name: "Onto Innovation", role: "Advanced packaging inspection — metrology for HBM & CoWoS" },
      { ticker: "FORM", name: "FormFactor", role: "Wafer probe cards — tests chips at the foundry before packaging" },
    ],
  },
  {
    layer: "L8",
    label: "CHIPS & SILICON",
    sublabel: "GPUs, custom ASICs, memory & inference chips",
    companies: [
      { ticker: "NVDA", name: "Nvidia", role: "GPU monopoly — $216B revenue FY25; Blackwell → Rubin H2 2026" },
      { ticker: "AVGO", name: "Broadcom", role: "Custom ASICs (Google TPU, Meta) + AI ethernet — revenue doubling YoY" },
      { ticker: "AMD", name: "AMD", role: "MI300X GPU — gaining inference share; EPYC CPUs for AI servers" },
      { ticker: "CBRS", name: "Cerebras Systems", role: "Wafer-scale inference chip — IPO May 2026, $20B OpenAI deal, +68% day 1" },
      { ticker: "MRVL", name: "Marvell", role: "Custom ASICs + acquired Celestial AI for co-packaged optics" },
      { ticker: "SNDK", name: "SanDisk", role: "NAND flash storage — +464% YTD, $42B+ performance obligations" },
      { ticker: "MU", name: "Micron", role: "HBM (high-bandwidth memory) stacked on GPUs — critical AI memory layer" },
      { ticker: "STX", name: "Seagate", role: "AI HDD storage — +180% YTD; HAMR 36TB drives for AI clusters" },
      { ticker: "WDC", name: "Western Digital", role: "AI HDD + NAND — +180% YTD; structurally advantaged pricing through 2030" },
      { ticker: "SIMO", name: "Silicon Motion", role: "NAND flash controllers — brain of every SSD; MonTitan PCIe 6 for AI clouds" },
      { ticker: "INTC", name: "Intel", role: "Gaudi AI accelerator + fab renaissance; +197% YTD on AI storage" },
      { ticker: "ARM", name: "Arm Holdings", role: "CPU architecture IP — inside every smartphone, server, and AI edge device" },
    ],
  },
  {
    layer: "L9",
    label: "NETWORKING & INTERCONNECTS",
    sublabel: "High-speed switches, optical transceivers & co-packaged optics",
    companies: [
      { ticker: "ANET", name: "Arista Networks", role: "AI ethernet switches — $3.25B AI networking revenue 2026; MSFT, Meta, Oracle" },
      { ticker: "CIEN", name: "Ciena", role: "Optical networking systems — long-haul between data centers; triple-digit RS" },
      { ticker: "LITE", name: "Lumentum", role: "Optical components — lasers, transceivers; triple-digit gains" },
      { ticker: "COHR", name: "Coherent", role: "Largest pure-play optical components co. with deep silicon photonics" },
      { ticker: "MACOM", name: "MACOM Tech", role: "High-speed analog & photonic semiconductors across DC optical chain" },
      { ticker: "POET", name: "POET Technologies", role: "Optical Interposer — integrates laser+modulator+photodiode on one chip; 1.6T engines" },
      { ticker: "MRVL", name: "Marvell", role: "Celestial AI acquisition — photonic fabric chiplets for co-packaged optics (also L8)" },
      { ticker: "AAOI", name: "Applied Optoelectronics", role: "Vertically integrated transceiver maker — domestic US manufacturing" },
      { ticker: "MTSI", name: "MACOM Technology", role: "High-speed analog semis & photonics for DC optical chain" },
    ],
  },
  {
    layer: "L10",
    label: "PCBs & ADVANCED PACKAGING",
    sublabel: "Circuit boards that chips mount on + advanced assembly",
    companies: [
      { ticker: "TTMI", name: "TTM Technologies", role: "PCBs for AI accelerators & defense — 80% revenue from AI/defense; +57% YoY DC" },
      { ticker: "SMCI", name: "Super Micro Computer", role: "AI server OEM — first to market with NVDA Blackwell & AMD MI300X servers" },
      { ticker: "DELL", name: "Dell Technologies", role: "AI server integrator — PowerEdge AI servers" },
      { ticker: "HPE", name: "HP Enterprise", role: "AI servers + ProLiant systems; Cray supercomputer division" },
      { ticker: "AMKR", name: "Amkor", role: "CoWoS advanced packaging — stacks HBM memory on GPU dies (also L7)" },
    ],
  },
  {
    layer: "L11",
    label: "AI CLOUD & NEOCLOUD OPERATORS",
    sublabel: "Rent compute by the hour — buy all the chips above, sell access",
    companies: [
      { ticker: "NBIS", name: "Nebius Group", role: "AI neocloud — 684% Q1 revenue; $12B Meta deal; Nvidia-backed; $7-9B ARR target" },
      { ticker: "CRWV", name: "CoreWeave", role: "GPU cloud IPO 2025 — pure-play AI compute rental; +162% since IPO" },
      { ticker: "MSFT", name: "Microsoft Azure", role: "Largest enterprise AI cloud — OpenAI partnership; $180-190B capex 2026" },
      { ticker: "AMZN", name: "Amazon AWS", role: "Largest cloud overall — Trainium chips, Bedrock AI platform" },
      { ticker: "GOOGL", name: "Google Cloud", role: "TPUs + Gemini integrated — planning $180-190B capex" },
      { ticker: "ORCL", name: "Oracle Cloud", role: "$300B OpenAI compute deal — $50B capex FY2026" },
    ],
  },
  {
    layer: "L12",
    label: "FOUNDATION MODELS",
    sublabel: "The AI brains — mostly private, a few public proxies",
    companies: [
      { ticker: "META", name: "Meta Platforms", role: "Llama open-source models — largest open foundation model ecosystem" },
      { ticker: "GOOGL", name: "Alphabet / Google", role: "Gemini models — powers Search, YouTube, Cloud, Workspace (also L11)" },
      { ticker: "MSFT", name: "Microsoft", role: "Deeply integrated with OpenAI — Copilot across entire product suite (also L11)" },
      { ticker: "PRIVATE", name: "OpenAI", role: "GPT-4o, o3 — ChatGPT; IPO expected 2026" },
      { ticker: "PRIVATE", name: "Anthropic", role: "Claude — IPO expected 2026; AWS & Google backed" },
      { ticker: "PRIVATE", name: "xAI / SpaceX", role: "Grok models — Colossus supercomputer; SpaceX IPO anticipated" },
    ],
  },
  {
    layer: "L13",
    label: "ENTERPRISE AI SOFTWARE & APPLICATIONS",
    sublabel: "Where AI becomes a product companies pay recurring revenue for",
    companies: [
      { ticker: "PLTR", name: "Palantir", role: "AIP platform — AI for enterprise & govt; 61% 2026 revenue growth" },
      { ticker: "NOW", name: "ServiceNow", role: "AI workflow automation — $11.25B 2026 revenue; 46% operating margin" },
      { ticker: "CRM", name: "Salesforce", role: "Agentforce AI agents — CRM + AI workflow automation" },
      { ticker: "CRWD", name: "CrowdStrike", role: "AI-native cybersecurity — Falcon platform; identity & endpoint" },
      { ticker: "MSFT", name: "Microsoft Copilot", role: "AI across Office, Teams, GitHub, Azure (also L11/L12)" },
      { ticker: "SNOW", name: "Snowflake", role: "AI data cloud — Cortex AI; data platform for training & inference" },
      { ticker: "MDB", name: "MongoDB", role: "AI-ready database — vector search, Atlas for AI applications" },
      { ticker: "SOUN", name: "SoundHound AI", role: "Conversational AI — voice agents for automotive & hospitality" },
    ],
  },
];

export const AI_STACK_FLOW: AIStackFlowStep[] = [
  { label: "Raw Materials", tickers: "ATI FCX CCJ" },
  { label: "Power Gen", tickers: "CEG VST BE GEV" },
  { label: "Grid", tickers: "PWR POWL ETN" },
  { label: "Construction", tickers: "STRL EME" },
  { label: "RE / DC", tickers: "EQIX DLR CORZ" },
  { label: "Cooling", tickers: "VRT MPWR AEIS" },
  { label: "Fab Equip", tickers: "ASML LRCX AMAT AEHR" },
  { label: "Foundry", tickers: "TSM TSEM AMKR" },
  { label: "Chips", tickers: "NVDA AVGO CBRS MU" },
  { label: "Networking", tickers: "ANET CIEN LITE POET" },
  { label: "PCBs / OEM", tickers: "TTMI SMCI DELL" },
  { label: "Cloud", tickers: "NBIS CRWV MSFT AMZN" },
  { label: "Models", tickers: "META GOOGL OAI" },
  { label: "Apps", tickers: "PLTR NOW CRM CRWD" },
];
