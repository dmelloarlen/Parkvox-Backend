import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB and ensure data is stored in PARKVOX
mongoose
  .connect("mongodb+srv://arlendmello03:arlen1911@ocb-cluster.cnudxss.mongodb.net/PARKVOX?retryWrites=true&w=majority&appName=OCB-Cluster", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "PARKVOX", // Ensure data is stored in PARKVOX database
  })
  .then(() => console.log("Connected to MongoDB - PARKVOX"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// Parking Slot Schema
const slotSchema = new mongoose.Schema({
  slotId: Number,
  status: { type: String, enum: ["empty", "occupied"], default: "empty" },
  x: Number,
  y: Number,
});

// Parking Space Schema (Stores slots inside a named parking space)
const parkingSpaceSchema = new mongoose.Schema({
  name: String, // Name of the parking space
  address:String,
  location:{"lat":Number,"lon":Number},
  slots: [slotSchema], // Array of parking slots
});

const ParkingSpace = mongoose.model("ParkingSpace", parkingSpaceSchema);

// API to add a new parking space with slots
app.post("/add-parking", async (req, res) => {
  try {
    const { name, slots,address,location } = req.body;

    const newParkingSpace = new ParkingSpace({
      name,
      address,
      location,
      slots,
    });

    await newParkingSpace.save();
    res.json({ message: "Parking space added successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to add parking space" });
  }
});

// API to get all parking spaces with their slots
app.get("/parking-spaces", async (req, res) => {
  try {
    const parkingSpaces = await ParkingSpace.find();
    res.json(parkingSpaces);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch parking spaces" });
  }
});

// API to book a parking slot
app.post("/book-slot", async (req, res) => {
  try {
    const { name, slotId } = req.body;

    const parkingSpace = await ParkingSpace.findOne({ name });
    if (!parkingSpace) return res.status(404).json({ message: "Parking space not found" });

    const slot = parkingSpace.slots.find((s) => s.slotId === slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });
    if (slot.status === "occupied") return res.status(400).json({ message: "Slot already booked" });

    slot.status = "occupied";
    await parkingSpace.save();

    res.json({ message: "Slot booked successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to book slot" });
  }
});

// API to update a parking slot (change status or position)
app.put("/update-slot", async (req, res) => {
  try {
    const { name, slotId, status, x, y } = req.body;

    const parkingSpace = await ParkingSpace.findOne({ name });
    if (!parkingSpace) return res.status(404).json({ message: "Parking space not found" });

    const slot = parkingSpace.slots.find((s) => s.slotId === slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    if (status) slot.status = status;
    if (x !== undefined) slot.x = x;
    if (y !== undefined) slot.y = y;

    await parkingSpace.save();
    res.json({ message: "Slot updated successfully", updatedSlot: slot });
  } catch (error) {
    res.status(500).json({ error: "Failed to update slot" });
  }
});

// API to reset all slots inside a parking space
// app.post("/reset-slots", async (req, res) => {
//   try {
//     const { name } = req.body;

//     const parkingSpace = await ParkingSpace.findOne({ name });
//     if (!parkingSpace) return res.status(404).json({ message: "Parking space not found" });

//     parkingSpace.slots.forEach((slot) => (slot.status = "empty"));
//     await parkingSpace.save();

//     res.json({ message: "All slots reset to empty" });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to reset slots" });
//   }
// });

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
