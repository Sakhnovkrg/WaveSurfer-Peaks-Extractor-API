const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const UPLOADS_DIR = path.join(__dirname, "../tmp");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const app = express();

const upload = multer({ dest: UPLOADS_DIR });

function runFFmpegCommand(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args);

    ffmpeg.on("error", (error) => {
      reject(error);
    });

    ffmpeg.stderr.on("data", (data) => {
      console.error("FFmpeg stderr:", data.toString());
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFFmpeg exited with code ${code}`));
      }
    });
  });
}

app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/extract-peaks", upload.single("audio"), async (req, res) => {
  let inputFile;
  let outputFile;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "File not received" });
    }

    let peakCount = parseInt(req.query.peakCount, 10);
    if (isNaN(peakCount)) {
      peakCount = 512;
    }

    if (isNaN(peakCount) || peakCount < 128 || peakCount > 4096) {
      return res.status(400).json({
        error: "Invalid peakCount. It must be a number between 64 and 4096.",
      });
    }

    inputFile = req.file.path;
    outputFile = path.join(UPLOADS_DIR, `${req.file.filename}.pcm`);

    await runFFmpegCommand("ffmpeg", [
      "-y",
      "-analyzeduration",
      "100M",
      "-probesize",
      "100M",
      "-i",
      inputFile,
      "-f",
      "s16le",
      "-ac",
      "1",
      "-ar",
      "44100",
      outputFile,
    ]);

    if (!fs.existsSync(outputFile)) {
      throw new Error(`PCM file not created: ${outputFile}`);
    }
    const stats = fs.statSync(outputFile);
    if (stats.size === 0) {
      throw new Error(`PCM file is empty: ${outputFile}`);
    }

    const rawData = fs.readFileSync(outputFile);
    const samples = new Int16Array(rawData.buffer);

    const blockSize = Math.floor(samples.length / peakCount);
    const peaks = [];

    for (let peakIndex = 0; peakIndex < peakCount; peakIndex++) {
      const start = peakIndex * blockSize;
      let end = start + blockSize;
      if (end > samples.length) {
        end = samples.length;
      }

      let localMax = -32768;
      for (let i = start; i < end; i++) {
        if (samples[i] > localMax) {
          localMax = samples[i];
        }
      }
      const normalized = localMax / 32768;

      peaks.push(normalized);
    }

    const normalizedPeaks = [peaks];
    return res.json({ peaks: normalizedPeaks });
  } catch (error) {
    console.error("Error extracting peaks:", error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (inputFile && fs.existsSync(inputFile)) {
      fs.unlinkSync(inputFile);
    }
    if (outputFile && fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
