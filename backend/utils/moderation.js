/**
 * Advanced Abusive-Word & Content Filtering Engine
 * Capabilities:
 * 1. Comprehensive multi-tier wordlist:
 *    - Severe profanity & insults
 *    - Hate speech, racial slurs, and identity attacks
 *    - Sexual harassment & derogatory slurs
 *    - Indian campus slang / regional abuse (Hindi/Tamil common transliterations)
 *    - Scams, phishing links, and malware keywords
 * 2. Deep Anti-Evasion / Normalization:
 *    - Unicode homoglyph normalization (Cyrillic, Greek look-alikes like 'а' instead of 'a', 'о' instead of 'o')
 *    - Zero-width character stripping (U+200B, U+200C, U+200D, U+FEFF)
 *    - Leet-speak and special character decoding (@ -> a, 1/!/| -> i, 3 -> e, $ -> s, 0 -> o, +/7 -> t)
 *    - Word-stretching & character elongation collapse ("fuuuuuck" -> "fuck", "biiiitch" -> "bitch")
 *    - Obfuscated spacing and punctuation stripping ("f u c k", "f.u.c.k", "f_u_c_k", "f-u-c-k", "f*u*c*k")
 * 3. Smart Context & Academic False-Positive Prevention:
 *    - Whitelists benign academic terms ("pass", "class", "assignment", "analysis", "title", "document", "assume", "compass")
 * 4. Severity Scoring & Classification:
 *    - "critical" (immediate reject/block for extreme slurs/threats)
 *    - "moderate" (mask or reject depending on admin configuration)
 * 5. Spam, Link Flooding & Rate Limiting:
 *    - Suspicious link detection (Telegram bot promos, bit.ly, unapproved external redirectors)
 *    - Repeated identical message suppression
 *    - Flooding rate limiter
 */

// Unicode homoglyph map to canonical ASCII
const HOMOGLYPH_MAP = {
  // Cyrillic
  "\u0430": "a", "\u0410": "A", // а, А
  "\u0435": "e", "\u0415": "E", // е, Е
  "\u043E": "o", "\u041E": "O", // о, О
  "\u0440": "p", "\u0420": "P", // р, Р
  "\u0441": "c", "\u0421": "C", // с, С
  "\u0443": "y", "\u0423": "Y", // у, У
  "\u0445": "x", "\u0425": "X", // х, Х
  "\u0456": "i", "\u0406": "I", // і, І
  // Greek & other
  "\u03B1": "a", // α
  "\u03BF": "o", // ο
  "\u03C1": "p", // ρ
  // Full-width latin
  "\uFF41": "a", "\uFF42": "b", "\uFF43": "c", "\uFF44": "d", "\uFF45": "e",
  "\uFF46": "f", "\uFF47": "g", "\uFF48": "h", "\uFF49": "i", "\uFF4A": "j",
  "\uFF4B": "k", "\uFF4C": "l", "\uFF4D": "m", "\uFF4E": "n", "\uFF4F": "o",
  "\uFF50": "p", "\uFF51": "q", "\uFF52": "r", "\uFF53": "s", "\uFF54": "t",
  "\uFF55": "u", "\uFF56": "v", "\uFF57": "w", "\uFF58": "x", "\uFF59": "y",
  "\uFF5A": "z",
};

// Character substitution map for decoding obfuscated text
const CHAR_MAP = {
  "0": "o",
  "1": "i",
  "!": "i",
  "|": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  "$": "s",
  "7": "t",
  "+": "t",
  "8": "b",
  "9": "g",
  "v": "u",
};

// Expanded master wordlist categorized by severity
const CRITICAL_WORDS = [
  "nigger",
  "nigga",
  "motherfucker",
  "kill yourself",
  "kys",
  "pedophile",
  "rapist",
  "suicide threat",
];

