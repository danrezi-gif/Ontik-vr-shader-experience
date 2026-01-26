import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createRepository, getAuthenticatedUser } from "./github";
import { execSync } from "child_process";
import * as path from "path";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // GitHub integration routes
  app.get("/api/github/user", async (req, res) => {
    try {
      const user = await getAuthenticatedUser();
      res.json({ username: user.login, avatar: user.avatar_url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/github/create-repo", async (req, res) => {
    try {
      const { name, description, isPrivate } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Repository name is required" });
      }
      
      const repo = await createRepository(
        name, 
        description || "VR Shader Experience - WebXR psychedelic visualization",
        isPrivate || false
      );
      
      res.json(repo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/github/push", async (req, res) => {
    try {
      const { repoUrl, owner, repoName } = req.body;
      
      if (!repoUrl || !owner || !repoName) {
        return res.status(400).json({ error: "Repository info is required" });
      }

      const projectRoot = process.cwd();
      
      // Configure git and push
      const commands = [
        `git config user.email "replit@users.noreply.github.com"`,
        `git config user.name "Replit User"`,
        `git remote remove github || true`,
        `git remote add github ${repoUrl}`,
        `git push -u github main --force`
      ];
      
      for (const cmd of commands) {
        try {
          execSync(cmd, { cwd: projectRoot, stdio: 'pipe' });
        } catch (e: any) {
          // Ignore remote removal errors
          if (!cmd.includes('remote remove')) {
            console.error(`Command failed: ${cmd}`, e.message);
          }
        }
      }
      
      res.json({ success: true, url: `https://github.com/${owner}/${repoName}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
