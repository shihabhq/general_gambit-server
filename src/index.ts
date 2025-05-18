import { Female, IMember, Male } from "./schema/Members.js";
import cors from "cors";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import axios from "axios";
import { Team } from "./schema/TeamSchema.js";
import { Server } from "socket.io";
import { createServer } from "http";

dotenv.config();

const app: express.Application = express();
const httpServer = createServer(app);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

let currentBid = 0;
let currentTeam: string | null = null;
let currentCaptain: string | null = null;

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.on("join-auction", () => {
    socket.emit("current-bid", {
      bid: currentBid,
      team: currentTeam,
      captain: currentCaptain,
    });
  });

  socket.on("bid-update", () => {
    socket.emit("current-bid", {
      bid: currentBid,
    });
  });

  // When a team places a bid
  socket.on("place-bid", ({ team, bid, captain }) => {
    if (bid > currentBid) {
      currentBid = bid;
      currentTeam = team;
      currentCaptain = captain;
      io.emit("current-bid", {
        bid: currentBid,
        captain: currentCaptain,
        team: currentTeam,
      });
    }
  });

  // When auctioneer closes the bid
  socket.on("close-bid", async ({ playerId, gender }) => {
    if (!currentTeam) {
      socket.emit("bid-close-error", "Failed to close bid.");
      return;
    }

    try {
      //get the team
      const team = await Team.findOne({ name: currentTeam });
      if (!team) {
        console.error("❌ Team not found for currentTeam:", currentTeam);
        return;
      }
      // Update player in DB
      const Model = gender === "male" ? Male : Female;
      await Model.findByIdAndUpdate(playerId, {
        price: currentBid,
        isSold: true,
        soldTo: team?._id,
      });

      // Update team's balance (optional — you'll need to fetch team info)
      await Team.findByIdAndUpdate(team?._id, {
        $inc: { balance: -currentBid },
      });

      io.emit("bid-closed", { playerId });
    } catch (err) {
      console.error("❌ DB Update Failed:", err);
      socket.emit("bid-close-error", "Failed to close bid.");
    } finally {
      // Reset
      currentBid = 0;
      currentCaptain = null;
      currentTeam = null;
      io.emit("current-bid", {
        bid: currentBid,
        team: currentTeam,
        captain: currentCaptain,
      });
    }
  });
  socket.on("reset", () => {
    currentBid = 0;
    currentCaptain = null;
    currentTeam = null;

    // 🔥 Inform all clients of the reset
    io.emit("current-bid", {
      bid: currentBid,
      team: currentTeam,
      captain: currentCaptain,
    });
  });
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("API is running");
});

app.get("/api/male", async (req, res): Promise<any> => {
  try {
    const maleMembers = await Male.find();
    res.json(maleMembers);
  } catch (error) {
    return res.status(400).json({ error: "No one available" });
  }
});

app.get("/api/female", async (req, res): Promise<any> => {
  try {
    const femaleMembers = await Female.find();
    res.json(femaleMembers);
  } catch (error) {
    return res.status(400).json({ error: "No one available" });
  }
});

app.get("/api/teams", async (req, res) => {
  try {
    const teams = await Team.find();

    const teamData = await Promise.all(
      teams.map(async (team) => {
        let players: IMember[] = [];

        if (team.gender === "male") {
          players = await Male.find({ soldTo: team._id });
        } else if (team.gender === "female") {
          players = await Female.find({ soldTo: team._id });
        }

        return {
          _id: team._id,
          name: team.name,
          captain: team.captain,
          captainImage: team.captainImage,
          gender: team.gender,
          email: team.email,
          balance: team.balance,
          type: team.type,
          players,
        };
      })
    );

    res.json(teamData);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.delete(
  "/api/players/:id",
  async (req: Request, res: Response): Promise<any> => {
    const { id } = req.params;
    const { gender } = req.query;

    if (!gender || (gender !== "male" && gender !== "female")) {
      return res
        .status(400)
        .json({ error: 'Gender must be "male" or "female"' });
    }

    try {
      const Model = gender === "male" ? Male : Female;
      const deleted = await Model.findByIdAndDelete(id);

      if (!deleted) {
        return res.status(404).json({ error: "Player not found" });
      }

      return res.status(200).json({ message: "Player deleted successfully" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

app.post("/api/team", async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, gender, captain, captainImage } = req.body;

    if (!name || !gender || !email || !captain || !captainImage) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newTeam = new Team({
      email,
      name,
      gender,
      captain,
      captainImage,
    });

    const savedTeam = await newTeam.save();
    return res.status(201).json(savedTeam);
  } catch (error) {
    console.error("Error creating team:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/member", async (req, res): Promise<any> => {
  const { name, gender, image, isStar, playerNumber, position } = req.body;

  if (
    !name ||
    !gender ||
    !image ||
    isStar === undefined ||
    !playerNumber ||
    !position
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const number = parseInt(playerNumber, 10);
  if (isNaN(number)) {
    return res
      .status(400)
      .json({ error: "playerNumber must be a valid number" });
  }

  try {
    const memberData = {
      name,
      gender,
      image,
      isStar,
      number,
      position,
    };

    let savedMember;

    if (gender === "male") {
      savedMember = await new Male(memberData).save();
    } else if (gender === "female") {
      savedMember = await new Female(memberData).save();
    } else {
      return res.status(400).json({ error: "Invalid gender" });
    }

    res.status(201).json(savedMember);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

app.get("/api/team", async (req, res): Promise<any> => {
  const email = req.query.email as string;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const team = await Team.findOne({ email });
    if (!team) {
      return res.status(404).json({ message: "Team not found for this user" });
    }
    res.json(team);
  } catch (error) {
    console.error("[GET /api/team] Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

app.get("/api/teamplayers", async (req, res): Promise<any> => {
  const email = req.query.email as string;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const team = await Team.findOne({ email });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    let players: IMember[] = [];

    if (team.gender === "male") {
      players = await Male.find({ soldTo: team._id });
    } else if (team.gender === "female") {
      players = await Female.find({ soldTo: team._id });
    }

    res.status(200).json({ team, players });
  } catch (error) {
    console.error("Error fetching team players:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(` Server running at http://localhost:${PORT}`);
  });
});