const MODERATE_ABUSIVE_WORDS = [
  // Profanity & Insults
  "abuse",
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cunt",
  "dick",
  "dickhead",
  "dumbass",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "idiot",
  "jackass",
  "jerk",
  "moron",
  "penis",
  "piss",
  "prick",
  "pussy",
  "scam",
  "shit",
  "slut",
  "twat",
  "vagina",
  "wanker",
  "whore",
  // Regional transliterated abuse common in campus groups
  "bhenchod",
  "benchod",
  "bhosdi",
  "bhosdike",
  "chutiya",
  "chootiya",
  "chutiye",
  "gandu",
  "gaandu",
  "harami",
  "kamina",
  "lauda",
  "lavde",
  "lowda",
  "madarchod",
  "madarchot",
  "randi",
  "saala",
  "thevidiya",
  "omala",
  "ootha",
  "kena",
  "sunni",
  "punda",
  "pundai",
];

const DEFAULT_ABUSIVE_WORDS = [...CRITICAL_WORDS, ...MODERATE_ABUSIVE_WORDS];

// Whitelist of legitimate academic or English words to prevent false positive masking
const ACADEMIC_SAFE_WORDS = new Set([
  "pass",
  "passed",
  "passing",
  "compass",
  "class",
  "classic",
  "classes",
  "classroom",
  "assume",
  "assumption",
  "assumed",
  "assignment",
  "assign",
  "assessment",
  "asset",
  "assets",
  "assist",
  "assistant",
  "assistance",
  "associated",
  "association",
  "analysis",
  "analytic",
  "analytics",
  "document",
  "documentation",
  "title",
  "button",
  "butter",
  "circuit",
  "semester",
  "examination",
  "exam",
  "syllabus",
  "engineering",
  "calculus",
  "physics",
  "chemistry",
  "biology",
]);

// In-memory rate limiting and spam tracking
const userSpamTrackers = new Map();

/**
 * Advanced Multi-pass normalization
 */
function cleanEvasions(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  // 1. Strip zero-width and invisible characters
  let cleaned = rawText.replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, "");

  // 2. Normalize homoglyphs
  let dehomoglyphed = "";
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    dehomoglyphed += HOMOGLYPH_MAP[ch] || ch;
  }

  // 3. Convert to lowercase
  let lower = dehomoglyphed.toLowerCase();

  // 4. Substitute leet speak
  let deleeted = "";
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    deleeted += CHAR_MAP[ch] || ch;
  }

  // 5. Collapse duplicate letters stretched for evasion: "fuuuuck" -> "fuck"
  deleeted = deleeted.replace(/(.)\1{2,}/g, "$1$1");

  return deleeted;
}

/**
 * Advanced Abuse & Threat Detection
 * Returns:
 * {
 *   containsAbuse: boolean,
 *   severity: "none" | "moderate" | "critical",
 *   matches: string[],
 *   maskedText: string,
 *   actionSuggestion: "allow" | "mask" | "reject" | "ban"
 * }
 */
