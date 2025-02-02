const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const path = require("path");
const { spawn } = require("child_process");

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// MongoDB Atlas connection string
const uri = process.env.MONGODB_URI;


// workflow
// import { Octokit } from "@octokit/rest";
const { Octokit } = require("@octokit/rest");

// Initialize Octokit with your GitHub token
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

app.post("/trigger-workflow", async (req, res) => {
  try {
    await octokit.actions.createWorkflowDispatch({
      owner: 'LirjaPatel',
      repo: 'Resume_Analysis',
      workflow_id: 'notebook.yml', // The filename of your workflow
      ref: 'main' // The branch to run the workflow on
    });
    res.json({ success: true, message: "Workflow triggered successfully" });
  } catch (error) {
    console.error("Error triggering workflow:", error);
    res.status(500).json({ success: false, error: "Error triggering workflow" });
  }
});


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// connecting to MongoDB Atlas
async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB Atlas");
    return client.db("ResumeDatabase").collection("Resume");
  } catch (error) {
    console.error("Error connecting to MongoDB Atlas:", error);
    throw error;
  }
}

let resumesCollection;

connectToDatabase()
  .then((collection) => {
    resumesCollection = collection;
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  });

// middleware Configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.static(__dirname));

app.use(cors());

// File upload configuration
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb("Error: Only PDF, DOC, and DOCX files are allowed!");
    }
  },
}).single("resume");

//Defines a route for handling file uploads
app.post("/upload", (req, res) => {
  console.log("Received upload request");
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err);
      return res
        .status(400)
        .json({ success: false, error: "File upload error: " + err.message });
    } else if (err) {
      console.error("Unknown error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Unknown error: " + err.message });
    }

    if (!req.file) {
      console.error("No file uploaded");
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    console.log("File received:", req.file.originalname);

    try {
      const newResume = {
        filename: req.file.originalname,
        content: req.file.buffer,
        contentType: req.file.mimetype,
        uploadedAt: new Date(),
      };
      const result = await resumesCollection.insertOne(newResume);
      console.log("File uploaded successfully:", result);
      res.json({ success: true, message: "File uploaded successfully" });
    } catch (error) {
      console.error("Error saving file to database:", error);
      res.status(500).json({
        success: false,
        error: "Error saving file to database: " + error.message,
      });
    }
  });
});

//Defines a route to check the database connection.
app.get("/check-connection", async (req, res) => {
  try {
    await resumesCollection.findOne({});
    res.json({ success: true, message: "Database connection is working" });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({
      success: false,
      error: "Database connection error: " + error.message,
    });
  }
});

//Defines a route to process uploaded resumes.
app.get("/process-resumes", async (req, res) => {
  try {
    const allResumes = await resumesCollection.find({}).toArray();
    console.log(`Found ${allResumes.length} resumes in the database.`);

    for (const resume of allResumes) {
      const filename = resume.filename || "Unknown";
      const content = resume.content;
      const contentType = resume.contentType;

      console.log(`Processing: ${filename}`);

      if (contentType === "application/pdf") {
        console.log("PDF processing would occur here");
      } else if (
        contentType === "application/msword" ||
        contentType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        console.log("Word document processing would occur here");
      } else {
        console.log(`Unsupported file type: ${contentType}`);
      }

      console.log("------------------------");
    }

    res.json({ success: true, message: "Resume processing completed" });
  } catch (error) {
    console.error("Error processing resumes:", error);
    res.status(500).json({ success: false, error: "Error processing resumes" });
  }
});

// wait and run the Orgpath (3).ipynb here

app.get("/run-notebook", async (req, res) => {
  try {
    const notebookPath = path.join(__dirname, "Orgpath (3).ipynb");
    const pythonScript = path.join(__dirname, "run_notebook.py");
    const python = spawn("python", [pythonScript, notebookPath]);

    let output = "";
    let errorOutput = "";

    python.stdout.on("data", (data) => {
      console.log(`Python stdout: ${data}`);
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      console.error(`Python error: ${data}`);
      errorOutput += data.toString();
    });

    python.on("close", async (code) => {
      if (code !== 0) {
        res.status(500).json({
          success: false,
          error: "Error running notebook",
          details: errorOutput,
        });
      } else {
        res.json({ success: true, message: "Notebook executed successfully", output });
      }
    });
  } catch (error) {
    console.error("Error running notebook:", error);
    res.status(500).json({ success: false, error: "Error running notebook" });
  }
});

