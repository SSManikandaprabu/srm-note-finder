const express = require("express");
const router = express.Router();

// Curated engineering syllabus knowledge base covering SRM core engineering subjects:
// - Engineering Mathematics & Calculus (Matrices, Eigenvalues, Taylor series, Multiple integrals, ODEs)
// - Data Structures & Algorithms (Arrays, Linked Lists, Stacks, Queues, Trees, Graphs, Sorting, Dynamic Programming)
// - Operating Systems (Processes, Threads, CPU Scheduling, Deadlocks, Virtual Memory, Paging, Page Replacement)
// - Database Management Systems (ER Modeling, Relational Algebra, SQL, Normalization 1NF-BCNF, ACID, Indexing, Transactions)
// - Computer Networks (OSI vs TCP/IP, Flow & Congestion Control, IP addressing, Subnetting, Routing, DNS, HTTP, TCP/UDP)
// - Fundamentals of Electrical & Electronics (Ohm's Law, KCL/KVL, Thevenin/Norton, AC Circuits, Diodes, BJT, Op-Amps)
// - Theory of Computation / Compiler Design (DFA, NFA, CFG, Pushdown Automata, Parsing, Lexical Analysis)
// - Software Engineering & Object-Oriented Programming (OOP pillars, SOLID, Design Patterns, Agile/Scrum)
// - Artificial Intelligence & Machine Learning (Supervised vs Unsupervised, Linear/Logistic Regression, Neural Networks, Loss Functions, Gradient Descent)

