import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import axios from "axios";
import nodemailer from "nodemailer"
import Fuse from "fuse.js";

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
  top: String,
  left: String,
});

// Parking Space Schema (Stores slots inside a named parking space)
const parkingSpaceSchema = new mongoose.Schema({
  name: String, // Name of the parking space
  address:String,
  location:{"lat":Number,"lon":Number},
  layout:String,
  slots: [slotSchema], // Array of parking slots
});

// Bookings Schema
const bookingSchema = new mongoose.Schema({
  parkingName: String,
  address: String,
  slotId: Number,
  username: String,
  userEmail: String,
  duration:String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  bookedAt: { type: Date, default: Date.now },
  bookingStatus: { type: String, enum: ["Booked", "Cancelled", "Completed"], default: "Booked" }, // NEW FIELD
});
const Booking = mongoose.model("Booking", bookingSchema);

const ParkingSpace = mongoose.model("ParkingSpace", parkingSpaceSchema);

// API to add a new parking space with slots
app.post("/add-parking", async (req, res) => {
  try {
    const { name, slots,address,location,layout } = req.body;

    const newParkingSpace = new ParkingSpace({
      name,
      address,
      location,
      layout,
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

app.get("/parking-space/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const parkingSpace = await ParkingSpace.findById(id);
    if (!parkingSpace) {
      return res.status(404).json({ message: "Parking space not found" });
    }

    res.json(parkingSpace);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch parking space" });
  }
});


// API to book a parking slot
// app.post("/book-slot", async (req, res) => {
//   try {
//     const { name, slotId } = req.body;

//     const parkingSpace = await ParkingSpace.findOne({ name });
//     if (!parkingSpace) return res.status(404).json({ message: "Parking space not found" });

//     const slot = parkingSpace.slots.find((s) => s.slotId === slotId);
//     if (!slot) return res.status(404).json({ message: "Slot not found" });
//     if (slot.status === "occupied") return res.status(400).json({ message: "Slot already booked" });

//     slot.status = "occupied";
//     await parkingSpace.save();

//     res.json({ message: "Slot booked successfully" });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to book slot" });
//   }
// });

// API to update a parking slot (change status or position)
app.put("/update-slot/:id", async (req, res) => {

  const {id}=req.params;

  try {
    const { slotId, status, x, y } = req.body;
    
    const parkingSpace = await ParkingSpace.findById(id);
    // console.log(id)
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

// Book a Parking Slot
app.post("/book-slot", async (req, res) => {
  try {
    const { name, address, slotId, username, userEmail, duration, userId } = req.body;

    // Save booking details in the database (Booking Status = "Booked")
    const newBooking = new Booking({
      parkingName: name,
      address,
      slotId,
      username,
      userEmail,
      userId,
      duration,
      bookingStatus: "Booked",
    });
    await newBooking.save();

    res.status(201).json({ success: true, message: "Slot booked successfully", bookedSlot: newBooking });
  } catch (error) {
    res.status(500).json({ error: "Failed to book slot" });
  }
});

// 📌 Cancel a Booking
app.post("/cancel-slot/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Update Booking Status to "Cancelled"
    await Booking.findByIdAndUpdate(id,{ bookingStatus: "Cancelled" });

    res.json({ message: "Slot booking canceled successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel slot booking" });
  }
});

// 📌 Mark Booking as Completed (For Admin Use)
app.post("/complete-booking", async (req, res) => {
  try {
    const { name, slotId, userId } = req.body;

    // Find the booking and update its status to "Completed"
    const booking = await Booking.findOneAndUpdate(
      { parkingName: name, slotId, userId, bookingStatus: "Booked" },
      { bookingStatus: "Completed" },
      { new: true }
    );

    if (!booking) return res.status(404).json({ message: "Booking not found or already completed" });

    res.json({ message: "Booking marked as completed", booking });
  } catch (error) {
    res.status(500).json({ error: "Failed to complete booking" });
  }
});

// 📌 Get All Bookings (Admin Panel)
app.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});
app.get("/bookings/:id", async (req, res) => {

  const {id}=req.params

  try {
    const bookings = await Booking.findById(id);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phone: Number,
  isAdmin: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);
const JWT_SECRET="7fd8463fce0fc7f571dbb0677bb7daa8a4c459984326170deaf7952526a5678b"

app.post('/signup', async (req, res) => {
  try {
      const { name, email, password, phone } = req.body;
      
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      console.log(name)
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ name, email, password: hashedPassword, phone});
      await newUser.save();

      const token = jwt.sign({ id: newUser._id, email: newUser.email, isAdmin: newUser.isAdmin }, JWT_SECRET, { expiresIn: '1h' });

      res.status(201).json({ message: 'User registered successfully', token, isAdmin: newUser.isAdmin });
  } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
      console.log(error)
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
          return res.status(401).json({ message: 'Invalid email or password' });
      }

      console.log(user)

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
          return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = jwt.sign({ id: user._id, name:user.name, email: user.email,phone:user.phone,isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1h' });

      res.status(200).json({ message: 'Login successful', token, isAdmin: user.isAdmin });
  } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
  }
});


const transporter = nodemailer.createTransport({
  service: "gmail", // Use Gmail, Outlook, Yahoo, etc.
  auth: {
    user: "arlendmello1@gmail.com",
    pass: "treswcxenidqoydw",
  },
});


// API for search
app.post("/search", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ message: "Query is required" });

    // Fetch all parking spaces from MongoDB
    const parkingSpaces = await ParkingSpace.find();

    // Configure Fuse.js for fuzzy search
    const fuse = new Fuse(parkingSpaces, {
      keys: ["name"],  // Search based on parking space name
      threshold: 0.3,  // Adjust sensitivity (lower = stricter, higher = lenient)
    });

    // Perform search
    const results = fuse.search(query).map(result => result.item);

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to search parking spaces" });
  }
});



// API route to send emails
app.post("/send-email", async (req, res) => {
  const { to, subject, html } = req.body;

  const mailOptions = {
    from: "arlendmello1@gmail.com",
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});


app.get('/empty', (req, res) => {
    res.sendStatus(200);
});

setInterval(()=>{
    try {
        const res=axios.get("https://parkvox-backend-zx9e.onrender.com/empty")
    } catch (error) {
        console.log(error)
    }
},600000)

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
