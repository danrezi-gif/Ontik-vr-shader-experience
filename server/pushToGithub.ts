import { getUncachableGitHubClient } from './github';
import * as fs from 'fs';
import * as path from 'path';

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.cache',
  '.replit',
  'replit.nix',
  '.upm',
  '.config',
  'package-lock.json',
  '.breakpoints',
  'generated-icon.png',
  '.local'
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (shouldIgnore(relativePath)) continue;
    
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.eot'];
  return binaryExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
}

export async function pushToGitHub(owner: string, repo: string) {
  const octokit = await getUncachableGitHubClient();
  const projectRoot = process.cwd();
  
  // First, initialize repo with a README using Contents API (works on empty repos)
  console.log('Initializing repository with README...');
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from('# VR Shader Experience\n\nWebXR VR psychedelic shader visualization for Meta Quest.\n').toString('base64')
    });
    console.log('README created');
  } catch (e: any) {
    console.log('README already exists or error:', e.message);
  }
  
  // Wait a moment for GitHub to process
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('Getting all project files...');
  const files = getAllFiles(projectRoot);
  console.log(`Found ${files.length} files to push`);
  
  // Get the current commit SHA
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: 'heads/main'
  });
  const latestCommitSha = ref.object.sha;
  
  // Get the tree SHA
  const { data: commit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha
  });
  
  // Create blobs for all files
  const treeItems: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = [];
  
  for (const file of files) {
    const fullPath = path.join(projectRoot, file);
    const isBinary = isBinaryFile(file);
    
    let content: string;
    let encoding: 'base64' | 'utf-8';
    
    if (isBinary) {
      content = fs.readFileSync(fullPath).toString('base64');
      encoding = 'base64';
    } else {
      content = fs.readFileSync(fullPath, 'utf-8');
      encoding = 'utf-8';
    }
    
    console.log(`Creating blob for: ${file}`);
    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content,
      encoding
    });
    
    treeItems.push({
      path: file,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }
  
  console.log('Creating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
    base_tree: commit.tree.sha
  });
  
  console.log('Creating commit...');
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Add VR Shader Experience project files',
    tree: tree.sha,
    parents: [latestCommitSha]
  });
  
  console.log('Updating main branch...');
  await octokit.git.updateRef({
    owner,
    repo,
    ref: 'heads/main',
    sha: newCommit.sha
  });
  
  console.log('Push complete!');
  return { success: true, commitSha: newCommit.sha };
}

// Run the push
pushToGitHub('danrezi-gif', 'vr-shader-experience')
  .then(result => console.log('Done:', result))
  .catch(err => console.error('Error:', err));