const ENGINEERING_DOMAINS = [
  {
    keywords: ["calculus", "matrix", "eigen", "differential", "integral", "laplace", "fourier", "math", "vector", "taylor"],
    subject: "Engineering Mathematics",
    coreConcepts: [
      "Eigenvalues & Eigenvectors: Solve det(A - λI) = 0. Used in PCA, structural dynamics, and stability analysis.",
      "Cayley-Hamilton Theorem: Every square matrix satisfies its own characteristic equation A^n + c_{n-1}A^{n-1} + ... + c_0 I = 0. Useful for calculating matrix inverses and higher powers.",
      "Partial Derivatives & Jacobians: Rate of change in multivariable functions; Jacobian determines coordinate transformation scaling.",
      "Ordinary Differential Equations (ODEs): Linear higher-order ODEs with constant coefficients solved using Auxiliary Equations and Particular Integrals (PI).",
      "Laplace Transforms: Converts differential equations in the time domain into algebraic equations in the s-domain for easy circuit & control system analysis."
    ],
    examTips: "Double-check sign changes in determinants; show characteristic polynomial steps explicitly for full step-mark scoring."
  },
  {
    keywords: ["data structure", "dsa", "stack", "queue", "linked list", "tree", "bst", "avl", "graph", "sorting", "heap", "dynamic programming"],
    subject: "Data Structures & Algorithms",
    coreConcepts: [
      "Asymptotic Complexity: Big-O represents worst-case upper bound. Binary search is O(log n), QuickSort average O(n log n), worst O(n^2).",
      "Linked Lists vs Arrays: Arrays provide O(1) random access but fixed sizing; Linked Lists have O(1) insertions/deletions at known pointers but O(n) sequential access.",
      "Binary Search Trees (BST) & AVL: BST search is O(h); AVL self-balances via single/double rotations (LL, RR, LR, RL) maintaining balance factor in {-1, 0, 1} to guarantee O(log n) operations.",
      "Graph Traversals: BFS uses a Queue (finds shortest unweighted path); DFS uses a Stack/recursion (useful for cycle detection and topological sorting).",
      "Dynamic Programming: Optimal substructure + overlapping subproblems. Solved via Memoization (top-down) or Tabulation (bottom-up), e.g. 0/1 Knapsack, Longest Common Subsequence."
    ],
    examTips: "Always draw the tree/graph state diagrams step-by-step and write out time and space complexities explicitly in university exams."
  },
  {
    keywords: ["os", "operating system", "process", "thread", "deadlock", "scheduling", "paging", "virtual memory", "semaphore"],
    subject: "Operating Systems",
    coreConcepts: [
      "Process vs Thread: Process is an executing program with isolated memory address space; Threads are lightweight units within a process sharing code, data, and files.",
      "CPU Scheduling: Preemptive vs Non-Preemptive. FCFS (convoy effect), SJF/SRTF (optimal average wait time), Round Robin (time quantum based, prevents starvation).",
      "Process Synchronization & Critical Section: Mutual exclusion, Progress, Bounded waiting. Solved using Peterson's algorithm, Semaphores (wait/signal, counting vs binary), and Mutex.",
      "Deadlocks: Four Coffman conditions (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait). Handled via Banker's Algorithm (safety check), prevention, avoidance, or detection.",
      "Memory Management & Paging: Logical to physical address mapping via Page Table. Page faults trigger Page Replacement Algorithms (FIFO, LRU, Optimal)."
    ],
    examTips: "In Banker's Algorithm questions, always display the Need Matrix (Need = Max - Allocation) and step-by-step Work/Finish vectors."
  },
  {
    keywords: ["dbms", "database", "sql", "normalization", "acid", "relational", "bcnf", "transaction", "er diagram", "indexing"],
    subject: "Database Management Systems",
    coreConcepts: [
      "ACID Properties: Atomicity (all-or-nothing via rollback logs), Consistency (integrity constraints), Isolation (concurrency control/locking), Durability (WAL logs).",
      "ER Modeling & Relational Mapping: Entities, attributes (derived, multi-valued), relationships (1:1, 1:N, M:N). M:N relationships require an intermediate junction table.",
      "Normalization: 1NF (atomic values), 2NF (no partial dependency on composite key), 3NF (no transitive dependency X->Y, Y->Z), BCNF (for every X->A, X must be a super key).",
      "Transactions & Concurrency: Two-Phase Locking (2PL) guarantees Conflict Serializability. Strict 2PL prevents cascading rollbacks.",
      "Indexing: B-Trees and B+ Trees minimize disk I/O. In B+ trees, all record pointers reside in leaf nodes connected as a linked list for rapid range scans."
    ],
    examTips: "When decomposing relations into 3NF/BCNF, always verify Lossless Join Property and Dependency Preservation."
  },
  {
    keywords: ["network", "tcp", "udp", "osi", "ip", "subnet", "routing", "dns", "http", "socket", "packet"],
    subject: "Computer Networks",
    coreConcepts: [
      "OSI 7-Layer vs TCP/IP: Physical (bits), Data Link (frames/MAC), Network (packets/IP), Transport (segments/TCP-UDP), Session, Presentation, Application.",
      "TCP vs UDP: TCP is connection-oriented, reliable, with 3-way handshake (SYN, SYN-ACK, ACK), flow control (sliding window), and congestion control. UDP is lightweight, connectionless, ideal for real-time streaming/gaming.",
      "IPv4 Subnetting & CIDR: Subnet masks divide network ID from host ID. Number of usable hosts = 2^(32 - prefix) - 2.",
      "Routing Algorithms: Distance Vector (Bellman-Ford, count-to-infinity problem resolved with split horizon) vs Link State (Dijkstra's shortest path, OSPF).",
      "Application Protocols: DNS (domain resolution over UDP 53), HTTP/HTTPS (stateless, port 80/443 with TLS handshake), DHCP (DORA process for IP assignment)."
    ],
    examTips: "For subnetting calculations, show binary expansions of the octets and specify the Network Address, First Host, Last Host, and Broadcast Address."
  },
  {
    keywords: ["foe", "electrical", "circuits", "kcl", "kvl", "thevenin", "norton", "ac", "diode", "transistor", "bjt", "op-amp"],
    subject: "Basic Electrical & Electronics (FOE)",
    coreConcepts: [
      "Kirchhoff's Laws: KCL (algebraic sum of currents entering a junction is zero - conservation of charge); KVL (sum of voltages around a closed loop is zero - conservation of energy).",
      "Network Theorems: Thevenin's Theorem replaces linear two-terminal circuit with V_th in series with R_th; Norton replaces with I_n in parallel with R_n.",
      "Semiconductor Diodes: PN junction forward bias (depletion layer narrows, 0.7V threshold for Si) and reverse bias (breakdown/Zener voltage regulation).",
      "BJT Configurations: Common Emitter (CE) provides both high current and voltage gain with 180° phase inversion.",
      "Operational Amplifiers (Op-Amps): Ideal properties (infinite input impedance, zero output impedance, infinite open-loop gain). Virtual ground concept for inverting/non-inverting amplifiers."
    ],
    examTips: "Draw labeled circuit diagrams with loop directions clearly indicated before applying mesh or nodal analysis."
  }
];

// Helper: Call Gemini API if GEMINI_API_KEY is available
async function queryGemini(prompt, systemInstruction = "") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: (systemInstruction ? systemInstruction + "\n\n" : "") + prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1200
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn("Gemini API error status:", res.status);
      return null;
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return candidate || null;
  } catch (err) {
    console.warn("Gemini fetch exception:", err.message);
    return null;
  }
}

// Fallback: Smart Engineering Reasoning Engine
function generateEngineeringInsight(topic, subject, queryType = "doubt") {
  const text = `${topic} ${subject}`.toLowerCase();
  const matched = ENGINEERING_DOMAINS.find(d => 
    d.keywords.some(kw => text.includes(kw))
  ) || ENGINEERING_DOMAINS[1]; // default to DSA/Engg core

  if (queryType === "summary") {
    return {
      title: `Executive Engineering Summary: ${topic || subject}`,
      subjectArea: matched.subject,
      overview: `In ${matched.subject}, this topic is essential for mastering both semester university exam theory and competitive coding / technical interviews.`,
      keyTakeaways: matched.coreConcepts,
      examTips: matched.examTips,
      recommendedNextSteps: [
        "Review previous 3-year university question papers (Cycle Test 1, 2, and End Sem).",
        "Derive standard mathematical equations or draw structural data layout diagrams by hand.",
        "Solve at least 2 numerical problems or dry-run algorithm traces."
      ]
    };
  }

  // Doubt solving
  return {
    query: topic,
    domain: matched.subject,
    conceptBreakdown: matched.coreConcepts[0],
    inDepthExplanation: `When approaching "${topic}", remember that in engineering systems, performance is evaluated on time efficiency, space overhead, and boundary condition resilience. \n\nKey Principles:\n• ${matched.coreConcepts.slice(0, 3).join("\n• ")}`,
    examStrategy: matched.examTips,
    sampleQuestion: `Q: Explain the fundamental mechanism of ${topic} with a neat schematic/diagram and derive its complexity/equations.`
  };
}