function analyzeAbuse(text, customWords = []) {
  if (!text || typeof text !== "string") {
    return {
      containsAbuse: false,
      severity: "none",
      matches: [],
      maskedText: "",
      actionSuggestion: "allow",
    };
  }

  const allWords = [...DEFAULT_ABUSIVE_WORDS, ...customWords];
  let maskedText = text;
  const matches = new Set();
  let maxSeverity = "none";

  const normalized = cleanEvasions(text);

  // Check each term
  for (const word of allWords) {
    if (!word || word.trim().length === 0) continue;
    const cleanWord = word.trim().toLowerCase();

    // Check critical list
    const isCritical = CRITICAL_WORDS.includes(cleanWord);

    // Build anti-obfuscation pattern:
    // allows dots, underscores, dashes, asterisks, spaces between letters
    const letters = cleanWord.split("").map((c) => {
      const revMap = {
        "o": "[o0]",
        "i": "[i1!|]",
        "e": "[e3]",
        "a": "[a4@]",
        "s": "[s5$]",
        "t": "[t7+]",
        "b": "[b8]",
        "g": "[g9]",
        "u": "[uv]",
      };
      return revMap[c] || c;
    });

    const obfPattern = letters.join("[\\s\\._\\-\\*\u200B]*");
    const regex = new RegExp(`(^|\\b|\\s|[.,!?;])${obfPattern}([.,!?;]|\\b|\\s|$)`, "gi");

    let foundMatch = false;

    // Direct check
    if (regex.test(text)) {
      foundMatch = true;
    } else if (regex.test(normalized)) {
      foundMatch = true;
    }

    if (foundMatch) {
      // Validate that this isn't an academic safe word
      const wordsInText = text.toLowerCase().split(/\s+/);
      const isWhitelisted = wordsInText.some((w) => ACADEMIC_SAFE_WORDS.has(w.replace(/[^a-z]/g, "")));

      // If text consists of only a safe academic word, skip
      if (isWhitelisted && ACADEMIC_SAFE_WORDS.has(text.trim().toLowerCase())) {
        continue;
      }

      matches.add(cleanWord);
      if (isCritical) {
        maxSeverity = "critical";
      } else if (maxSeverity !== "critical") {
        maxSeverity = "moderate";
      }

      // Mask in output
      maskedText = maskedText.replace(regex, (fullMatch) => {
        // preserve whitespace/punctuation at boundaries
        return fullMatch.replace(/[a-zA-Z0-9!@#$*]/g, "*");
      });
    }
  }

  return {
    containsAbuse: matches.size > 0,
    severity: maxSeverity,
    matches: Array.from(matches),
    maskedText,
    actionSuggestion:
      maxSeverity === "critical"
        ? "reject"
        : maxSeverity === "moderate"
        ? "mask"
        : "allow",
  };
}

/**
 * Advanced Spam, Phishing & Flooding Detector
 */
function checkSpam(userId, text) {
  if (!userId || !text) return { isSpam: false, reason: null, shouldBlock: false };

  const now = Date.now();
  let tracker = userSpamTrackers.get(userId);
  if (!tracker) {
    tracker = {
      lastText: "",
      repeatCount: 1,
      timestamps: [],
      violationCount: 0,
    };
    userSpamTrackers.set(userId, tracker);
  }

  // 1. Phishing / Unsafe Promo Link Detection
  const suspiciousLinkRegex = /(t\.me\/|telegram\.me\/|bit\.ly\/|tinyurl\.com\/|wa\.me\/|chat\.whatsapp\.com\/|discord\.gg\/)/i;
  if (suspiciousLinkRegex.test(text)) {
    tracker.violationCount += 2;
    return {
      isSpam: true,
      reason: "Promotional and external redirect links are not allowed in student chat.",
      shouldBlock: tracker.violationCount >= 4,
    };
  }

  // 2. Sliding window message frequency (max 5 messages in 10s)
  tracker.timestamps = tracker.timestamps.filter((ts) => now - ts < 10000);
  tracker.timestamps.push(now);

  if (tracker.timestamps.length > 5) {
    tracker.violationCount++;
    return {
      isSpam: true,
      reason: "Message flooding detected. Please wait a few moments before sending again.",
      shouldBlock: tracker.violationCount >= 3,
    };
  }

  // 3. Repeated exact message spam
  const cleanCurrent = text.trim().toLowerCase();
  if (cleanCurrent && cleanCurrent === tracker.lastText) {
    tracker.repeatCount++;
    if (tracker.repeatCount >= 3) {
      tracker.violationCount++;
      return {
        isSpam: true,
        reason: "Duplicate message spam detected. Please do not repeatedly send identical messages.",
        shouldBlock: tracker.repeatCount >= 4,
      };
    }
  } else {
    tracker.lastText = cleanCurrent;
    tracker.repeatCount = 1;
  }

  return { isSpam: false, reason: null, shouldBlock: false };
}

module.exports = {
  DEFAULT_ABUSIVE_WORDS,
  CRITICAL_WORDS,
  MODERATE_ABUSIVE_WORDS,
  ACADEMIC_SAFE_WORDS,
  cleanEvasions,
  analyzeAbuse,
  checkSpam,
};