// Defines a route to fetch analysis results after running the notebook.
// app.get("/analysis", async (req, res) => {
//   try {
//     const notebookResponse = await fetch("http://localhost:3000/run-notebook");
//     const notebookResult = await notebookResponse.json();

//     if (!notebookResult.success) {
//       throw new Error("Failed to run notebook");
//     }

//     const latestResume = await resumesCollection.findOne(
//       {},
//       { sort: { uploadedAt: -1 } }
//     );
//     if (latestResume && latestResume.analysis && latestResume.assessment_scores) {
//       res.json({
//         success: true,
//         analysis: latestResume.analysis,
//         scores: latestResume.assessment_scores,
//         highlights: latestResume.highlights,
//         elevator_pitch: latestResume.elevator_pitch
//       });
//     } else {
//       res.status(404).json({ success: false, error: "No analysis found" });
//     }
//   } catch (error) {
//     console.error("Error fetching analysis:", error);
//     res.status(500).json({ success: false, error: "Error fetching analysis" });
//   }
// });

// In your server index.js, change the /analysis route:
app.get("/analysis", async (req, res) => {
  try {
    const notebookUrl = req.protocol + "://" + req.get("host") + "/run-notebook";
    const notebookResponse = await fetch(notebookUrl);
    const notebookResult = await notebookResponse.json();
    if (!notebookResult.success) {
      throw new Error("Failed to run notebook");
    }
    const latestResume = await resumesCollection.findOne({}, { sort: { uploadedAt: -1 } });
    if (latestResume && latestResume.analysis && latestResume.assessment_scores) {
      res.json({
        success: true,
        analysis: latestResume.analysis,
        scores: latestResume.assessment_scores,
        highlights: latestResume.highlights,
        elevator_pitch: latestResume.elevator_pitch,
        star_info: latestResume.star_info
      });
    } else {
      res.status(404).json({ success: false, error: "No analysis found" });
    }
  } catch (error) {
    console.error("Error fetching analysis:", error);
    res.status(500).json({ success: false, error: "Error fetching analysis" });
  }
});



//elevator pitch
app.get("/elevator-pitch", async (req, res) => {
  try {
    const latestResume = await resumesCollection.findOne(
      {},
      { sort: { uploadedAt: -1 } }
    );
    if (latestResume && latestResume.elevator_pitch) {
      res.json({
        success: true,
        elevator_pitch: latestResume.elevator_pitch,
      });
    } else {
      res
        .status(404)
        .json({ success: false, error: "No elevator pitch found" });
    }
  } catch (error) {
    console.error("Error fetching elevator pitch:", error);
    res
      .status(500)
      .json({ success: false, error: "Error fetching elevator pitch" });
  }
});

//STAR INFO
app.get("/star-info", async (req, res) => {
  try {
    const latestResume = await resumesCollection.findOne(
      {},
      { sort: { uploadedAt: -1 } }
    );
    if (latestResume && latestResume.star_info) {
      res.json({
        success: true,
        star_info: latestResume.star_info,
      });
    } else {
      res.status(404).json({ success: false, error: "No STAR info found" });
    }
  } catch (error) {
    console.error("Error fetching STAR info:", error);
    res.status(500).json({ success: false, error: "Error fetching STAR info" });
  }
});


//New Highligh code
app.post("/highlight-resume", async (req, res) => {
  try {
    const latestResume = await resumesCollection.findOne(
      {},
      { sort: { uploadedAt: -1 } }
    );

    if (latestResume && latestResume.highlights) {
      res.json({
        success: true,
        highlights: latestResume.highlights,
      });
    } else {
      res.status(404).json({
        success: false,
        error: "No highlights found",
      });
    }
  } catch (error) {
    console.error("Error fetching highlights:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching highlights",
    });
  }
});

const pdf = require("pdf-parse");

app.get("/get-pdf-text", async (req, res) => {
  try {
    const latestResume = await resumesCollection.findOne(
      {},
      { sort: { uploadedAt: -1 } }
    );
    if (!latestResume || !latestResume.content) {
      return res.status(404).json({ success: false, error: "No resume found" });
    }

    // Extract text from PDF
    const dataBuffer = Buffer.from(latestResume.content.buffer);
    const data = await pdf(dataBuffer);

    res.json({
      success: true,
      text: data.text,
      highlights: latestResume.highlights,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

//Sets up error handling middleware.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
