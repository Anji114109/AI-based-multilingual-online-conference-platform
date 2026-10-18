import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import os from "os";
import { Server } from "socket.io";
import {
  closeWhisperConnection,
  connectToWhisper,
  sendAudioChunk,
  sendLanguageUpdate,
} from "./sockets/pythonSocketClient.js";
import { connectMongo } from "./db/mongo.js";
import { ensureIndexes } from "./db/setupIndexes.js";
import { verifyAppToken } from "./middleware/auth.js";
import {
  ensureMeetingForHost,
  markParticipantLeft,
  upsertMeetingParticipant,
} from "./services/meetingPersistenceService.js";
import { closeMongo } from "./db/mongo.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000,
});

global.io = io;

const meetingHosts = new Map();
const pendingJoinRequests = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }

    socket.user = verifyAppToken(token);
    return next();
  } catch (err) {
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Browser connected:", socket.id);

  let meetingId = null;
  let speakerId = null;

  // 🔥 When user joins meeting
  socket.on("join-meeting", async ({ meeting_id, speaker_id, display_name, role }) => {
    meetingId = meeting_id;
    speakerId = speaker_id;

    socket.join(meetingId);

    console.log(`🎯 ${socket.id} joined meeting ${meetingId}`);

    await upsertMeetingParticipant({
      meetingId,
      userId: socket.user?.userId || speakerId,
      displayName: display_name || socket.user?.username,
      role: role || "guest",
      socketId: socket.id,
    });

    // 🔥 Connect Python ASR for this meeting
    connectToWhisper({
      connectionId: socket.id,
      meetingId,
      speakerId,
      displayName: display_name || socket.user?.username,
    });
  });

  socket.on("register-host", async ({ meetingId: roomId, hostName, hostId, meetingSubject }) => {
    if (!roomId) return;

    meetingHosts.set(roomId, {
      socketId: socket.id,
      hostName: hostName || "Host",
      hostId: hostId || socket.id,
      meetingSubject: meetingSubject || "General Discussion",
    });

    socket.join(`host:${roomId}`);
    console.log(`👑 Host registered for ${roomId}: ${socket.id}`);

    await ensureMeetingForHost({
      meetingId: roomId,
      hostId: socket.user?.userId || hostId,
      hostName: hostName || socket.user?.username,
      subject: meetingSubject || "General Discussion",
    });

    await upsertMeetingParticipant({
      meetingId: roomId,
      userId: socket.user?.userId || hostId,
      displayName: hostName || socket.user?.username,
      role: "host",
      socketId: socket.id,
    });
  });

  socket.on("request-join", ({ meetingId: roomId, requesterName, requesterId }) => {
    if (!roomId) return;

    const hostInfo = meetingHosts.get(roomId);
    if (!hostInfo?.socketId) {
      socket.emit("join-response", {
        accepted: false,
        reason: "Host is not available. Try again in a moment.",
        hostName: null,
      });
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    pendingJoinRequests.set(requestId, {
      requesterSocketId: socket.id,
      meetingId: roomId,
      requesterName: requesterName || "Guest",
      requesterId: requesterId || socket.id,
      createdAt: Date.now(),
    });

    io.to(hostInfo.socketId).emit("join-request", {
      requestId,
      meetingId: roomId,
      requesterName: requesterName || "Guest",
      requesterId: requesterId || socket.id,
    });
  });

  socket.on("respond-join-request", ({ requestId, accepted }) => {
    const request = pendingJoinRequests.get(requestId);
    if (!request) return;

    pendingJoinRequests.delete(requestId);

    io.to(request.requesterSocketId).emit("join-response", {
      accepted: !!accepted,
      meetingId: request.meetingId,
      reason: accepted ? null : "Host declined your request.",
      hostName: meetingHosts.get(request.meetingId)?.hostName || "Host",
      meetingSubject: meetingHosts.get(request.meetingId)?.meetingSubject || "General Discussion",
    });
  });

  // 🔥 Audio streaming
  socket.on("audio-chunk", (chunk) => {
    if (!meetingId) return;
    sendAudioChunk(socket.id, chunk);
  });

  // 🔥 Language switching
  socket.on("set-language", (lang) => {
    if (!meetingId) return;

    console.log(`🌍 ${socket.id} selected language:`, lang);
    sendLanguageUpdate(socket.id, lang);
  });

  socket.on("disconnect", () => {
    closeWhisperConnection(socket.id);

    if (meetingId) {
      markParticipantLeft({ meetingId, socketId: socket.id }).catch((err) => {
        console.error("Participant leave persistence error:", err.message);
      });
    }

    for (const [roomId, hostInfo] of meetingHosts.entries()) {
      if (hostInfo.socketId === socket.id) {
        meetingHosts.delete(roomId);
      }
    }

    for (const [requestId, request] of pendingJoinRequests.entries()) {
      if (request.requesterSocketId === socket.id) {
        pendingJoinRequests.delete(requestId);
      }
    }

    console.log("🔴 Browser disconnected:", socket.id);
  });
});

// 🔥 Get local IP
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
};

const localIP = getLocalIP();

const tryReachExistingBackend = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/`, {
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) return false;
    const payload = await response.json();

    return payload?.status?.includes("Backend running") || false;
  } catch {
    return false;
  }
};

const listenAsync = (port) =>
  new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off("listening", onListening);
      reject(err);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "0.0.0.0");
  });

const startServer = async () => {
  await connectMongo();
  await ensureIndexes();

  try {
    await listenAsync(PORT);
    console.log("🚀 Backend running at:");
    console.log(`👉 Local:   http://localhost:${PORT}`);
    console.log(`👉 Network: http://${localIP}:${PORT}`);
  } catch (err) {
    if (err?.code === "EADDRINUSE") {
      const existingBackend = await tryReachExistingBackend();
      if (existingBackend) {
        console.log(`ℹ Backend already running on port ${PORT}.`);
        console.log("ℹ Skipping duplicate instance start.");
        await closeMongo();
        process.exit(0);
      }

      throw new Error(
        `Port ${PORT} is already in use by another process. Free the port or change PORT in .env`
      );
    }

    throw err;
  }
};

startServer().catch((err) => {
  console.error("❌ Failed to start backend:", err.message);
  process.exit(1);
});