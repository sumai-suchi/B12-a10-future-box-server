const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://future-box-rosy.vercel.app",
    ],
    credentials: true,
  })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cgi21.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("Future_Box_DB");
    const courseCollection = db.collection("Courses");
    const completedCourseCollection = db.collection("completedCourses");
    const enrollCollection = db.collection("enrolledInfo");
    const InstructorsCollection = db.collection("Instructors");
    const usersCollection = db.collection("users");
    const paymentCollection = db.collection("payments");
   
  
    app.get("/courses", async (req, res) => {
      try {
        const category = req.query.category;
        let query = {};
        if (category) {
          query = { category: { $regex: new RegExp(category, "i") } };
        }

        const courses = courseCollection.find(query);
        const result = await courses.toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to fetch data" });
      }
    });

    app.get("/admin/all-stats", async (req, res) => {
      try {
        const users = await usersCollection.countDocuments({
          role: "student",
        });
        const completedCourse = await completedCourseCollection.countDocuments();
        const active = await enrollCollection.countDocuments({
          status: "active",
        });

        const inactive = await enrollCollection.countDocuments({
          status: "inactive",
        });

        const payments = await paymentCollection.find().toArray();
        const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);

        console.log(users, completedCourse, active, inactive, totalRevenue);
        res.send({
          users,
          completedCourse,
          active,
          inactive,
          totalRevenue,
        });
      } catch (error) {
        console.error("all-stats error:", error);
        res.status(500).send({ message: "Failed to fetch stats" });
      }
    });

    app.get("/admin/all-enrollments", async (req, res) => {
      try {
        const result = await enrollCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to fetch all enrollments" });
      }
    });

    app.get("/user", async (req, res) => {
   
       
      const users = usersCollection.find();
      const result = await users.toArray();
      res.send(result);
      
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      console.log(existingUser);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      user.role = "student";
      console.log(user);
      user.createdAt = new Date();
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users/role", async (req, res) => {
      const email = req.query.email;
      console.log(email);

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const user = await usersCollection.findOne({ email });
      console.log(user);

      // if (!user) {
      //   return res.status(404).send({ role: null });
      // }

      res.send(user);
    });

    //CourseDetails
    app.get("/viewDetails/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };

      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    app.post("/enrolledUserData", async (req, res) => {
      try {
        const data = req.body;

        // Remove any _id field from frontend
        if (data._id) delete data._id;

        if (!data.email || !data.title || !data.category) {
          return res
            .status(400)
            .json({ message: "Email, title, and category are required" });
        }

        // Optional: check if user already enrolled
        const alreadyEnrolled = await enrollCollection.findOne({
          email: data.email,
          title: data.title,
        });

        if (alreadyEnrolled) {
          return res
            .status(400)
            .json({ message: "You have already enrolled in this course." });
        }

        const result = await enrollCollection.insertOne(data);

        res.status(201).json({
          message: "Enrollment successful",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Enroll API error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/addedCourses/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/EnrolledData", async (req, res) => {
      try {
        const email = req.query.email;
        console.log(email);

        if (!email) {
          return res
            .status(400)
            .send({ message: "email query parameter is required" });
        }

        const query = { email };
        console.log(query);

        const result = enrollCollection.find(query);
        const data = await result.toArray();

        res.send(data);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { price } = req.body;
        if (!price || isNaN(price) || parseFloat(price) <= 0) {
          return res.status(400).send({ message: "Invalid price format" });
        }
        const amount = Math.round(parseFloat(price) * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Create payment intent error:", error);
        res.status(500).send({ message: "Failed to create payment intent" });
      }
    });

    app.post("/payments", async (req, res) => {
      try {
        const payment = req.body;
        if (!payment.email || !payment.courseId || !payment.price || !payment.transactionId) {
          return res.status(400).send({ message: "Missing required payment fields" });
        }

        if (payment._id) delete payment._id;

        // 1. Save payment record
        const paymentResult = await paymentCollection.insertOne(payment);

        // 2. Enroll student in the course
        const course = await courseCollection.findOne({ _id: new ObjectId(payment.courseId) });
        if (!course) {
          return res.status(404).send({ message: "Course not found" });
        }

        const enrollmentInfo = {
          email: payment.email,
          title: course.title,
          category: course.category,
          price: course.price,
          instructor: course.instructor,
          image: course.image,
          duration: course.duration,
          level: course.level,
          status: "active",
          enrolledAt: new Date(),
          transactionId: payment.transactionId
        };

        const alreadyEnrolled = await enrollCollection.findOne({
          email: payment.email,
          title: course.title,
        });

        let enrollResult = { insertedId: null };
        if (!alreadyEnrolled) {
          enrollResult = await enrollCollection.insertOne(enrollmentInfo);
        } else {
          enrollResult = { message: "Already enrolled", insertedId: alreadyEnrolled._id };
        }

        res.status(201).send({ paymentResult, enrollResult });
      } catch (error) {
        console.error("Payments API error:", error);
        res.status(500).send({ message: "Failed to process payment record and enrollment" });
      }
    });

    app.get("/payments", async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};
        if (email) {
          query = { email: email };
        }
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Fetch payments error:", error);
        res.status(500).send({ message: "Failed to fetch payments data" });
      }
    });
    //completed course data

    app.post("/CompletedCourses", async (req, res) => {
      const data = req.body;
      if (data._id) delete data._id;
      console.log(data);
      const result = await completedCourseCollection.insertOne(data);
      res.send(result);
    });

    app.get("/dashboardInfo", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      let query = {};
      if (!email) {
        return res
          .status(400)
          .send({ message: "email query parameter is required" });
      }
      try {
        query = { email };
        const addedCourseData = enrollCollection.find(query);
        const result = await addedCourseData.toArray();
        const completedCourseData = completedCourseCollection.find(query);
        res.send({
          addedCourseData: result,
          completedCourseData: await completedCourseData.toArray(),
        });
      } catch (error) {
        res.status(500).send({ message: "Server error fetching course" });
      }
    });

    //added course

    app.post("/addedCourses", async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await courseCollection.insertOne(data);
      res.send(result);
    });
    //user added course get

    app.get("/addedCourses", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      let query = {};
      if (!email) {
        return res
          .status(400)
          .send({ message: "email query parameter is required" });
      }

      try {
        query = { email };

        const user = await usersCollection.findOne(query);
        console.log(user);
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        if(user?.role === 'admin'){
          const addedCourseData = courseCollection.find();
          const result = await addedCourseData.toArray();
          console.log(result);
          res.send(result);
        }
        else{
          res.send({message:"You are not admin"})
        }
      } catch (error) {
        res.status(500).send({ message: "Server error fetching course" });
      }
    });

    //Update course data get
    app.get("/updateData/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);

      res.send(result);
    });

    app.patch("/updateData/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const updatedData = req.body;
      const updatedDoc = {
        $set: updatedData,
      };
      const data = await courseCollection.updateOne(query, updatedDoc);

      res.send(data);
    });
    //get instructor data

    app.get("/InstructorData", async (req, res) => {
      const Data = InstructorsCollection.find();
      const result = await Data.toArray();
      res.send(result);
    });
    //get Category
    app.get("/Category", async (req, res) => {
      try {
        const result = await courseCollection
          .aggregate([
            { $group: { _id: "$category" } },
            { $project: { _id: 0, category: "$_id" } },
          ])
          .toArray();

        const categoryList = result.map((c) => c.category);

        res.send(categoryList);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    ///Intregated ai

    app.post("/api/chat", async (req, res) => {
      try {
        const { message } = req.body;

        console.log("BODY:", req.body);

        if (!message || typeof message !== "string") {
          return res.status(400).json({
            success: false,
            message: "Message is required",
          });
        }
        const SYSTEM_PROMPT = `
              You are an AI study mentor.

               You MUST always respond in this structure:

                     ### 📌 Short Answer
                 (2–3 lines simple explanation)

                ### 🧠 Step-by-Step Breakdown
               - Point 1
               - Point 2
               - Point 3

               ### 💡 Example (if needed)
              Give a simple real-life or coding example

              ### 🚀 Final Tip
              One motivational or practical tip

              Rules:
             - Always use headings
             - Always use bullet points
             - Never write long paragraphs
             - Keep it clean and structured
           `;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                   text: `${SYSTEM_PROMPT}\n\nUser Question:\n${message}`,
                },
              ],
            },
          ],
        });
        console.log("RESPONSE:", response);

        // Safe extraction (works across SDK variations)
        // const reply = response.text?.() || response.response?.text?.() || "";
        const reply = response.text || response.response.text || "";

        return res.json({
          success: true,
          reply,
        });
      } catch (error) {
        console.log("CHAT API ERROR:", error);

        return res.status(500).json({
          success: false,
          message: "Failed to generate response",
        });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running on 300");
});

app.listen(port, () => {
  console.log(`The port is running on ${port}`);
});
