#!/usr/bin/env node
/**
 * create-mern-project CLI (ESM)
 * Usage: node bin/index.js my-app
 * Or after npm link: create-mern-project my-app
 */

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = process.argv.slice(2);
const projectName = argv[0] || "my-mern-app";
const target = path.resolve(process.cwd(), projectName);

function log(...args) {
  console.log(...args);
}

async function runCmd(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const ps = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
    ps.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
    ps.on("error", (err) => reject(err));
  });
}

async function writeFile(filePath, contents) {
  await fs.mkdirp(path.dirname(filePath));
  await fs.writeFile(filePath, contents, "utf8");
}

async function create() {
  try {
    if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
      console.error(
        `✖ Target directory "${target}" exists and is not empty. Aborting.`
      );
      process.exit(1);
    }

    log(`\n🚀 Creating MERN project: ${projectName}`);
    await fs.mkdirp(target);

    /* ---------- backend ---------- */
    const backendDir = path.join(target, "backend");
    await fs.mkdirp(path.join(backendDir, "src", "models"));
    await fs.mkdirp(path.join(backendDir, "src", "controllers"));
    await fs.mkdirp(path.join(backendDir, "src", "routes"));

    const backendPkg = {
      name: `${projectName}-backend`,
      version: "1.0.0",
      type: "module",
      main: "server.js",
      scripts: {
        dev: "nodemon server.js",
        start: "node server.js",
      },
      dependencies: {
        express: "^4.19.2",
        mongoose: "^8.6.0",
        cors: "^2.8.5",
        dotenv: "^16.4.5",
      },
      devDependencies: {
        nodemon: "^3.1.0",
      },
    };
    await writeFile(
      path.join(backendDir, "package.json"),
      JSON.stringify(backendPkg, null, 2)
    );

    const backendServer = `import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./src/routes/user.routes.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/${projectName}_db";
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
  .then(()=> console.log("✅ MongoDB connected"))
  .catch(e => console.error("MongoDB connection error:", e));

app.get("/", (req, res) => res.json({ status: "ok", service: "backend" }));
app.use("/api/users", userRoutes);

app.listen(PORT, ()=> console.log(\`Backend running on http://localhost:\${PORT}\`));
`;
    await writeFile(path.join(backendDir, "server.js"), backendServer);

    const userModel = `import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
`;
    await writeFile(
      path.join(backendDir, "src", "models", "user.model.js"),
      userModel
    );

    const userController = `import User from "../models/user.model.js";

export const listUsers = async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const u = await User.create(req.body);
    res.status(201).json(u);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
`;
    await writeFile(
      path.join(backendDir, "src", "controllers", "user.controller.js"),
      userController
    );

    const userRoutes = `import { Router } from "express";
import { listUsers, createUser } from "../controllers/user.controller.js";

const router = Router();

router.get("/", listUsers);
router.post("/", createUser);

export default router;
`;
    await writeFile(
      path.join(backendDir, "src", "routes", "user.routes.js"),
      userRoutes
    );

    const backendEnv = `MONGO_URI=mongodb://127.0.0.1:27017/${projectName}_db
PORT=5000
`;
    await writeFile(path.join(backendDir, ".env.example"), backendEnv);
    await writeFile(path.join(backendDir, ".env"), backendEnv);

    /* ---------- client (Vite + React) ---------- */
    const clientDir = path.join(target, "client");
    await fs.mkdirp(path.join(clientDir, "src"));

    const clientPkg = {
      name: `${projectName}-client`,
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
      devDependencies: {
        vite: "^5.3.4",
        "@vitejs/plugin-react": "^4.3.1",
      },
    };
    await writeFile(
      path.join(clientDir, "package.json"),
      JSON.stringify(clientPkg, null, 2)
    );

    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} client</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
    await writeFile(path.join(clientDir, "index.html"), indexHtml);

    const viteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true
      }
    }
  }
});
`;
    await writeFile(path.join(clientDir, "vite.config.js"), viteConfig);

    const mainJsx = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
    await writeFile(path.join(clientDir, "src", "main.jsx"), mainJsx);

    const appJsx = `import { useEffect, useState } from "react";

