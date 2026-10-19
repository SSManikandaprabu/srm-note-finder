const { io } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
require("dotenv").config({ path: "./backend/.env" });

const JWT_SECRET = process.env.JWT_SECRET || "srm-note-finder-secret";
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Simulated Students
const STUDENTS = [
  { id: new mongoose.Types.ObjectId().toString(), email: "student_alpha@srmist.edu.in", name: "Alpha Student" },
  { id: new mongoose.Types.ObjectId().toString(), email: "student_beta@srmist.edu.in", name: "Beta Student" },
  { id: new mongoose.Types.ObjectId().toString(), email: "student_spammer@srmist.edu.in", name: "Spammer Account" },
  { id: new mongoose.Types.ObjectId().toString(), email: "student_abuser@srmist.edu.in", name: "Abusive Tester" },
];

function generateToken(student) {
  return jwt.sign(
    { sub: student.id, email: student.email, username: student.name, role: "student" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

const adminToken = jwt.sign(
  { username: "admin", role: "admin" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

async function runStressAndReliabilityTests() {
  console.log("=========================================================");
  console.log("🚀 STARTING SRM NOTE FINDER END-TO-END STRESS & VERIFICATION");
  console.log("=========================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(title, condition, extraInfo = "") {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${title} ${extraInfo}`);
    } else {
      console.error(`  ❌ [FAIL] ${title} ${extraInfo}`);
    }
  }

  // ----------------------------------------------------
  // TEST 1: Simultaneous Multi-Student Socket Connections
  // ----------------------------------------------------
  console.log("TEST 1: Simultaneous Multi-Student Connections & Chat Room Joining");
  const sockets = [];

  for (const s of STUDENTS) {
    const token = generateToken(s);
    const socket = io("http://localhost:5000", {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push({ student: s, socket, token });
  }

  await new Promise((resolve) => setTimeout(resolve, 800));

  const allConnected = sockets.every((s) => s.socket.connected);
  assert("Simultaneous Socket Connection (4 concurrent students)", allConnected, `(${sockets.filter(s => s.socket.connected).length}/${sockets.length} connected)`);

  // ----------------------------------------------------
  // TEST 2: Normal Real-time Broadcast Across Students
  // ----------------------------------------------------
  console.log("\nTEST 2: Real-time Message Broadcast Between Students");
  const alpha = sockets[0];
  const beta = sockets[1];

  let betaReceivedMessage = null;
  beta.socket.on("community:message", (msg) => {
    betaReceivedMessage = msg;
  });

  alpha.socket.emit("community:send", {
    text: "Hey everyone! Does anyone have the Unit 3 DBMS notes?",
  });

  await new Promise((resolve) => setTimeout(resolve, 600));
  assert(
    "Real-Time Delivery from Student Alpha to Student Beta",
    betaReceivedMessage && betaReceivedMessage.text.includes("Unit 3 DBMS notes"),
    `Received: "${betaReceivedMessage?.text || "None"}"`
  );

  // ----------------------------------------------------
  // TEST 3: Advanced Abusive-Word Evasion & Masking
  // ----------------------------------------------------
  console.log("\nTEST 3: Advanced Anti-Evasion Profanity Masking in Live Socket");
  const abuser = sockets[3];
  let maskedBroadcast = null;

  beta.socket.on("community:message", (msg) => {
    if (msg.senderId === abuser.student.id) {
      maskedBroadcast = msg;
    }
  });

  // Sending obfuscated abusive word: "b!tch" and "f.u.c.k"
  abuser.socket.emit("community:send", {
    text: "This exam was total bullshit and the teacher is a b!tch",
  });

  await new Promise((resolve) => setTimeout(resolve, 600));
  const isProperlyMasked = maskedBroadcast && !maskedBroadcast.text.toLowerCase().includes("bullshit") && !maskedBroadcast.text.toLowerCase().includes("b!tch");
  assert(
    "Anti-Evasion Detection Masks Obfuscated Terms on Broadcast",
    isProperlyMasked,
    `Broadcasted as: "${maskedBroadcast?.text || "None"}"`
  );

  // ----------------------------------------------------
  // TEST 4: Anti-Spam & Message Flooding Rate Limiting
  // ----------------------------------------------------
  console.log("\nTEST 4: Spam & Flood Cooldown Enforcement");
  const spammer = sockets[2];
  let spamErrors = [];

  spammer.socket.on("chat:error", (err) => {
    spamErrors.push(err.message);
  });

  // Send 6 identical messages rapidly to trigger duplicate and rate limiting
  for (let i = 0; i < 6; i++) {
    spammer.socket.emit("community:send", {
      text: "SPAM PROMOTION TEST JOIN MY LINK",
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 800));
  assert(
    "Anti-Flood / Spam Shield Blocks Rapid Flooding",
    spamErrors.length > 0 && spamErrors.some((e) => e.toLowerCase().includes("spam") || e.toLowerCase().includes("slow down") || e.toLowerCase().includes("wait")),
    `Triggered alerts: ${spamErrors.length}`
  );

  // ----------------------------------------------------
  // TEST 5: Private Message Isolation (Student Privacy)
  // ----------------------------------------------------
  console.log("\nTEST 5: Private Message Security & Student Isolation");
  // Student Alpha sends a private message to Admin
  const sendRes = await fetch("http://localhost:5000/api/private-chat/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${alpha.token}`,
    },
    body: JSON.stringify({ text: "Confidential query for the professor/admin only." }),
  });
  const sendData = await sendRes.json();
  assert("Student Alpha Can Send Private Message to Admin", sendRes.ok && sendData.success);

  // Student Beta attempts to read private messages (should only see Beta's, never Alpha's)
  const betaHistoryRes = await fetch("http://localhost:5000/api/private-chat/messages", {
    headers: { Authorization: `Bearer ${beta.token}` },
  });
  const betaHistory = await betaHistoryRes.json();
  const leakedAlphaMessage = (betaHistory.messages || []).some(m => m.text.includes("Confidential query"));
  assert("Private Message Isolation (Beta cannot see Alpha's private chat)", !leakedAlphaMessage, `Found leaked messages: ${leakedAlphaMessage ? "YES (FAILED)" : "NO (SECURE)"}`);

  // ----------------------------------------------------
  // TEST 6: Admin Message Deletion API
  // ----------------------------------------------------
  console.log("\nTEST 6: Admin Moderation Message Deletion");
  if (sendData.message?._id) {
    const deleteRes = await fetch(`http://localhost:5000/api/private-chat/admin/messages/${sendData.message._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteData = await deleteRes.json();
    assert("Admin Message Deletion API", deleteRes.ok && deleteData.success, `Deleted ID: ${sendData.message._id}`);
  }

  // ----------------------------------------------------
  // Clean up sockets
  // ----------------------------------------------------
  sockets.forEach((s) => s.socket.disconnect());

  console.log("\n=========================================================");
  console.log(`🏁 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("=========================================================\n");
}

runStressAndReliabilityTests().catch(console.error);
