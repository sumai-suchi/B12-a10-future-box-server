const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;

app.use(cors());
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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("Future_Box_DB");
    const courseCollection = db.collection("Courses");
    const enrollCollection = db.collection("enrolledInfo");
    const InstructorsCollection = db.collection("Instructors");

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

    //CourseDetails
    app.get("/viewDetails/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };

      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    app.post("/enrolledUserData", async (req, res) => {
      const data = req.body;
      const result = await enrollCollection.insertOne(data);
      res.send(result);
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
        // console.log(email);
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
        const addedCourseData = courseCollection.find(query);
        const result = await addedCourseData.toArray();
        res.send(result);
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