export default function App() {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(setUsers).catch(console.error);
  }, []);

  const addUser = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email })
    });
    if (res.ok) {
      const u = await res.json();
      setUsers(prev => [...prev, u]);
      setName(""); setEmail("");
    } else {
      console.error("Failed to add user");
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>Vite + React — MERN client</h1>
      <p>Proxy: <code>/api → http://localhost:5000</code></p>

      <form onSubmit={addUser} style={{ marginTop: 16 }}>
        <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} required />{" "}
        <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />{" "}
        <button type="submit">Add User</button>
      </form>

      <h2 style={{ marginTop: 24 }}>Users</h2>
      <ul>
        {users.map(u => <li key={u._id || u.email}>{u.name} — {u.email}</li>)}
      </ul>
    </div>
  );
}
`;
    await writeFile(path.join(clientDir, "src", "App.jsx"), appJsx);

    const styles = `*{box-sizing:border-box}body{margin:0;padding:0}`;
    await writeFile(path.join(clientDir, "src", "styles.css"), styles);

    /* ---------- root package.json with concurrently script ---------- */
    const rootPkg = {
      name: projectName,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        dev: 'concurrently "npm --prefix backend run dev" "npm --prefix client run dev"',
        "dev:server": "npm --prefix backend run dev",
        "dev:client": "npm --prefix client run dev",
        start: "npm --prefix backend run start",
        build: "npm --prefix client run build",
      },
      devDependencies: {
        concurrently: "^8.2.0",
      },
    };
    await writeFile(
      path.join(target, "package.json"),
      JSON.stringify(rootPkg, null, 2)
    );
    await writeFile(
      path.join(target, ".gitignore"),
      "node_modules\n.env\n.DS_Store\n"
    );

    log(
      "\nFiles created. Installing dependencies. This may take a few minutes..."
    );

    // Install in backend, then client, then root (for concurrently)
    await runCmd("npm", ["install"], backendDir);
    await runCmd("npm", ["install"], clientDir);
    await runCmd("npm", ["install"], target);

    log("\n✅ Installation complete!");
    log(
      `\nNext steps:\n  cd ${projectName}\n  npm run dev\n\nBackend: http://localhost:5000\nFrontend: http://localhost:5173\n`
    );
    log("Note: Edit backend/.env if you want to set a remote MONGO_URI\n");
  } catch (err) {
    console.error("❌ Failed:", err);
    // optional cleanup if partial created
  }
}

create();

// #!/usr/bin/env node
// import fs from "fs-extra";
// import path from "path";
// import { fileURLToPath } from "url";

// // Fix __dirname for ESM
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const args = process.argv.slice(2);
// const projectName = args[0] || "my-mern-app";
// const projectPath = path.join(process.cwd(), projectName);

// async function createProject() {
//   try {
//     console.log(`🚀 Creating MERN project: ${projectName}`);

//     // Make directory
//     await fs.mkdirp(projectPath);

//     // package.json
//     await fs.writeJson(path.join(projectPath, "package.json"), {
//       name: projectName,
//       version: "1.0.0",
//       main: "index.js",
//       scripts: {
//         start: "node index.js",
//         server: "nodemon backend/server.js",
//         client: "npm start --prefix frontend",
//         dev: 'concurrently "npm run server" "npm run client"',
//       },
//     });

//     // backend
//     await fs.mkdirp(path.join(projectPath, "backend", "models"));
//     await fs.mkdirp(path.join(projectPath, "backend", "routes"));
//     await fs.mkdirp(path.join(projectPath, "backend", "config"));

//     await fs.writeFile(
//       path.join(projectPath, "backend", "server.js"),
//       `import express from "express";
// import mongoose from "mongoose";
// import dotenv from "dotenv";

// dotenv.config();
// const app = express();
// app.use(express.json());

// mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
// .then(() => console.log("✅ MongoDB Connected"))
// .catch(err => console.error(err));

// app.get("/", (req, res) => res.send("API is running..."));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(\`🚀 Server running on port \${PORT}\`));
// `
//     );

//     await fs.writeFile(
//       path.join(projectPath, ".env"),
//       `MONGO_URI=mongodb://localhost:27017/${projectName}
// PORT=5000`
//     );

//     // frontend (placeholder)
//     await fs.mkdirp(path.join(projectPath, "frontend"));
//     await fs.writeFile(
//       path.join(projectPath, "frontend", "README.md"),
//       "# Frontend placeholder (React setup here)"
//     );

//     console.log("✅ MERN project created successfully!");
//   } catch (error) {
//     console.error("❌ Error creating project:", error);
//   }
// }

// createProject();
