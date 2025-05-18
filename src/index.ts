import { Female, IMember, Male } from "./schema/Members.js";
import cors from "cors";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import axios from "axios";
import { Team } from "./schema/TeamSchema.js";

dotenv.config();

const app: express.Application = express();

const PORT = process.env.PORT || 3000;
app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
  })
);

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
  const { name, gender, image, isStar, playerNumber } = req.body;

  if (!name || !gender || !image || isStar === undefined || !playerNumber) {
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



connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