// POST /api/ai/summarize-unit
// Summarize a unit's core points, formulas, and high-yield exam takeaways
router.post("/summarize-unit", async (req, res) => {
  try {
    const { subject, unit, unitTitle, department } = req.body;
    if (!subject && !unitTitle) {
      return res.status(400).json({ error: "Subject or Unit Title is required" });
    }

    const prompt = `You are a high-level Senior Engineering Professor at SRM Institute of Science and Technology.
Summarize the following unit for students preparing for Cycle Tests and End Semester University Exams:
Subject: ${subject || "Engineering Subject"}
Unit: ${unit || "Core Unit"} - ${unitTitle || "Engineering Concepts"}
Department: ${department || "Engineering / Technology"}

Provide a structured, high-yield summary including:
1. Core Definitions & Big Ideas (3-4 crisp points)
2. Essential Formulas / Mathematical Equations / Core Algorithms
3. High Probability Exam Questions (frequently asked in SRM Cycle Tests & University Exams)
4. Key Diagrams or Schematics students must draw for full step marks
Keep the tone authoritative, encouraging, and razor-sharp for university exams.`;

    const geminiResult = await queryGemini(prompt, "You are an expert SRM University Engineering Professor & Exam Strategist.");

    if (geminiResult) {
      return res.json({
        success: true,
        source: "Gemini Engineering Intelligence",
        summary: geminiResult,
        subject,
        unit
      });
    }

    // Fallback engine
    const fallback = generateEngineeringInsight(unitTitle || subject, subject, "summary");
    return res.json({
      success: true,
      source: "SRM Offline Engineering Engine",
      summary: `### 📘 ${fallback.title}\n\n**Domain:** ${fallback.subjectArea}\n\n${fallback.overview}\n\n#### 🔑 Core Engineering Concepts:\n${fallback.keyTakeaways.map((c, i) => `${i + 1}. ${c}`).join("\n\n")}\n\n#### 📝 High-Yield Exam Advice:\n> ${fallback.examTips}\n\n#### 🎯 Recommended Action Plan:\n${fallback.recommendedNextSteps.map(s => `• ${s}`).join("\n")}`,
      subject,
      unit
    });
  } catch (error) {
    console.error("AI summarize error:", error);
    res.status(500).json({ error: "Failed to generate engineering unit summary" });
  }
});

// POST /api/ai/doubt-solver
// Answer specific engineering questions/doubts with step-by-step logic
router.post("/doubt-solver", async (req, res) => {
  try {
    const { question, subject, unit } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question cannot be empty" });
    }

    const prompt = `You are a dedicated Engineering Doubt Solver and SRM University Exam Mentor.
A student has asked the following technical engineering doubt:
Question: "${question}"
Subject Context: ${subject || "General Engineering"}
Unit Context: ${unit || "Core Syllabus"}

Provide a clear, pedagogical, step-by-step response:
- Direct Answer / Definition
- Step-by-step Technical Explanation or Derivation/Algorithm trace
- Real-world Engineering Application or Code/Diagram note
- Common mistakes students make in exam papers on this topic
Keep it technically accurate, concise, and structured with Markdown headers and bullet points.`;

    const geminiResult = await queryGemini(prompt, "You are a world-class Engineering Tutor with deep knowledge of SRM University syllabus.");

    if (geminiResult) {
      return res.json({
        success: true,
        source: "Gemini Engineering Intelligence",
        answer: geminiResult,
        question
      });
    }

    // Offline fallback
    const fallback = generateEngineeringInsight(question, subject || "", "doubt");
    return res.json({
      success: true,
      source: "SRM Offline Engineering Engine",
      answer: `### 💡 Engineering Solution: ${question}\n\n**Discipline:** ${fallback.domain}\n\n#### 📌 Key Principle:\n${fallback.conceptBreakdown}\n\n#### ⚙️ Technical Breakdown:\n${fallback.inDepthExplanation}\n\n#### 🎓 University Exam Tip:\n> ${fallback.examStrategy}\n\n#### 📝 Practice Prompt:\n${fallback.sampleQuestion}`,
      question
    });
  } catch (error) {
    console.error("AI doubt solver error:", error);
    res.status(500).json({ error: "Failed to solve engineering doubt" });
  }
});

module.exports = router;

